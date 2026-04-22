/**
 * ================================================
 * STATUS SYNC SERVICE - Testmo → GitLab
 * ================================================
 * Synchronise les statuts des résultats Testmo
 * vers les labels GitLab de l'itération correspondante.
 *
 * Mapping Testmo → GitLab label :
 *   1 = Passed   → Test::OK
 *   2 = Failed   → Test::KO
 *   3 = Retest   → DoubleTestNécessaire
 *   4 = Blocked  → Test::BLOCKED
 *   5 = Skipped  → Test::SKIPPED
 *   7 = WIP      → Test::WIP
 *   8 = Untested → (ignoré — pas de label posé)
 *
 * @author Matou - Neo-Logix QA Lead
 */

const axios = require('axios');
const logger = require('./logger.service');
const gitlabService = require('./gitlab.service');

// ─── Constantes ─────────────────────────────────────────────────────────────

// Mapping empiriquement vérifié sur cette instance Testmo (≠ IDs standards)
// Confirmé en croisant l'UI Testmo et les données /runs/{id}/results
const STATUS_TO_LABEL = {
  2: 'Test::OK',               // Passed  (vert)
  3: 'Test::KO',               // Failed  (rouge)
  4: 'DoubleTestNécessaire',   // Retest  (orange)
  8: 'Test::WIP'               // WIP     (violet)
  // 1 = Untested initial (aucun result créé)
  // 5, 6, 7 = statuts non observés → ignorés pour l'instant
};

// Noms lisibles des statuts (pour les commentaires GitLab)
const STATUS_ID_TO_NAME = {
  2: 'Passed',
  3: 'Failed',
  4: 'Retest',
  8: 'WIP'
};

// Tous les labels Test:: gérés par cette sync (pour les retirer avant d'en ajouter un nouveau)
const ALL_TEST_LABELS = [
  'Test::OK',
  'Test::KO',
  'Test::WIP',
  'Test::SKIPPED',
  'Test::BLOCKED',
  'DoubleTestNécessaire',
  'Test::TODO'
];

// ─── Status natif GitLab Work Items (GIDs confirmés Phase 0) ─────────────────
// Projet neo-logix/legacy/neo-fugu-pilot — allowedStatuses sur type Issue
const GITLAB_STATUS_TODO   = process.env.GITLAB_STATUS_TODO   || 'gid://gitlab/WorkItems::Statuses::Custom::Status/15';
const GITLAB_STATUS_OK     = process.env.GITLAB_STATUS_OK     || 'gid://gitlab/WorkItems::Statuses::Custom::Status/18';
const GITLAB_STATUS_KO     = process.env.GITLAB_STATUS_KO     || 'gid://gitlab/WorkItems::Statuses::Custom::Status/17';
const GITLAB_STATUS_WIP    = process.env.GITLAB_STATUS_WIP    || 'gid://gitlab/WorkItems::Statuses::Custom::Status/21';
const GITLAB_STATUS_RETEST = process.env.GITLAB_STATUS_RETEST || 'gid://gitlab/WorkItems::Statuses::Custom::Status/19';

// GID du champ custom "Version Prod" (CustomField/1) — confirmé Phase 0
const VERSION_FIELD_KEY = process.env.GITLAB_VERSION_FIELD_ID || 'gid://gitlab/Issuables::CustomField/1';

// Mapping Testmo status_id → GitLab status natif
const STATUS_TO_GITLAB_STATUS = {
  2: GITLAB_STATUS_OK,      // Passed  (vert)
  3: GITLAB_STATUS_KO,      // Failed  (rouge)
  4: GITLAB_STATUS_RETEST,  // Retest  (orange)
  8: GITLAB_STATUS_WIP      // WIP     (violet)
};

// ─── Standalone helpers (exportés pour tests) ────────────────────────────────

function buildCommentText(runName, statusId) {
  const statusName = STATUS_ID_TO_NAME[statusId] || String(statusId);
  return `Commentaire ajouté automatiquement - Test sur le run: ${runName} - Status ${statusName}`;
}

function isCommentDuplicate(existingNotes, commentText) {
  return existingNotes.some(n => n.body === commentText);
}

