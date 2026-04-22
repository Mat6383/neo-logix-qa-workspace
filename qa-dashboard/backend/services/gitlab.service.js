/**
 * ================================================
 * GITLAB SERVICE - API Integration
 * ================================================
 * Service responsable des interactions avec l'API GitLab v4
 * Récupération des tickets par itération et label
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

const axios = require('axios');
const logger = require('./logger.service');

class GitLabService {
  constructor() {
    this.baseURL = process.env.GITLAB_URL;
    this.token = process.env.GITLAB_TOKEN;
    // Token d'écriture séparé pour modifier les labels (scope api requis)
    // Si absent, on retombe sur GITLAB_TOKEN (peut échouer en 403 si read-only)
    this.writeToken = process.env.GITLAB_WRITE_TOKEN || process.env.GITLAB_TOKEN;
    this.projectId = process.env.GITLAB_PROJECT_ID;
    this.verifySsl = process.env.GITLAB_VERIFY_SSL !== 'false';
    this.timeout = parseInt(process.env.API_TIMEOUT) || 10000;

    // Délai entre requêtes API (rate-limit protection)
    this.apiDelay = 300;

    const httpsAgent = this.verifySsl === false
      ? new (require('https').Agent)({ rejectUnauthorized: false })
      : undefined;

    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json'
      },
      // Support self-signed certificates (GitLab on-premise)
      ...(httpsAgent && { httpsAgent })
    });

    // Client dédié aux opérations d'écriture (labels, etc.)
    this.writeClient = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.writeToken,
        'Content-Type': 'application/json'
      },
      ...(httpsAgent && { httpsAgent })
    });

    this.client.interceptors.response.use(
      response => {
        logger.info(`GitLab API Success: ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      error => {
        logger.error(`GitLab API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Pause entre requêtes API
   */
  _delay() {
    return new Promise(resolve => setTimeout(resolve, this.apiDelay));
  }

  /**
   * Retry avec backoff exponentiel (ITIL Resilience Management)
   * Réessaie sur erreurs réseau ou 5xx GitLab.
   *
   * @param {Function} fn        - Fonction async à exécuter
   * @param {string}   label     - Nom de l'opération (pour les logs)
   * @param {number}   maxRetries - Nombre maximum de tentatives (défaut 3)
   * @param {number}   baseDelay  - Délai de base en ms (défaut 600)
   * @returns {Promise<*>}
   * @private
   */
  async _withRetry(fn, label = 'unknown', maxRetries = 3, baseDelay = 600) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const isRetryable = !status || status === 429 || status >= 500 ||
          err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND';
        if (!isRetryable || attempt === maxRetries) break;
        const delay = baseDelay * Math.pow(2, attempt - 1); // 600ms, 1.2s, 2.4s
        logger.warn(`[Retry] GitLab.${label} — tentative ${attempt}/${maxRetries} (${err.message}), nouvel essai dans ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * Récupère toutes les pages d'un endpoint paginé
   */
  async _getPaginated(url, params = {}) {
    const results = [];
    params.per_page = 100;
    params.page = 1;

    while (true) {
      const resp = await this._withRetry(() => this.client.get(url, { params }), `_getPaginated(${url})`);
      const data = resp.data;
      if (!data || data.length === 0) break;
      results.push(...data);

      const nextPage = resp.headers['x-next-page'];
      if (!nextPage) break;
      params.page = parseInt(nextPage);
      await this._delay();
    }

    return results;
  }

  /**
   * Recherche une itération par nom (insensible casse/espaces)
   * GitLab API: GET /projects/:id/iterations?search=R06
   *
   * @param {string} iterationName - Nom de l'itération (ex: "R06 - run 1")
   * @returns {Object|null} L'itération trouvée ou null
   */
  async findIteration(iterationName) {
    try {
      // Normalise le nom pour la recherche
      const searchTerm = iterationName.replace(/[-\s]+/g, ' ').trim();
      // Utilise le début du nom pour la recherche API
      const searchPrefix = searchTerm.split(' ')[0]; // ex: "R06"

      const iterations = await this._getPaginated(
        `/projects/${this.projectId}/iterations`,
        { search: searchPrefix, state: 'all' }
      );

      // Matching insensible casse/espaces
      const normalize = (str) => str.toLowerCase().replace(/[-\s]+/g, '');
      const normalizedSearch = normalize(iterationName);

      const found = iterations.find(iter =>
        normalize(iter.title || '') === normalizedSearch
      );

      if (found) {
        logger.info(`GitLab: Itération trouvée - "${found.title}" (id=${found.id})`);
      } else {
        logger.warn(`GitLab: Itération "${iterationName}" non trouvée parmi ${iterations.length} résultats`);
      }

      return found || null;
    } catch (error) {
      logger.error(`GitLab: Erreur recherche itération "${iterationName}":`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les tickets par label ET itération
   * GitLab API: GET /projects/:id/issues?labels=test::TODO&iteration_id=XXX
   *
   * @param {string} label - Label scoped (ex: "test::TODO")
   * @param {number} iterationId - ID de l'itération
   * @returns {Array} Liste des tickets
   */
  async getIssuesByLabelAndIteration(label, iterationId) {
    try {
      const issues = await this._getPaginated(
        `/projects/${this.projectId}/issues`,
        {
          labels: label,
          iteration_id: iterationId,
          state: 'all',
          scope: 'all'
        }
      );

      logger.info(`GitLab: ${issues.length} ticket(s) trouvé(s) [label="${label}", iteration_id=${iterationId}]`);
      return issues;
    } catch (error) {
      logger.error(`GitLab: Erreur récupération issues:`, error.message);
      throw error;
    }
  }

  /**
   * Recherche une itération dans un projet GitLab spécifique (autre que le projet par défaut)
   *
   * @param {number|string} projectId   - ID du projet GitLab cible
   * @param {string}        iterationName - Nom de l'itération
   * @returns {Object|null}
   */
  async findIterationForProject(projectId, iterationName) {
    try {
      // Récupère toutes les itérations (sans passer search : les cadences auto ont title=null)
      const iterations = await this._getPaginated(
        `/projects/${projectId}/iterations`,
        { state: 'all' }
      );

      // Cas 1 : titre généré "Itération #N (date → date)" → match par iid
      // Regex large pour gérer tous encodages de é et variantes
      const generatedMatch = iterationName.match(/#(\d+)/);
      if (generatedMatch && /it.ration/i.test(iterationName)) {
        const targetIid = parseInt(generatedMatch[1]);
        const found = iterations.find(it => it.iid === targetIid);
        if (found) {
          logger.info(`GitLab: Itération trouvée par iid=${targetIid} (project ${projectId}, id=${found.id})`);
          return found;
        }
      }

      // Cas 2 : match par titre normalisé (ex: "R06 - run 1")
      const normalize = (str) => str.toLowerCase().replace(/[-\s]+/g, '');
      const normalizedSearch = normalize(iterationName);
      const found = iterations.find(iter => normalize(iter.title || '') === normalizedSearch);

      if (found) {
        logger.info(`GitLab: Itération trouvée (project ${projectId}) - "${found.title}" (id=${found.id})`);
      } else {
        logger.warn(`GitLab: Itération "${iterationName}" non trouvée dans project ${projectId}`);
      }

      return found || null;
    } catch (error) {
      logger.error(`GitLab: Erreur recherche itération projet ${projectId}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les tickets par label ET itération pour un projet spécifique
   *
   * @param {number|string} projectId   - ID du projet GitLab cible
   * @param {string}        label       - Label scoped
   * @param {number}        iterationId - ID de l'itération
   * @returns {Array}
   */
  async getIssuesByLabelAndIterationForProject(projectId, label, iterationId) {
    try {
      const issues = await this._getPaginated(
        `/projects/${projectId}/issues`,
        { labels: label, iteration_id: iterationId, state: 'all', scope: 'all' }
      );
      logger.info(`GitLab: ${issues.length} ticket(s) (project=${projectId}, label="${label}", iteration_id=${iterationId})`);
      return issues;
    } catch (error) {
      logger.error(`GitLab: Erreur récupération issues projet ${projectId}:`, error.message);
      throw error;
    }
  }

  /**
   * Recherche les itérations d'un projet pour le dropdown du Dashboard 6
   *
   * @param {number|string} projectId  - ID du projet GitLab
   * @param {string}        search     - Terme de recherche (facultatif)
   * @returns {Array}
   */
  async searchIterations(projectId, search = '') {
    try {
      // On récupère toutes les itérations sans passer le search à GitLab
      // (les cadences auto ont title=null, GitLab ne peut pas chercher dessus)
      const params = { state: 'all', per_page: 50 };

      const iterations = await this._getPaginated(
        `/projects/${projectId}/iterations`,
        params
      );

      // Générer un titre de fallback si title est null (cadences automatiques GitLab)
      const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '?';
      iterations.forEach(it => {
        if (!it.title) {
          it.title = `Itération #${it.iid || it.sequence || it.id} (${formatDate(it.start_date)} → ${formatDate(it.due_date)})`;
        }
      });

      // Trier par iid décroissant (plus récente en premier)
      iterations.sort((a, b) => {
        if (a.iid != null && b.iid != null) return b.iid - a.iid;
        return (b.title || '').localeCompare(a.title || '');
      });

      // Filtrer localement par search si fourni
      if (search) {
        const q = search.toLowerCase();
        return iterations.filter(it => (it.title || '').toLowerCase().includes(q));
      }

      return iterations;
    } catch (error) {
      logger.error(`GitLab: Erreur recherche itérations projet ${projectId}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les tickets par label uniquement (fallback)
   *
   * @param {string} label - Label scoped (ex: "test::TODO")
   * @returns {Array} Liste des tickets
   */
  async getIssuesByLabel(label) {
    try {
      const issues = await this._getPaginated(
        `/projects/${this.projectId}/issues`,
        {
          labels: label,
          state: 'opened',
          scope: 'all'
        }
      );

      logger.info(`GitLab: ${issues.length} ticket(s) trouvé(s) [label="${label}"]`);
      return issues;
    } catch (error) {
      logger.error(`GitLab: Erreur récupération issues par label:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les commentaires (notes) d'une issue GitLab
   * Exclut les notes système (transitions automatiques GitLab)
   *
   * @param {number|string} projectId - ID du projet GitLab
   * @param {number} issueIid        - IID de l'issue (numéro affiché #XXXX)
   * @returns {Array} Notes triées par date croissante, sans notes système
   */
  async getIssueNotes(projectId, issueIid) {
    try {
      const notes = await this._getPaginated(
        `/projects/${projectId}/issues/${issueIid}/notes`,
        { sort: 'asc', order_by: 'created_at' }
      );
      const filtered = notes.filter(n => !n.system);
      logger.info(`GitLab: ${filtered.length} commentaire(s) récupéré(s) pour #${issueIid}`);
      return filtered;
    } catch (error) {
      logger.error(`GitLab: Erreur récupération commentaires #${issueIid}:`, error.message);
      return [];
    }
  }

  /**
   * Récupère TOUTES les issues d'une itération (sans filtre de label)
   * Utilisé par le StatusSync pour obtenir tous les tickets de l'itération.
   *
   * @param {number|string} projectId   - ID du projet GitLab
   * @param {number}        iterationId - ID de l'itération
   * @returns {Array}
   */
  async getIssuesForIteration(projectId, iterationId) {
    try {
      const issues = await this._getPaginated(
        `/projects/${projectId}/issues`,
        { iteration_id: iterationId, state: 'all', scope: 'all' }
      );
      logger.info(`GitLab: ${issues.length} issue(s) pour iteration_id=${iterationId} (project=${projectId})`);
      return issues;
    } catch (error) {
      logger.error(`GitLab: Erreur récupération issues iteration ${iterationId}:`, error.message);
      throw error;
    }
  }

  /**
   * Met à jour les labels d'une issue GitLab :
   * - Ajoute `addLabel` (si non null)
   * - Retire les labels de `removeLabels`
   *
   * GitLab API: PUT /projects/:id/issues/:iid
   *   { add_labels: "Test::OK", remove_labels: "Test::KO,Test::WIP" }
   *
   * @param {number|string} projectId    - ID du projet GitLab
   * @param {number}        issueIid     - IID de l'issue (numéro #XXXX)
   * @param {string|null}   addLabel     - Label à ajouter (peut être null)
   * @param {string[]}      removeLabels - Labels à retirer
   * @returns {Object} Issue mise à jour
   */
  async updateIssueLabel(projectId, issueIid, addLabel, removeLabels = []) {
    try {
      const body = {};
      if (addLabel)              body.add_labels    = addLabel;
      if (removeLabels.length)   body.remove_labels = removeLabels.join(',');

      if (!body.add_labels && !body.remove_labels) {
        logger.debug(`GitLab: updateIssueLabel #${issueIid} — rien à faire`);
        return null;
      }

      const resp = await this.writeClient.put(`/projects/${projectId}/issues/${issueIid}`, body);
      logger.info(`GitLab: Labels mis à jour pour #${issueIid} — +[${addLabel}] -[${removeLabels.join(',')}]`);
      return resp.data;
    } catch (error) {
      logger.error(`GitLab: Erreur updateIssueLabel #${issueIid}:`, error.message);
      throw error;
    }
  }

  /**
   * Exécute une requête GraphQL sur l'API GitLab.
   *
   * @param {string}  query          - Requête ou mutation GraphQL
   * @param {Object}  variables      - Variables GraphQL (optionnel)
   * @param {boolean} useWriteToken  - Utilise GITLAB_WRITE_TOKEN si true
   * @returns {Object} data de la réponse GraphQL
   */
  async executeGraphQL(query, variables = {}, useWriteToken = false) {
    const token = useWriteToken ? this.writeToken : this.token;
    const httpsAgent = this.verifySsl === false
      ? new (require('https').Agent)({ rejectUnauthorized: false })
      : undefined;

    const resp = await this._withRetry(() => axios.post(
      `${this.baseURL}/api/graphql`,
      { query, variables },
      {
        timeout: this.timeout,
        headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
        ...(httpsAgent && { httpsAgent })
      }
    ), 'executeGraphQL');

    if (resp.data.errors?.length) {
      throw new Error(`GraphQL: ${resp.data.errors[0].message}`);
    }
    return resp.data.data;
  }

  /**
   * Met à jour le status natif d'un Work Item GitLab via GraphQL.
   * Remplace updateIssueStatus() (REST ne supporte pas le status Work Item).
   *
   * @param {string} workItemGlobalId - GID du work item (ex: "gid://gitlab/WorkItem/19796")
   * @param {string} statusGlobalId   - GID du status (ex: "gid://gitlab/WorkItems::Statuses::Custom::Status/18")
   * @returns {Object} workItem mis à jour
   */
  async updateWorkItemStatus(workItemGlobalId, statusGlobalId) {
    const mutation = `
      mutation UpdateWorkItemStatus($id: WorkItemID!, $statusId: WorkItemsStatusesStatusID!) {
        workItemUpdate(input: { id: $id statusWidget: { status: $statusId } }) {
          workItem {
            id
            widgets { type ... on WorkItemWidgetStatus { status { id name } } }
          }
          errors
        }
      }`;

    try {
      const data = await this.executeGraphQL(mutation, { id: workItemGlobalId, statusId: statusGlobalId }, true);
      const { workItem, errors } = data.workItemUpdate;
      if (errors?.length) throw new Error(errors[0]);
      const statusName = workItem.widgets.find(w => w.type === 'STATUS')?.status?.name;
      logger.info(`GitLab: Work item ${workItemGlobalId} → status "${statusName}"`);
      return workItem;
    } catch (error) {
      logger.error(`GitLab: Erreur updateWorkItemStatus ${workItemGlobalId}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les issues d'une itération filtrées par Version Prod (champ custom).
   * Utilise GraphQL pour lire les custom fields (non exposés par l'API REST).
   *
   * @param {number|string} projectId      - ID du projet GitLab
   * @param {string}        version        - Valeur du champ version (ex: "R06 - Pilot")
   * @param {number}        iterationId    - ID de l'itération (REST numeric id)
   * @returns {Array} Issues REST enrichies du filtre version
   */
  async getIssuesByVersionAndIteration(projectId, version, iterationId) {
    try {
      const allIssues = await this.getIssuesForIteration(projectId, iterationId);
      if (!allIssues.length) return [];

      // Requête GraphQL pour récupérer Version Prod de tous ces work items
      const ids = allIssues.map(i => `gid://gitlab/WorkItem/${i.id}`);
      const query = `
        query GetVersions($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on WorkItem {
              id
              widgets {
                ... on WorkItemWidgetCustomFields {
                  customFieldValues {
                    customField { id name }
                    ... on WorkItemSelectFieldValue { selectedOptions { value } }
                  }
                }
              }
            }
          }
        }`;

      const data = await this.executeGraphQL(query, { ids });
      const versionByGid = new Map();
      for (const node of (data.nodes || [])) {
        const cfWidget = node?.widgets?.find(w => Array.isArray(w.customFieldValues));
        const versionProd = cfWidget?.customFieldValues?.find(cf =>
          cf.customField?.name === 'Version Prod'
        );
        const val = versionProd?.selectedOptions?.[0]?.value || null;
        versionByGid.set(node.id, val);
      }

      const filtered = allIssues.filter(issue => {
        const gid = `gid://gitlab/WorkItem/${issue.id}`;
        return versionByGid.get(gid) === version;
      });

      logger.info(`GitLab: ${filtered.length}/${allIssues.length} issue(s) avec Version Prod="${version}" (project=${projectId})`);
      return filtered;
    } catch (error) {
      logger.error(`GitLab: Erreur getIssuesByVersionAndIteration:`, error.message);
      throw error;
    }
  }

  /**
   * Ajoute un commentaire (note) sur une issue GitLab
   *
   * @param {number|string} projectId - ID du projet GitLab
   * @param {number}        issueIid  - IID de l'issue (numéro #XXXX)
   * @param {string}        body      - Contenu du commentaire
   * @returns {Object} Note créée
   */
  async addIssueComment(projectId, issueIid, body) {
    try {
      const resp = await this.writeClient.post(
        `/projects/${projectId}/issues/${issueIid}/notes`,
        { body }
      );
      logger.info(`GitLab: Commentaire ajouté sur #${issueIid} (project=${projectId})`);
      return resp.data;
    } catch (error) {
      logger.error(`GitLab: Erreur addIssueComment #${issueIid}:`, error.message);
      throw error;
    }
  }

  /**
   * Récupère les issues d'un projet filtrées par Version Prod = version ET status Test TODO.
   * Utilisé en mode "version seule" quand aucune itération GitLab n'est disponible.
   *
   * @param {number|string} projectId - ID du projet GitLab
   * @param {string}        version   - Valeur du champ Version Prod (ex: "R06 - Pilot")
   * @returns {Array} Issues dont Version Prod = version ET Work Item status = Test TODO
   */
  async getIssuesByVersionOnly(projectId, version) {
    const todoStatusGid = process.env.GITLAB_STATUS_TODO || 'gid://gitlab/WorkItems::Statuses::Custom::Status/15';

    try {
      const allIssues = await this._getPaginated(
        `/projects/${projectId}/issues`,
        { state: 'opened', scope: 'all' }
      );
      if (!allIssues.length) return [];

      const ids = allIssues.map(i => `gid://gitlab/WorkItem/${i.id}`);
      const query = `
        query GetVersionsAndStatus($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on WorkItem {
              id
              widgets {
                type
                ... on WorkItemWidgetCustomFields {
                  customFieldValues {
                    customField { id name }
                    ... on WorkItemSelectFieldValue { selectedOptions { value } }
                  }
                }
                ... on WorkItemWidgetStatus {
                  status { id name }
                }
              }
            }
          }
        }`;

      const data = await this.executeGraphQL(query, { ids });
      const infoByGid = new Map();
      for (const node of (data.nodes || [])) {
        const cfWidget     = node?.widgets?.find(w => Array.isArray(w.customFieldValues));
        const statusWidget = node?.widgets?.find(w => w.type === 'STATUS');
        const versionProd  = cfWidget?.customFieldValues?.find(cf => cf.customField?.name === 'Version Prod');
        const versionVal   = versionProd?.selectedOptions?.[0]?.value || null;
        const statusGid    = statusWidget?.status?.id || null;
        infoByGid.set(node.id, { version: versionVal, statusGid });
      }

      const filtered = allIssues.filter(issue => {
        const gid  = `gid://gitlab/WorkItem/${issue.id}`;
        const info = infoByGid.get(gid);
        return info?.version === version && info?.statusGid === todoStatusGid;
      });

      logger.info(`GitLab: ${filtered.length}/${allIssues.length} issue(s) avec Version Prod="${version}" + status TODO (project=${projectId})`);
      return filtered;
    } catch (error) {
      logger.error(`GitLab: Erreur getIssuesByVersionOnly:`, error.message);
      throw error;
    }
  }

  /**
   * Convertit time_estimate (secondes) en format Testmo
   * Ex: 1800 → "30m", 3600 → "1h", 5400 → "1h 30m"
   *
   * @param {number} seconds - Durée en secondes depuis GitLab
   * @returns {string} Format Testmo (ex: "30m", "1h 30m")
   */
  static formatEstimate(seconds) {
    if (!seconds || seconds <= 0) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}

const instance = new GitLabService();
module.exports = instance;
module.exports.GitLabService = GitLabService;
