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
    this.projectId = process.env.GITLAB_PROJECT_ID;
    this.verifySsl = process.env.GITLAB_VERIFY_SSL !== 'false';
    this.timeout = parseInt(process.env.API_TIMEOUT) || 10000;

    // Délai entre requêtes API (rate-limit protection)
    this.apiDelay = 300;

    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v4`,
      timeout: this.timeout,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json'
      },
      // Support self-signed certificates (GitLab on-premise)
      ...(this.verifySsl === false && {
        httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
      })
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