function computeLabelChanges(currentLabels, newLabel) {
  if (!newLabel) return { addLabel: null, removeLabels: [], action: 'skip' };
  const labelsToRemove = currentLabels.filter(l => ALL_TEST_LABELS.includes(l) && l !== newLabel);
  const alreadyHasLabel = currentLabels.includes(newLabel);
  if (alreadyHasLabel && labelsToRemove.length === 0) {
    return { addLabel: newLabel, removeLabels: [], action: 'noop' };
  }
  return { addLabel: newLabel, removeLabels: labelsToRemove, action: 'update' };
}

function computeStatusChange(currentStatus, newStatus) {
  if (!newStatus) return { newStatus: null, action: 'skip' };
  if (currentStatus === newStatus) return { newStatus, action: 'noop' };
  return { newStatus, action: 'update' };
}

// Résout un champ imbriqué par chemin pointé (ex: "custom_fields.version")
function _resolveField(obj, path) {
  return path.split('.').reduce((acc, k) => acc?.[k], obj);
}

// ─── Service ─────────────────────────────────────────────────────────────────

class StatusSyncService {
  constructor() {
    this.baseURL = process.env.TESTMO_URL;
    this.token   = process.env.TESTMO_TOKEN;
    this.timeout = parseInt(process.env.API_TIMEOUT) || 30000;

    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    // Délai entre requêtes GitLab (rate-limit)
    this.apiDelay = 400;
  }

  _delay() {
    return new Promise(resolve => setTimeout(resolve, this.apiDelay));
  }

  // ─── Testmo API helpers ────────────────────────────────────────────────────

  /**
   * Récupère les métadonnées d'un run Testmo (nom, etc.)
   *
   * @param {number} runId
   * @returns {Object} { id, name, ... }
   */
  async _getRunInfo(runId) {
    const resp = await this.client.get(`/runs/${runId}`);
    return resp.data?.result || resp.data || {};
  }

  /**
   * Récupère tous les résultats (is_latest seulement) d'un run Testmo.
   *
   * @param {number} runId
   * @returns {Array} [{ case_id, case_name, status_id, is_latest, ... }]
   */
  async _getRunResults(runId) {
    const all = [];
    let page = 1;

    while (true) {
      const resp = await this.client.get(`/runs/${runId}/results`, {
        params: page > 1 ? { page } : {}
        // Note: per_page et is_latest en query param causent 422 → filtre mémoire + défaut API
      });

      const data = resp.data?.result || resp.data?.data || [];
      if (!Array.isArray(data) || data.length === 0) break;
      all.push(...data);

      const nextPage = resp.data?.next_page;
      if (!nextPage) break;
      page = nextPage;
    }

    // Ne garder que le résultat le plus récent par case_id
    return all.filter(r => r.is_latest === true);
  }

  /**
   * Construit un map case_id → case_name en paginant sur /projects/{id}/cases
   * jusqu'à ce que tous les IDs demandés soient trouvés.
   *
   * @param {number[]} neededIds  - Liste des case_ids à résoudre
   * @returns {Map<number, string>}
   */
  async _getCaseNames(neededIds) {
    const projectId = process.env.TESTMO_PROJECT_ID || 1;
    const map = new Map();
    const remaining = new Set(neededIds);
    let page = 1;

    while (remaining.size > 0) {
      const resp = await this.client.get(`/projects/${projectId}/cases`, {
        params: { page }
        // Note: per_page en query param cause 422 → on utilise le défaut (100)
      });
      const data   = resp.data?.result || [];
      const pages  = resp.data?.last_page || 1;

      for (const c of data) {
        if (remaining.has(c.id)) {
          map.set(c.id, c.name);
          remaining.delete(c.id);
        }
      }

      if (page >= pages || remaining.size === 0) break;
      page++;
    }

    if (remaining.size > 0) {
      logger.warn(`[StatusSync] ${remaining.size} case_id(s) introuvable(s): ${[...remaining].join(', ')}`);
    }
    return map;
  }

  // ─── Commentaires GitLab ──────────────────────────────────────────────────

  /**
   * Formate le texte du commentaire automatique.
   *
   * @param {string} runName    - Nom du run Testmo (ex: "R10 - run 1")
   * @param {number} statusId   - ID du statut Testmo
   * @returns {string} Texte du commentaire
   */
  _buildCommentText(runName, statusId) {
    const statusName = STATUS_ID_TO_NAME[statusId] || String(statusId);
    return `Commentaire ajouté automatiquement - Test sur le run: ${runName} - Status ${statusName}`;
  }

