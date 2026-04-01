/**
 * ================================================
 * API SERVICE - Frontend
 * ================================================
 * Service pour communiquer avec le backend Express
 * 
 * @author Matou - Neo-Logix QA Lead
 */

import axios from 'axios';

// Configuration axios
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const API_TIMEOUT = 30000; // 30 secondes pour compenser le chargement des multiples jalons

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Intercepteur pour logging
apiClient.interceptors.request.use(
  config => {
    console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  response => {
    console.log(`[API] Response:`, response.status, response.data);
    return response;
  },
  error => {
    if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      return Promise.reject(error);
    }
    console.error('[API] Response error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * API Service
 */
const apiService = {
  /**
   * Health check du backend
   */
  async healthCheck() {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch (error) {
      throw this._handleError('Health Check', error);
    }
  },

  /**
   * Récupère la liste des projets
   */
  async getProjects() {
    try {
      const response = await apiClient.get('/projects');
      return response.data;
    } catch (error) {
      throw this._handleError('Get Projects', error);
    }
  },

  /**
   * Récupère les métriques ISTQB d'un projet
   * Endpoint principal du dashboard
   * 
   * @param {number} projectId - ID du projet
   */
  async getDashboardMetrics(projectId, preprodMilestones = null, prodMilestones = null, signal = null) {
    try {
      const params = {};
      if (preprodMilestones) params.preprodMilestones = preprodMilestones.join(',');
      if (prodMilestones) params.prodMilestones = prodMilestones.join(',');
      const config = { params };
      if (signal) config.signal = signal;
      const response = await apiClient.get(`/dashboard/${projectId}`, config);
      return response.data;
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') throw error;
      throw this._handleError('Get Dashboard Metrics', error);
    }
  },

  /**
   * Récupère les runs d'un projet
   * 
   * @param {number} projectId - ID du projet
   * @param {boolean} activeOnly - Uniquement runs actifs
   */
  async getProjectRuns(projectId, activeOnly = true) {
    try {
      const response = await apiClient.get(`/projects/${projectId}/runs`, {
        params: { active: activeOnly }
      });
      return response.data;
    } catch (error) {
      throw this._handleError('Get Project Runs', error);
    }
  },

  /**
   * Récupère les milestones d'un projet
   * 
   * @param {number} projectId - ID du projet
   */
  async getProjectMilestones(projectId) {
    try {
      const response = await apiClient.get(`/projects/${projectId}/milestones`);
      return response.data.data; // Le backend renvoie { success: true, data: { result: [...] } }
    } catch (error) {
      throw this._handleError('Get Project Milestones', error);
    }
  },

  /**
   * Récupère les détails d'un run
   * 
   * @param {number} runId - ID du run
   */
  async getRunDetails(runId) {
    try {
      const response = await apiClient.get(`/runs/${runId}`);
      return response.data;
    } catch (error) {
      throw this._handleError('Get Run Details', error);
    }
  },

  /**
   * Récupère les résultats d'un run
   * 
   * @param {number} runId - ID du run
   * @param {string} statusFilter - Filtrer par statut (ex: '3,5')
   */
  async getRunResults(runId, statusFilter = null) {
    try {
      const params = statusFilter ? { status: statusFilter } : {};
      const response = await apiClient.get(`/runs/${runId}/results`, { params });
      return response.data;
    } catch (error) {
      throw this._handleError('Get Run Results', error);
    }
  },

  /**
   * Récupère les runs d'automation
   * 
   * @param {number} projectId - ID du projet
   */
  async getAutomationRuns(projectId) {
    try {
      const response = await apiClient.get(`/projects/${projectId}/automation`);
      return response.data;
    } catch (error) {
      throw this._handleError('Get Automation Runs', error);
    }
  },

  /**
   * Récupère les tendances annuelles d'un projet
   * 
   * @param {number} projectId - ID du projet
   */
  async getAnnualTrends(projectId) {
    try {
      const response = await apiClient.get(`/dashboard/${projectId}/annual-trends`);
      return response.data;
    } catch (error) {
      throw this._handleError('Get Annual Trends', error);
    }
  },

  /**
   * Nettoie le cache backend
   */
  async clearCache() {
    try {
      const response = await apiClient.post('/cache/clear');
      return response.data;
    } catch (error) {
      throw this._handleError('Clear Cache', error);
    }
  },

  /**
   * Génère un rapport de clôture (HTML / PPTX)
   * ISTQB §5.4.2 Test Closure Report
   *
   * @param {Object} params - { projectId, milestoneId, formats: {html, pptx}, recommendations }
   */
  async generateReport(params) {
    try {
      const response = await apiClient.post('/reports/generate', params, { timeout: 120000 });
      return response.data;
    } catch (error) {
      throw this._handleError('Generate Report', error);
    }
  },

  // ---- Dashboard 6: Sync GitLab → Testmo --------------------------------

  /**
   * Récupère la liste des projets sync configurés
   * @returns {Promise<Array>} [{ id, label, configured }]
   */
  async getSyncProjects() {
    try {
      const response = await apiClient.get('/sync/projects');
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Sync Projects', error);
    }
  },

  /**
   * Recherche les itérations GitLab disponibles pour un projet
   * @param {string} projectId  - ID interne (ex: 'neo-pilot')
   * @param {string} search     - Terme de recherche (facultatif)
   * @returns {Promise<Array>} [{ id, title, state, web_url }]
   */
  async getSyncIterations(projectId, search = '') {
    try {
      const response = await apiClient.get(`/sync/${projectId}/iterations`, {
        params: search ? { search } : {}
      });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Sync Iterations', error);
    }
  },

  /**
   * Lance un aperçu (dry-run) de synchronisation
   * @param {string} projectId     - ID interne du projet
   * @param {string} iterationName - Nom de l'itération
   * @returns {Promise<Object>} { iteration, folder, issues, summary }
   */
  async previewSync(projectId, iterationName) {
    try {
      const response = await apiClient.post('/sync/preview', { projectId, iterationName }, { timeout: 60000 });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Preview Sync', error);
    }
  },

  /**
   * Récupère l'historique des synchronisations (50 derniers)
   * @returns {Promise<Array>}
   */
  async getSyncHistory() {
    try {
      const response = await apiClient.get('/sync/history');
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Sync History', error);
    }
  },

  // Note: la synchronisation réelle (execute) utilise EventSource (SSE) côté frontend,
  // pas axios. Voir Dashboard6.jsx → executeSyncSSE().

  // ---- Fin Dashboard 6 ---------------------------------------------------

  // ---- Dashboard 7: CrossTest OK ----------------------------------------

  /**
   * Liste les itérations GitLab du projet 63
   * @param {string} search - Terme de recherche facultatif
   * @returns {Promise<Array>} [{ id, title, state }]
   */
  async getCrosstestIterations(search = '') {
    try {
      const response = await apiClient.get('/crosstest/iterations', {
        params: search ? { search } : {}
      });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Crosstest Iterations', error);
    }
  },

  /**
   * Issues avec label CrossTest::OK pour une itération donnée
   * @param {number} iterationId - ID de l'itération GitLab
   * @returns {Promise<Array>} [{ iid, title, url, state, assignees, labels, ... }]
   */
  async getCrosstestIssues(iterationId) {
    try {
      const response = await apiClient.get(`/crosstest/issues/${iterationId}`);
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Crosstest Issues', error);
    }
  },

  /**
   * Récupère tous les commentaires CrossTest (indexés par issue_iid)
   * @returns {Promise<Object>} { [iid]: { comment, ... } }
   */
  async getCrosstestComments() {
    try {
      const response = await apiClient.get('/crosstest/comments');
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Crosstest Comments', error);
    }
  },

  /**
   * Crée ou met à jour un commentaire pour une issue
   * @param {number} iid               - Issue IID GitLab
   * @param {string} comment           - Texte du commentaire
   * @param {string} milestoneContext  - Nom de l'itération (ex: "R06")
   * @returns {Promise<Object>} La ligne enregistrée
   */
  async saveCrosstestComment(iid, comment, milestoneContext = null) {
    try {
      const response = await apiClient.post('/crosstest/comments', {
        issue_iid: iid,
        comment,
        milestone_context: milestoneContext
      });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Save Crosstest Comment', error);
    }
  },

  /**
   * Supprime le commentaire d'une issue
   * @param {number} iid - Issue IID GitLab
   * @returns {Promise<boolean>}
   */
  async deleteCrosstestComment(iid) {
    try {
      const response = await apiClient.delete(`/crosstest/comments/${iid}`);
      return response.data.deleted;
    } catch (error) {
      throw this._handleError('Delete Crosstest Comment', error);
    }
  },

  // ---- Fin Dashboard 7 ---------------------------------------------------

  /**
   * Gestion des erreurs
   * @private
   */
  _handleError(operation, error) {
    const errorMessage = error.response?.data?.error || error.message;
    console.error(`[API Service] ${operation} failed:`, errorMessage);

    return new Error(`${operation}: ${errorMessage}`);
  }
};

export default apiService;
