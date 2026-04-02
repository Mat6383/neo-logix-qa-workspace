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
  async syncRunStatusToGitLab(runId, iterationName, gitlabProjectId, onEvent = () => {}, dryRun = false) {
    const stats = { updated: 0, skipped: 0, errors: 0, total: 0, dryRun };

    onEvent('info', { message: `Démarrage sync Testmo run #${runId} → GitLab "${iterationName}"${dryRun ? ' [DRY-RUN — aucune modif GitLab]' : ''}` });
    logger.info(`[StatusSync] run=${runId}, iteration="${iterationName}", glProject=${gitlabProjectId}`);

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

    onEvent('info', { message: `Récupération des issues GitLab pour l'itération ${iteration.id}…` });
    const issues = await gitlabService.getIssuesForIteration(gitlabProjectId, iteration.id);
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

    // 3. Appliquer les labels
    stats.total = results.length;

    for (const result of results) {
      const statusId  = result.status_id;
      const newLabel  = STATUS_TO_LABEL[statusId]; // undefined si Untested (8)

      const caseName  = result.case_name || caseNames.get(result.case_id);
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

      if (!newLabel) {
        // Statut Untested (8) ou inconnu → on ne change rien
        stats.skipped++;
        onEvent('skip', { caseName, reason: `statut ${statusId} non mappé` });
        continue;
      }

      // Labels Test:: actuels de l'issue
      const currentLabels = issue.labels || [];
      const labelsToRemove = currentLabels.filter(l => ALL_TEST_LABELS.includes(l) && l !== newLabel);
      const alreadyHasLabel = currentLabels.includes(newLabel);

      if (alreadyHasLabel && labelsToRemove.length === 0) {
        // Rien à faire
        stats.skipped++;
        onEvent('skip', { caseName, label: newLabel, reason: 'déjà à jour' });
        continue;
      }

      if (dryRun) {
        // Dry-run : affiche ce qui serait fait sans appeler GitLab
        stats.updated++;
        onEvent('would-update', {
          caseName,
          issueIid:  issue.iid,
          label:     newLabel,
          removed:   labelsToRemove,
          current:   currentLabels.filter(l => ALL_TEST_LABELS.includes(l))
        });
        continue;
      }

      try {
        await gitlabService.updateIssueLabel(gitlabProjectId, issue.iid, newLabel, labelsToRemove);
        stats.updated++;
        onEvent('updated', { caseName, issueIid: issue.iid, label: newLabel, removed: labelsToRemove });
        logger.info(`[StatusSync] #${issue.iid} "${caseName}" → ${newLabel}`);
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
module.exports.STATUS_TO_LABEL   = STATUS_TO_LABEL;
module.exports.ALL_TEST_LABELS   = ALL_TEST_LABELS;
module.exports.StatusSyncService = StatusSyncService;
