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
  async getDashboardMetrics(projectId, preprodMilestones = null, prodMilestones = null) {
    try {
      const params = {};
      if (preprodMilestones) params.preprodMilestones = preprodMilestones.join(',');
      if (prodMilestones) params.prodMilestones = prodMilestones.join(',');
      const response = await apiClient.get(`/dashboard/${projectId}`, { params });
      return response.data;
    } catch (error) {
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
