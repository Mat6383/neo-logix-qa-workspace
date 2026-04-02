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
   * Récupère toutes les pages d'un endpoint paginé
   */
  async _getPaginated(url, params = {}) {
    const results = [];
    params.per_page = 100;
    params.page = 1;

    while (true) {
      const resp = await this.client.get(url, { params });
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
      const searchTerm = iterationName.replace(/[-\s]+/g, ' ').trim();
      const searchPrefix = searchTerm.split(' ')[0];

      const iterations = await this._getPaginated(
        `/projects/${projectId}/iterations`,
        { search: searchPrefix, state: 'all' }
      );

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
      const params = { state: 'all', per_page: 50 };
      if (search) params.search = search;

      const iterations = await this._getPaginated(
        `/projects/${projectId}/iterations`,
        params
      );

      // Trier par titre décroissant (les plus récentes en premier)
      iterations.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
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

module.exports = new GitLabService();
