/**
 * ================================================
 * TESTMO SERVICE - API Integration
 * ================================================
 * Service responsable de toutes les interactions avec l'API Testmo
 *
 * Standards appliqués:
 * - ISTQB: Métriques de test standardisées
 * - ITIL: Gestion d'incidents et logging
 * - LEAN: Optimisation des requêtes et cache
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

const axios = require('axios');
const logger = require('./logger.service');

// ─── Standalone helpers (exportés pour tests) ───────────────────────────────

function _calculatePercentage(value, total) {
  if (!total || total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
}

function aggregateSessions(sessions) {
  const aggregated = {
    total: 0,
    passed: 0,
    failed: 0,
    completed: 0,
    success: 0,
    failure: 0,
    wip: 0,
  };

  sessions.forEach((session) => {
    const successCount = session.success_count || 0;
    const failureCount = session.failure_count || 0;
    const sessionTotal = successCount + failureCount;

    if (sessionTotal > 0) {
      aggregated.total += sessionTotal;
      aggregated.passed += successCount;
      aggregated.failed += failureCount;
      aggregated.completed += sessionTotal;
      aggregated.success += successCount;
      aggregated.failure += failureCount;
    } else {
      aggregated.total += 1;
      aggregated.wip += 1;
    }
  });

  return aggregated;
}

function globalMetrics(aggregated) {
  return {
    completionRate: _calculatePercentage(aggregated.completed, aggregated.total),
    passRate: _calculatePercentage(aggregated.passed, aggregated.completed),
    failureRate: _calculatePercentage(aggregated.failed, aggregated.completed),
    testEfficiency: _calculatePercentage(aggregated.passed, aggregated.passed + aggregated.failed),
  };
}

class TestmoService {
  constructor() {
    this.baseURL = process.env.TESTMO_URL;
    this.token = process.env.TESTMO_TOKEN;
    this.timeout = parseInt(process.env.API_TIMEOUT) || 10000;

    // Cache pour optimisation LEAN (éviter requêtes redondantes)
    this.cache = new Map();
    this.cacheDuration = parseInt(process.env.CACHE_DURATION) || 30000;

    // Configuration axios
    this.client = axios.create({
      baseURL: `${this.baseURL}/api/v1`,
      timeout: this.timeout,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    });

    // Intercepteur pour logging ITIL
    this.client.interceptors.response.use(
      (response) => {
        logger.info(`API Success: ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      (error) => {
        logger.error(`API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generic API GET — utilisé par le ReportService
   * @param {string} path - chemin relatif (ex: /projects/1/runs?limit=50)
   * @returns {Object} response.data
   */
  async apiGet(path) {
    const response = await this.client.get(path);
    return response.data;
  }

  /**
   * Récupère les projets disponibles
   * ISTQB: Test Project Scope
   */
  async getProjects() {
    const cacheKey = 'projects';

    // Cache LEAN
    if (this._isCacheValid(cacheKey)) {
      logger.info('Cache hit: projects');
      return this.cache.get(cacheKey).data;
    }

    try {
      const response = await this._withRetry(
        () =>
          this.client.get('/projects', {
            params: { per_page: 100, sort: 'projects:created_at', order: 'desc' },
          }),
        'getProjects'
      );
      this._setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this._handleError('getProjects', error);
    }
  }

  /**
   * Récupère les runs actifs d'un projet
   * ISTQB Section 5.3: Test Monitoring
   *
   * @param {number} projectId - ID du projet
   * @param {boolean} activeOnly - Uniquement runs actifs
   */
  async getProjectRuns(projectId, activeOnly = true) {
    const cacheKey = `runs_${projectId}_${activeOnly}`;

    if (this._isCacheValid(cacheKey)) {
      logger.info(`Cache hit: runs for project ${projectId}`);
      return this.cache.get(cacheKey).data;
    }

    try {
      const response = await this._withRetry(
        () =>
          this.client.get(`/projects/${projectId}/runs`, {
            params: {
              is_closed: activeOnly ? 0 : undefined,
              per_page: 100,
              sort: 'runs:created_at',
              order: 'desc',
              expands: 'users,milestones,configs',
            },
          }),
        'getProjectRuns'
      );
      this._setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this._handleError('getProjectRuns', error);
    }
  }

  /**
   * Récupère les sessions exploratoires d'un projet
   *
   * @param {number} projectId - ID du projet
   * @param {boolean} activeOnly - Uniquement sessions actives
   */
  async getProjectSessions(projectId, activeOnly = true) {
    const cacheKey = `sessions_${projectId}_${activeOnly}`;

    if (this._isCacheValid(cacheKey)) {
      logger.info(`Cache hit: sessions for project ${projectId}`);
      return this.cache.get(cacheKey).data;
    }

    try {
      const response = await this._withRetry(
        () =>
          this.client.get(`/projects/${projectId}/sessions`, {
            params: {
              is_closed: activeOnly ? 0 : undefined,
              per_page: 100,
              sort: 'sessions:created_at',
              order: 'desc',
              expands: 'users,milestones',
            },
          }),
        'getProjectSessions'
      );

      this._setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this._handleError('getProjectSessions', error);
    }
  }

  /**
   * Récupère les détails d'un run spécifique
   * ISTQB Section 5.4: Test Reporting
   *
   * @param {number} runId - ID du run
   */
  async getRunDetails(runId) {
    try {
      const response = await this._withRetry(
        () =>
          this.client.get(`/runs/${runId}`, {
            params: { expands: 'users,milestones,configs,issues' },
          }),
        'getRunDetails'
      );

      return response.data.result;
    } catch (error) {
      throw this._handleError('getRunDetails', error);
    }
  }

  /**
   * Récupère les milestones d'un projet
   *
   * @param {number} projectId - ID du projet
   */
  async getProjectMilestones(projectId) {
    const cacheKey = `milestones_${projectId}`;

    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      const response = await this._withRetry(
        () =>
          this.client.get(`/projects/${projectId}/milestones`, {
            params: { per_page: 100, sort: 'milestones:created_at', order: 'desc' },
          }),
        'getProjectMilestones'
      );

      this._setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this._handleError('getProjectMilestones', error);
    }
  }

  /**
   * Récupère les résultats détaillés d'un run
   * API 2025: Nouveau endpoint /runs/{id}/results
   *
   * @param {number} runId - ID du run
   * @param {string} statusFilter - Filtrer par statut (ex: '3,5' pour Failed + Blocked)
   */
  async getRunResults(runId, statusFilter = null) {
    try {
      const params = {
        per_page: 100,
        expands: 'users,issues',
      };

      if (statusFilter) {
        params.status_id = statusFilter;
      }

      const response = await this._withRetry(
        () => this.client.get(`/runs/${runId}/results`, { params }),
        'getRunResults'
      );
      return response.data;
    } catch (error) {
      throw this._handleError('getRunResults', error);
    }
  }

  async getAllRunResults(runId) {
    try {
      const allResults = [];
      let page = 1;
      while (true) {
        const response = await this._withRetry(
          () =>
            this.client.get(`/runs/${runId}/results`, {
              params: { per_page: 100, page, expands: 'users' },
            }),
          `getAllRunResults_p${page}`
        );
        const batch = response.data.result || [];
        allResults.push(...batch);
        if (!response.data.next_page) break;
        page++;
      }
      return allResults;
    } catch (error) {
      throw this._handleError('getAllRunResults', error);
    }
  }

  async createRun(projectId, { name, description = '', milestoneId = null, caseIds = [] }) {
    try {
      const run = { name };
      if (description) run.description = description;
      if (milestoneId) run.milestone_id = milestoneId;
      if (caseIds.length > 0) run.case_ids = caseIds;
      const response = await this.client.post(`/projects/${projectId}/runs`, { runs: [run] });
      const created = response.data.result ? response.data.result[0] : response.data;
      logger.info(`Testmo: Run créé — "${name}" (id=${created.id}, cases=${caseIds.length})`);
      return created;
    } catch (error) {
      throw this._handleError('createRun', error);
    }
  }

  async updateRunCaseIds(runId, caseIds) {
    try {
      const response = await this.client.patch(`/runs/${runId}`, {
        runs: [{ case_ids: caseIds }],
      });
      logger.info(`Testmo: Run ${runId} — case_ids mis à jour (${caseIds.length} cas)`);
      return response.data;
    } catch (error) {
      throw this._handleError('updateRunCaseIds', error);
    }
  }

  /**
   * Récupère les runs d'automation
   * ISTQB: Automated Test Execution
   *
   * @param {number} projectId - ID du projet
   */
  async getAutomationRuns(projectId) {
    const cacheKey = `automation_${projectId}`;

    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      const response = await this._withRetry(
        () =>
          this.client.get(`/projects/${projectId}/automation/runs`, {
            params: {
              per_page: 100,
              sort: 'automation_runs:created_at',
              order: 'desc',
              expands: 'users,milestones',
            },
          }),
        'getAutomationRuns'
      );

      this._setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      throw this._handleError('getAutomationRuns', error);
    }
  }

  /**
   * Gestion du cache LEAN
   * @private
   */
  _isCacheValid(key) {
    if (!this.cache.has(key)) return false;

    const cached = this.cache.get(key);
    const age = Date.now() - cached.timestamp;

    return age < this.cacheDuration;
  }

  /**
   * Stocke en cache
   * @private
   */
  _setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now(),
    });
  }

  /**
   * Nettoie le cache (appel manuel si besoin)
   */
  // ============================================================
  // REPOSITORY API — Folders & Cases (Beta)
  // ============================================================

  /**
   * Liste les folders d'un projet, optionnellement filtrés par parent_id
   * API: GET /projects/:id/folders
   *
   * @param {number} projectId
   * @param {number|null} parentId - Filtrer par dossier parent
   * @returns {Array} Liste des folders
   */
  async getFolders(projectId, parentId = null) {
    try {
      const params = { per_page: 100 };
      if (parentId !== null) {
        params.parent_id = parentId;
      }
      const response = await this._withRetry(
        () => this.client.get(`/projects/${projectId}/folders`, { params }),
        'getFolders'
      );
      return response.data.result || [];
    } catch (error) {
      throw this._handleError('getFolders', error);
    }
  }

  /**
   * Recherche un folder par nom sous un parent donné
   *
   * @param {number} projectId
   * @param {string} folderName
   * @param {number|null} parentId
   * @returns {Object|null} Le folder trouvé ou null
   */
  async findFolder(projectId, folderName, parentId = null) {
    const folders = await this.getFolders(projectId, parentId);
    return folders.find((f) => f.name === folderName) || null;
  }

  /**
   * Crée un folder dans le repository
   * API: POST /projects/:id/folders
   *
   * @param {number} projectId
   * @param {string} name - Nom du folder
   * @param {number|null} parentId - ID du folder parent (null = racine)
   * @returns {Object} Le folder créé
   */
  async createFolder(projectId, name, parentId = null) {
    try {
      const payload = { folders: [{ name }] };
      if (parentId !== null) {
        payload.folders[0].parent_id = parentId;
      }
      const response = await this.client.post(`/projects/${projectId}/folders`, payload);
      const created = response.data.result ? response.data.result[0] : response.data;
      logger.info(`Testmo: Folder créé — "${name}" (id=${created.id}, parent=${parentId})`);
      return created;
    } catch (error) {
      throw this._handleError('createFolder', error);
    }
  }

  /**
   * Récupère ou crée un folder (idempotent)
   *
   * @param {number} projectId
   * @param {string} name
   * @param {number|null} parentId
   * @returns {Object} Le folder existant ou créé
   */
  async getOrCreateFolder(projectId, name, parentId = null) {
    const existing = await this.findFolder(projectId, name, parentId);
    if (existing) {
      logger.info(`Testmo: Folder existant — "${name}" (id=${existing.id})`);
      return existing;
    }
    return this.createFolder(projectId, name, parentId);
  }

  /**
   * Supprime des folders par IDs
   * API: DELETE /projects/:id/folders
   *
   * @param {number} projectId
   * @param {Array<number>} folderIds
   */
  async deleteFolders(projectId, folderIds) {
    try {
      const response = await this.client.delete(`/projects/${projectId}/folders`, {
        data: { ids: folderIds },
      });
      logger.info(`Testmo: ${folderIds.length} folder(s) supprimé(s)`);
      return response.data;
    } catch (error) {
      throw this._handleError('deleteFolders', error);
    }
  }

  /**
   * Liste les cases d'un projet, optionnellement filtrés par folder_id
   * API: GET /projects/:id/cases
   *
   * @param {number} projectId
   * @param {number|null} folderId - Filtrer par folder
   * @param {string|null} expands - Champs à étendre (ex: "tags,issues")
   * @returns {Array} Liste des cases
   */
  async getCases(projectId, folderId = null, expands = 'tags') {
    try {
      const allCases = [];
      let page = 1;

      while (true) {
        const params = { per_page: 100, page };
        if (folderId !== null) params.folder_id = folderId;
        if (expands) params.expands = expands;

        const response = await this._withRetry(
          () => this.client.get(`/projects/${projectId}/cases`, { params }),
          `getCases_p${page}`
        );
        const batch = response.data.result || [];
        if (batch.length === 0) break;
        allCases.push(...batch);

        if (!response.data.next_page) break;
        page++;
      }

      return allCases;
    } catch (error) {
      throw this._handleError('getCases', error);
    }
  }

  /**
   * Recherche un case par tag (idempotence via gitlab-IID)
   * Note: L'API Testmo retourne les tags comme IDs numériques,
   * donc on utilise le nom du case comme fallback pour l'idempotence.
   *
   * @param {number} projectId
   * @param {string} tag - Ex: "gitlab-123" (utilisé comme fallback pattern dans le nom)
   * @param {number|null} folderId - Restreindre la recherche à un folder
   * @returns {Object|null} Le case trouvé ou null
   */
  async findCaseByTag(_projectId, _tag, _folderId = null) {
    // L'API retourne tags comme IDs numériques — impossible de matcher par nom de tag
    // Délégué à findCaseByName (titre GitLab = nom unique dans le folder)
    return null;
  }

  /**
   * Recherche un case par nom exact dans un folder
   * Stratégie d'idempotence principale (le titre GitLab = name Testmo)
   *
   * @param {number} projectId
   * @param {string} name - Nom exact du case
   * @param {number|null} folderId - Folder de recherche
   * @returns {Object|null}
   */
  async findCaseByName(projectId, name, folderId = null) {
    const cases = await this.getCases(projectId, folderId);
    return cases.find((c) => c.name === name) || null;
  }

  /**
   * Crée un test case
   * API: POST /projects/:id/cases
   *
   * @param {number} projectId
   * @param {Object} caseData - { name, folder_id, tags, custom_description, estimate, ... }
   * @returns {Object} Le case créé
   */
  async createCase(projectId, caseData) {
    try {
      if (caseData.custom_steps) {
        logger.info(
          `Testmo: createCase payload custom_steps: ${JSON.stringify(caseData.custom_steps).substring(0, 500)}`
        );
      }
      const response = await this.client.post(`/projects/${projectId}/cases`, {
        cases: [caseData],
      });
      const created = response.data.result ? response.data.result[0] : response.data;
      if (created?.custom_steps) {
        logger.info(
          `Testmo: Case créé — steps retournés: ${JSON.stringify(created.custom_steps).substring(0, 300)}`
        );
      }
      logger.info(`Testmo: Case créé — "${caseData.name}" (id=${created.id})`);
      return created;
    } catch (error) {
      throw this._handleError('createCase', error);
    }
  }

  /**
   * Met à jour un test case existant
   * API: PATCH /projects/:id/cases
   *
   * @param {number} projectId
   * @param {number} caseId
   * @param {Object} caseData - Champs à mettre à jour
   * @returns {Object} Résultat de la mise à jour
   */
  async updateCase(projectId, caseId, caseData) {
    try {
      const payload = { ...caseData, ids: [caseId] };
      const response = await this.client.patch(`/projects/${projectId}/cases`, payload);
      logger.info(`Testmo: Case mis à jour — id=${caseId}`);
      return response.data;
    } catch (error) {
      throw this._handleError('updateCase', error);
    }
  }

  /**
   * Vérifie si un case Testmo a été enrichi manuellement
   * Critères : estimate rempli, issues liées, tags ajoutés,
   * priority != Normal, attachments, ou au moins 1 step
   *
   * @param {Object} testCase - Le case Testmo complet
   * @returns {boolean} true si enrichi (ne pas écraser)
   */
  isCaseEnriched(testCase) {
    if (testCase.estimate && testCase.estimate > 0) return true;
    if (testCase.issues && testCase.issues.length > 0) return true;

    // Tags : ignorer les tags auto (gitlab-#, iteration:, sync-auto)
    const manualTags = (testCase.tags || []).filter((t) => {
      const name = typeof t === 'string' ? t : t.name || t.tag || '';
      if (!name) return false;
      return !name.startsWith('gitlab-') && !name.startsWith('iteration-') && name !== 'sync-auto';
    });
    if (manualTags.length > 0) return true;

    if (
      testCase.custom_priority &&
      testCase.custom_priority !== 'Normal' &&
      testCase.custom_priority !== 2
    )
      return true;
    if (testCase.attachments && testCase.attachments.length > 0) return true;
    // Ne compter que les steps avec du contenu réel (format Testmo: text1 = contenu du step)
    const nonEmptySteps = (testCase.custom_steps || []).filter((s) => {
      const content =
        typeof s === 'object' ? s.text1 || s.step || s.content || '' : String(s || '');
      return content.trim().length > 0;
    });
    if (nonEmptySteps.length > 0) return true;

    return false;
  }

  clearCache() {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Retry avec backoff exponentiel (ITIL Resilience Management)
   * Réessaie automatiquement sur erreurs réseau ou 5xx Testmo.
   *
   * @param {Function} fn        - Fonction async à exécuter
   * @param {string}   label     - Nom de l'opération (pour les logs)
   * @param {number}   maxRetries - Nombre maximum de tentatives (défaut 3)
   * @param {number}   baseDelay  - Délai de base en ms (défaut 500)
   * @returns {Promise<*>}
   * @private
   */
  async _withRetry(fn, label = 'unknown', maxRetries = 3, baseDelay = 500) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        // Ne pas réessayer sur les erreurs client 4xx (sauf 429 rate-limit)
        const isRetryable =
          !status ||
          status === 429 ||
          status >= 500 ||
          err.code === 'ECONNRESET' ||
          err.code === 'ETIMEDOUT' ||
          err.code === 'ENOTFOUND';
        if (!isRetryable || attempt === maxRetries) break;
        const delay = baseDelay * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
        logger.warn(
          `[Retry] ${label} — tentative ${attempt}/${maxRetries} échouée (${err.message}), nouvel essai dans ${delay}ms`
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }

  /**
   * Gestion d'erreurs ITIL Incident Management
   * @private
   */
  _handleError(method, error) {
    const incident = {
      method: method,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString(),
    };

    logger.error(`Testmo Service Error in ${method}:`, incident);

    // Erreurs spécifiques
    if (error.response?.status === 401) {
      return new Error('Authentification Testmo échouée - Vérifier le token API');
    } else if (error.response?.status === 403) {
      return new Error('Permissions insuffisantes pour accéder à cette ressource');
    } else if (error.response?.status === 404) {
      return new Error('Ressource Testmo non trouvée');
    } else if (error.response?.status === 429) {
      return new Error('Rate limit atteint - Trop de requêtes API');
    }

    return new Error(`Erreur API Testmo: ${error.message}`);
  }
}

const testmoService = new TestmoService();

module.exports = testmoService;
module.exports._calculatePercentage = _calculatePercentage;
module.exports.aggregateSessions = aggregateSessions;
module.exports.globalMetrics = globalMetrics;
// isCaseEnriched est déjà accessible via TestmoService.prototype sur l'instance exportée