  /**
   * Poste un commentaire sur une issue GitLab uniquement si un commentaire
   * identique (même run + même statut) n'existe pas déjà (idempotence).
   *
   * @param {number|string} projectId - ID du projet GitLab
   * @param {number}        issueIid  - IID de l'issue
   * @param {string}        caseName  - Nom du cas de test (pour les logs)
   * @param {string}        runName   - Nom du run Testmo
   * @param {number}        statusId  - ID du statut Testmo
   */
  async _postCommentIfNeeded(projectId, issueIid, caseName, runName, statusId) {
    const commentText = this._buildCommentText(runName, statusId);

    try {
      // Récupère les commentaires existants pour vérifier l'idempotence
      const existingNotes = await gitlabService.getIssueNotes(projectId, issueIid);
      const alreadyExists = existingNotes.some(n => n.body === commentText);

      if (alreadyExists) {
        logger.info(`[StatusSync] Commentaire déjà présent sur #${issueIid} pour run="${runName}" status=${statusId} — ignoré`);
        return;
      }

      await gitlabService.addIssueComment(projectId, issueIid, commentText);
      logger.info(`[StatusSync] Commentaire ajouté sur #${issueIid} "${caseName}" : "${commentText}"`);
    } catch (err) {
      // Non-bloquant : une erreur sur le commentaire ne doit pas annuler la sync
      logger.error(`[StatusSync] Erreur commentaire #${issueIid} "${caseName}": ${err.message}`);
    }
  }

  // ─── Sync principale ───────────────────────────────────────────────────────

  /**
   * Synchronise les statuts d'un run Testmo vers les labels GitLab.
   *
   * Algorithme :
   *  1. Récupère les résultats (is_latest) du run Testmo.
   *  2. Récupère les issues GitLab de l'itération.
   *  3. Pour chaque résultat dont le statut est connu (≠ 8=Untested) :
   *       - cherche l'issue GitLab dont le titre == case_name
   *       - retire tous les labels Test:: existants
   *       - ajoute le nouveau label
   *  4. Envoie des événements SSE via onEvent (progression).
   *
   * @param {number} runId           - ID du run Testmo
   * @param {string} iterationName   - Nom de l'itération GitLab (ex: "R14 - run 1")
   * @param {number|string} gitlabProjectId - ID du projet GitLab
   * @param {Function} onEvent       - callback(type, data) pour SSE
   * @param {boolean}  dryRun        - Si true : calcule sans appeler GitLab
   * @returns {Object} { updated, skipped, errors, total }
   */
  async syncRunStatusToGitLab(runId, iterationName, gitlabProjectId, onEvent = () => {}, dryRun = false, version = null) {
    const stats = { updated: 0, skipped: 0, errors: 0, total: 0, dryRun };

    onEvent('info', { message: `Démarrage sync Testmo run #${runId} → GitLab "${iterationName}"${dryRun ? ' [DRY-RUN — aucune modif GitLab]' : ''}` });
    logger.info(`[StatusSync] run=${runId}, iteration="${iterationName}", glProject=${gitlabProjectId}`);

    // 0. Nom du run Testmo (pour les commentaires GitLab)
    onEvent('info', { message: 'Récupération du nom du run Testmo…' });
    let runName = `Run #${runId}`;
    try {
      const runInfo = await this._getRunInfo(runId);
      runName = runInfo.name || runName;
      onEvent('info', { message: `Run Testmo : "${runName}"` });
    } catch (err) {
      logger.warn(`[StatusSync] Impossible de récupérer le nom du run ${runId}: ${err.message}`);
    }

    // 1. Résultats Testmo (is_latest)
    onEvent('info', { message: 'Récupération des résultats Testmo…' });
    const results = await this._getRunResults(runId);
    if (results.length === 0) {
      onEvent('warn', { message: 'Aucun résultat trouvé dans ce run.' });
      return stats;
    }
    onEvent('info', { message: `${results.length} résultat(s) Testmo trouvé(s).` });

    // Récupère les noms de cases (les résultats ne les contiennent pas)
    onEvent('info', { message: 'Résolution des noms de cases Testmo…' });
    const neededIds = [...new Set(results.map(r => r.case_id).filter(Boolean))];
    const caseNames = await this._getCaseNames(neededIds);
    onEvent('info', { message: `${caseNames.size}/${neededIds.length} noms de cases résolus.` });

    // 2. Issues GitLab de l'itération
    onEvent('info', { message: `Recherche itération GitLab "${iterationName}"…` });
    const iteration = await gitlabService.findIterationForProject(gitlabProjectId, iterationName);
    if (!iteration) {
      throw new Error(`Itération GitLab "${iterationName}" non trouvée dans le projet ${gitlabProjectId}`);
    }

    onEvent('info', { message: `Récupération des issues GitLab pour l'itération ${iteration.id}${version ? ` (version=${version})` : ''}…` });
    const issues = version
      ? await gitlabService.getIssuesByVersionAndIteration(gitlabProjectId, version, iteration.id)
      : await gitlabService.getIssuesForIteration(gitlabProjectId, iteration.id);
    if (issues.length === 0) {
      onEvent('warn', { message: 'Aucune issue GitLab trouvée pour cette itération.' });
      return stats;
    }

    // Index issues par titre (titre normalisé → issue)
    const normalize = s => (s || '').toLowerCase().trim();
    const issueByTitle = new Map();
    for (const issue of issues) {
      issueByTitle.set(normalize(issue.title), issue);
    }
    onEvent('info', { message: `${issues.length} issue(s) GitLab indexée(s).` });

    // 3. Appliquer les statuts Work Item via GraphQL
    stats.total = results.length;

    for (const result of results) {
      const statusId  = result.status_id;
      const newStatus = STATUS_TO_GITLAB_STATUS[statusId]; // undefined si Untested

      const caseName = result.case_name || caseNames.get(result.case_id);
      if (!caseName) {
        stats.skipped++;
        continue;
      }

      const issue = issueByTitle.get(normalize(caseName));
      if (!issue) {
        logger.debug(`[StatusSync] Pas d'issue GitLab pour case "${caseName}" — ignoré`);
        stats.skipped++;
        continue;
      }

      if (!newStatus) {
        stats.skipped++;
        onEvent('skip', { caseName, reason: `statut Testmo ${statusId} non mappé` });
        continue;
      }

      // Construit le GID Work Item depuis l'id global retourné par l'API REST
      const workItemGlobalId = `gid://gitlab/WorkItem/${issue.id}`;

      if (dryRun) {
        stats.updated++;
        onEvent('would-update', {
          caseName,
          issueIid: issue.iid,
          workItemGlobalId,
          newStatus
        });
        continue;
      }

      try {
        await gitlabService.updateWorkItemStatus(workItemGlobalId, newStatus);
        stats.updated++;
        onEvent('updated', { caseName, issueIid: issue.iid, newStatus });
        logger.info(`[StatusSync] #${issue.iid} "${caseName}" → status:${newStatus}`);

        await this._postCommentIfNeeded(gitlabProjectId, issue.iid, caseName, runName, statusId);
      } catch (err) {
        stats.errors++;
        onEvent('error', { caseName, issueIid: issue.iid, error: err.message });
        logger.error(`[StatusSync] Erreur #${issue.iid} "${caseName}":`, err.message);
      }

      await this._delay();
    }

    onEvent('done', stats);
    logger.info(`[StatusSync] Terminé — updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors}`);
    return stats;
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

const statusSyncService = new StatusSyncService();

module.exports = statusSyncService;
// Legacy (conservé pour rétrocompatibilité pendant transition)
module.exports.STATUS_TO_LABEL    = STATUS_TO_LABEL;
module.exports.ALL_TEST_LABELS    = ALL_TEST_LABELS;
// Courant
module.exports.STATUS_ID_TO_NAME     = STATUS_ID_TO_NAME;
module.exports.STATUS_TO_GITLAB_STATUS = STATUS_TO_GITLAB_STATUS;
module.exports.GITLAB_STATUS_TODO    = GITLAB_STATUS_TODO;
module.exports.GITLAB_STATUS_OK      = GITLAB_STATUS_OK;
module.exports.GITLAB_STATUS_KO      = GITLAB_STATUS_KO;
module.exports.GITLAB_STATUS_WIP     = GITLAB_STATUS_WIP;
module.exports.GITLAB_STATUS_RETEST  = GITLAB_STATUS_RETEST;
module.exports.VERSION_FIELD_KEY     = VERSION_FIELD_KEY;
module.exports.StatusSyncService     = StatusSyncService;
module.exports.buildCommentText      = buildCommentText;
module.exports.isCommentDuplicate    = isCommentDuplicate;
module.exports.computeLabelChanges   = computeLabelChanges;
module.exports.computeStatusChange   = computeStatusChange;
