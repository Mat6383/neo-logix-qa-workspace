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
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    // Intercepteur pour logging ITIL
    this.client.interceptors.response.use(
      response => {
        logger.info(`API Success: ${response.config.method.toUpperCase()} ${response.config.url}`);
        return response;
      },
      error => {
        logger.error(`API Error: ${error.response?.status} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data
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
        () => this.client.get('/projects', {
          params: { per_page: 100, sort: 'projects:created_at', order: 'desc' }
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
        () => this.client.get(`/projects/${projectId}/runs`, {
          params: {
            is_closed: activeOnly ? 0 : undefined,
            per_page: 100,
            sort: 'runs:created_at',
            order: 'desc',
            expands: 'users,milestones,configs'
          }
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
      const response = await this.client.get(`/projects/${projectId}/sessions`, {
        params: {
          is_closed: activeOnly ? 0 : undefined,
          per_page: 100,
          sort: 'sessions:created_at',
          order: 'desc',
          expands: 'users,milestones'
        }
      });

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
      const response = await this.client.get(`/runs/${runId}`, {
        params: {
          expands: 'users,milestones,configs,issues'
        }
      });

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
      const response = await this.client.get(`/projects/${projectId}/milestones`, {
        params: {
          per_page: 100,
          sort: 'milestones:created_at',
          order: 'desc'
        }
      });

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
        expands: 'users,issues'
      };

      if (statusFilter) {
        params.status_id = statusFilter;
      }

      const response = await this.client.get(`/runs/${runId}/results`, { params });
      return response.data;

    } catch (error) {
      throw this._handleError('getRunResults', error);
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
      const response = await this.client.get(`/projects/${projectId}/automation/runs`, {
        params: {
          per_page: 100,
          sort: 'automation_runs:created_at',
          order: 'desc',
          expands: 'users,milestones'
        }
      });

      this._setCache(cacheKey, response.data);
      return response.data;

    } catch (error) {
      throw this._handleError('getAutomationRuns', error);
    }
  }

  /**
   * Agrège les métriques ISTQB pour un projet
   * ISTQB Section 5.4.2: Test Summary Report
   * 
   * @param {number} projectId - ID du projet
   * @returns {Object} Métriques ISTQB complètes
   */
  async getProjectMetrics(projectId, preprodMilestones = null, prodMilestones = null) {
    try {
      // Récupérer les runs actifs
      const runsData = await this.getProjectRuns(projectId, true);
      let runs = runsData.result || [];

      // Si sélection manuelle de jalons de préprod / prod
      if (preprodMilestones && preprodMilestones.length > 0) {
        try {
          // On récupère les runs (actifs et fermés) associés aux milestones
          const runPromises = [];
          for (const mId of preprodMilestones) {
            runPromises.push(this.client.get(`/projects/${projectId}/runs`, { params: { milestone_id: mId, is_closed: 0, per_page: 100, expands: 'users,milestones,configs' } }));
            runPromises.push(this.client.get(`/projects/${projectId}/runs`, { params: { milestone_id: mId, is_closed: 1, per_page: 100, expands: 'users,milestones,configs' } }));
          }
          const allRunsData = await Promise.all(runPromises);

          runs = [];
          allRunsData.forEach(resp => {
            if (resp.data.result) {
              runs = runs.concat(resp.data.result);
            }
          });
          logger.info(`[getProjectMetrics] Récupération de ${runs.length} runs pour les jalons ${preprodMilestones.join(', ')}`);

        } catch (e) {
          logger.error(`Erreur lors de la récupération des runs filtrés par jalon:`, e);
        }
      }

      // --- SESSIONS EXPLORATOIRES ---
      let sessions = [];
      try {
        const sessionsData = await this.getProjectSessions(projectId, false); // All sessions to filter later
        sessions = sessionsData.result || [];

        // Filtrer par milestone si renseigné
        if (preprodMilestones && preprodMilestones.length > 0) {
          sessions = sessions.filter(s => preprodMilestones.includes(s.milestone_id));
        } else {
          // Par défaut, on ne garde que les actives si pas de milestone
          sessions = sessions.filter(s => !s.is_closed);
        }

        logger.info(`[getProjectMetrics] RÃ©cupÃ©ration de ${sessions.length} sessions exploratoires`);
      } catch (e) {
        logger.error(`Erreur lors de la récupération des sessions exploratoires:`, e);
      }

      // Fetch dynamic TV metrics (Closed Runs & Milestones)
      const [closedRunsResponse, milestonesResponse] = await Promise.all([
        this.client.get(`/projects/${projectId}/runs`, { params: { is_closed: 1, per_page: 100 } }).catch(() => ({ data: { total: 0 } })),
        this.client.get(`/projects/${projectId}/milestones`, { params: { per_page: 100 } }).catch(() => ({ data: { result: [] } }))
      ]);

      const closedRunsCount = closedRunsResponse.data.total || 0;
      const milestones = milestonesResponse.data.result || [];
      const milestonesTotal = milestones.length || 1; // avoid division by zero
      const milestonesCompleted = milestones.filter(m => m.is_completed).length;

      if (runs.length === 0 && sessions.length === 0) {
        logger.warn(`No active runs or sessions found for project ${projectId}`);
        return this._getEmptyMetrics();
      }

      // Agrégation des métriques (runs + sessions)
      const aggregated = runs.reduce((acc, run) => ({
        total: acc.total + (run.total_count || 0),
        untested: acc.untested + (run.untested_count || 0),
        passed: acc.passed + (run.status1_count || 0),
        failed: acc.failed + (run.status2_count || 0),
        retest: acc.retest + (run.status3_count || 0),
        blocked: acc.blocked + (run.status4_count || 0),
        skipped: acc.skipped + (run.status5_count || 0),
        wip: acc.wip + (run.status7_count || 0),
        completed: acc.completed + (run.completed_count || 0),
        success: acc.success + (run.success_count || 0),
        failure: acc.failure + (run.failure_count || 0)
      }), {
        total: 0, untested: 0, passed: 0, failed: 0,
        retest: 0, blocked: 0, skipped: 0, wip: 0,
        completed: 0, success: 0, failure: 0
      });

      // Ajout des sessions exploratoires dans la répartition globale
      // Les sessions utilisent "state_id" (custom) et non "status_id" — on utilise
      // donc success_count/failure_count pour ajouter les vrais résultats de test.
      sessions.forEach(session => {
        const successCount = session.success_count || 0;
        const failureCount = session.failure_count || 0;
        const sessionTotal = successCount + failureCount;

        if (sessionTotal > 0) {
          // Session avec résultats : on ajoute les vrais compteurs
          aggregated.total     += sessionTotal;
          aggregated.passed    += successCount;
          aggregated.failed    += failureCount;
          aggregated.completed += sessionTotal;
          aggregated.success   += successCount;
          aggregated.failure   += failureCount;
        } else {
          // Session sans résultat encore → comptée comme 1 WIP
          aggregated.total += 1;
          aggregated.wip   += 1;
        }
      });

      // Dynamic ITIL-like calculations based on real run data
      const leadTime = Math.round(runs.reduce((acc, r) => acc + (Date.now() - new Date(r.created_at).getTime()) / (1000 * 3600), 0) / (runs.length || 1) * 10) / 10;
      const mttr = Math.round(leadTime * (aggregated.failed / (aggregated.passed || 1)) * 10) / 10;

      // Calculs ISTQB
      const resultMetrics = {
        // Données brutes
        raw: aggregated,

        // KPIs ISTQB
        completionRate: this._calculatePercentage(aggregated.completed, aggregated.total),
        passRate: this._calculatePercentage(aggregated.passed, aggregated.completed),
        failureRate: this._calculatePercentage(aggregated.failed, aggregated.completed),
        blockedRate: this._calculatePercentage(aggregated.blocked, aggregated.total),
        skippedRate: this._calculatePercentage(aggregated.skipped, aggregated.total),

        // Métriques dérivées
        testEfficiency: this._calculatePercentage(
          aggregated.passed,
          aggregated.passed + aggregated.failed
        ),

        // Distribution par statut (pour graphiques)
        statusDistribution: {
          labels: ['Passed', 'Failed', 'Retest', 'Blocked', 'Skipped', 'Untested', 'WIP'],
          values: [
            aggregated.passed,
            aggregated.failed,
            aggregated.retest,
            aggregated.blocked,
            aggregated.skipped,
            aggregated.untested,
            aggregated.wip
          ],
          colors: ['#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#6B7280', '#9CA3AF', '#3B82F6']
        },

        // Runs + Sessions détails
        runsCount: runs.length + sessions.length,
        runs: [
          ...runs.map(run => ({
            id: run.id,
            name: run.name,
            total: run.total_count || 0,
            completed: run.completed_count || 0,
            passed: run.status1_count || 0,
            failed: run.status2_count || 0,
            blocked: run.status4_count || 0,
            wip: run.status7_count || 0,
            untested: run.untested_count || 0,
            completionRate: this._calculatePercentage(run.completed_count, run.total_count),
            passRate: this._calculatePercentage(run.status1_count, run.completed_count),
            created_at: run.created_at,
            milestone: run.milestone_id,
            isExploratory: false
          })),
          ...sessions.map(session => {
            // Progression:
            // 1. Si session fermée (is_closed), progression = 100%
            // 2. Si session "libre" (total=0) mais avec au moins un résultat décisif, progression = 100%
            // 3. Sinon, ratio classique (exécutés / total)
            // Note: les sessions utilisent "state_id" (custom), pas "status_id"
            const isTerminal = !!session.is_closed;
            const total = session.total_count || 0;
            const executed = (session.status1_count || 0) + (session.status2_count || 0) + (session.status4_count || 0) + (session.status5_count || 0);
            
            let completionRate = 0;
            // Règle Sophie : si au moins un résultat décisif existe (Passed, Failed, Blocked, Skipped),
            // on considère la progression à 100% (on ignore les logs de type 'note' dans le total).
            if (isTerminal || executed > 0) {
              completionRate = 100;
            } else if (total > 0) {
              completionRate = this._calculatePercentage(executed, total);
            }

            // Pass rate: success_count / (success_count + failure_count)
            // Compteurs cumulatifs (retests inclus) — seule donnée fiable pour les sessions.
            const successCount = session.success_count || 0;
            const failureCount = session.failure_count || 0;
            const sessionPassRate = this._calculatePercentage(successCount, successCount + failureCount);

            return {
              id: `session-${session.id}`,
              name: session.name,
              total: total,
              completed: executed,
              passed: session.status1_count || 0,
              failed: session.status2_count || 0,
              blocked: session.status4_count || 0,
              wip: session.status7_count || 0,
              untested: session.untested_count || 0,
              completionRate: completionRate,
              passRate: sessionPassRate,
              state_id: session.state_id,
              created_at: session.created_at,
              milestone: session.milestone_id,
              isExploratory: true,
              isClosed: !!session.is_closed
            };
          })
        ],

        // Timestamp pour cache
        timestamp: new Date().toISOString(),

        // --- Extended KPIs for TV Mode ---
        itil: {
          mttr: mttr,
          mttrTarget: 72,
          leadTime: leadTime,
          leadTimeTarget: 120,
          changeFailRate: this._calculatePercentage(aggregated.failed, aggregated.completed),
          changeFailRateTarget: 20
        },
        lean: {
          wipTotal: aggregated.wip,
          wipTarget: 20,
          activeRuns: runs.length,
          closedRuns: closedRunsCount
        },
        istqb: {
          avgPassRate: this._calculatePercentage(aggregated.passed, aggregated.completed),
          passRateTarget: 80,
          milestonesCompleted: milestonesCompleted,
          milestonesTotal: milestonesTotal,
          blockRate: this._calculatePercentage(aggregated.blocked, aggregated.total),
          blockRateTarget: 5
        }
      };

      // Trier par date de création décroissante
      resultMetrics.runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Vérification SLA ITIL
      resultMetrics.slaStatus = this._checkSLA(resultMetrics);

      return resultMetrics;

    } catch (error) {
      throw this._handleError('getProjectMetrics', error);
    }
  }

  /**
   * Calcule le Taux d'Échappement et le Taux de Détection
   * ISTQB: Escape Rate & Defect Detection Percentage (DDP)
   */
  async getEscapeAndDetectionRates(projectId, preprodMilestones = null, prodMilestones = null) {
    try {
      // --- LOGIQUE CONFIGURABLE (Si des jalons sont explicitement sélectionnés) ---
      if ((preprodMilestones && preprodMilestones.length > 0) || (prodMilestones && prodMilestones.length > 0)) {

        let allRuns = [];
        try {
          // Identifier tous les jalons requis (uniques)
          const requiredMilestones = [...new Set([
            ...(preprodMilestones || []),
            ...(prodMilestones || [])
          ])];

          // Récupérer les runs et sessions (actifs et fermés) associés à tous ces milestones
          const runPromises = [];
          const sessionPromises = [];
          for (const mId of requiredMilestones) {
            runPromises.push(this.client.get(`/projects/${projectId}/runs`, { params: { milestone_id: mId, is_closed: 0, per_page: 100, expands: 'users,milestones,configs' } }));
            runPromises.push(this.client.get(`/projects/${projectId}/runs`, { params: { milestone_id: mId, is_closed: 1, per_page: 100, expands: 'users,milestones,configs' } }));
            sessionPromises.push(this.client.get(`/projects/${projectId}/sessions`, { params: { milestone_id: mId, is_closed: 0, per_page: 100 } }));
            sessionPromises.push(this.client.get(`/projects/${projectId}/sessions`, { params: { milestone_id: mId, is_closed: 1, per_page: 100 } }));
          }
          const [allRunsData, allSessionsData] = await Promise.all([
            Promise.all(runPromises),
            Promise.all(sessionPromises)
          ]);

          allRunsData.forEach(resp => {
            if (resp.data.result) {
              allRuns = allRuns.concat(resp.data.result);
            }
          });

          let allSessions = [];
          allSessionsData.forEach(resp => {
            if (resp.data.result) {
              allSessions = allSessions.concat(resp.data.result);
            }
          });

          // Filtrer les doublons
          allRuns = Array.from(new Map(allRuns.map(item => [item.id, item])).values());
          allSessions = Array.from(new Map(allSessions.map(item => [item.id, item])).values());
          
          logger.info(`[getEscapeAndDetectionRates] Récupération unique de ${allRuns.length} runs et ${allSessions.length} sessions pour les jalons ${requiredMilestones.join(', ')}`);
          
          // Stocker temporairement les sessions pour les utiliser plus bas
          this._tempSessions = allSessions;
        } catch (e) {
          logger.error(`Erreur récupération Quality Rates runs/sessions spécifiques:`, e);
        }

        let preprodRuns = [];
        let prodRuns = [];

        // Gestion de la Préproduction manuelle
        if (preprodMilestones && preprodMilestones.length > 0) {
          preprodRuns = allRuns.filter(r => preprodMilestones.includes(r.milestone_id));
        } else {
          // Fallback (fonctionnement par défaut) pour la Préproduction si non configurée
          const latestMiles = [...new Set(allRuns.filter(r => r.milestone_id).map(r => r.milestone_id))].slice(0, 3);
          if (latestMiles.length > 0) {
            preprodRuns = allRuns.filter(r => r.milestone_id === latestMiles[0]);
          }
        }

        // Gestion de la Production manuelle
        if (prodMilestones && prodMilestones.length > 0) {
          const isProdRunFn = (runName) => {
            const name = runName.toLowerCase();
            return name.includes('patch') || name.includes('retour de prod') || name.includes('retour') || name.includes('prod');
          };
          prodRuns = allRuns.filter(r => prodMilestones.includes(r.milestone_id) && isProdRunFn(r.name));
        } else {
          // Fallback (fonctionnement par défaut) pour la Production si non configurée
          const isProdRunFn = (runName) => {
            const name = runName.toLowerCase();
            return name.includes('patch') || name.includes('retour de prod') || name.includes('retour') || name.includes('prod');
          };
          const latestMiles = [...new Set(allRuns.filter(r => r.milestone_id).map(r => r.milestone_id))];

          // Cherche la dernière production dans les jalons actuels/précédents
          for (let i = 0; i < latestMiles.length; i++) {
            const milestoneRuns = allRuns.filter(r => r.milestone_id === latestMiles[i]);
            const prodInMilestone = milestoneRuns.filter(r => isProdRunFn(r.name));
            if (prodInMilestone.length > 0) {
              prodRuns = prodInMilestone;
              break;
            }
          }
        }

        if (preprodRuns.length === 0 || prodRuns.length === 0) {
          return {
            escapeRate: 0, detectionRate: 0, bugsInProd: 0, bugsInTest: 0, totalBugs: 0,
            preprodMilestone: 'Sélection incomplète', prodMilestone: 'Sélection incomplète',
            message: 'Impossible de trouver des runs pour l\'un des environnements.'
          };
        }

        // Bugs en TEST = failures in preprod runs + exploratory sessions
        let bugsInTest = 0;
        for (const run of preprodRuns) {
          bugsInTest += (run.status2_count || 0);
        }

        // Ajouter les erreurs des sessions exploratoires associées aux jalons de préprod
        if (this._tempSessions && preprodMilestones) {
          const preprodSessions = this._tempSessions.filter(s => preprodMilestones.includes(s.milestone_id));
          for (const session of preprodSessions) {
            bugsInTest += (session.status2_count || 0);
          }
        }
        delete this._tempSessions;

        // Bugs en PROD = issues in prod runs
        let bugsInProd = 0;
        for (const run of prodRuns) {
          try {
            const runDetails = run.issues ? run : await this.getRunDetails(run.id);
            if (runDetails.issues && runDetails.issues.length > 0) {
              bugsInProd += runDetails.issues.length;
            } else {
              const results = await this.client.get(`/runs/${run.id}/results`, { params: { expands: 'issues' } });
              const failedResultsWithIssues = (results.data.result || []).filter(res => res.issues && res.issues.length > 0);
              if (failedResultsWithIssues.length > 0) {
                bugsInProd += failedResultsWithIssues.length;
              }
            }
          } catch (e) {
            logger.error("Erreur details run production:", e);
          }
        }

        const totalBugs = bugsInTest + bugsInProd;

        let preprodMilestoneName = 'Sélection manuelle';
        if (preprodRuns.length > 0 && preprodRuns[0].milestones && preprodRuns[0].milestones.length > 0) {
          preprodMilestoneName = preprodRuns[0].milestones[0].name;
          if (preprodRuns.length > 1 && preprodRuns[1].milestones && preprodRuns[1].milestones.length > 0 && preprodRuns[0].milestones[0].id !== preprodRuns[1].milestones[0].id) {
            preprodMilestoneName += ' & ' + preprodRuns[1].milestones[0].name;
          }
        } else if (preprodRuns[0] && preprodRuns[0].milestone) {
          preprodMilestoneName = preprodRuns[0].milestone.name;
        }

        let prodMilestoneName = 'Sélection manuelle';
        if (prodRuns.length > 0 && prodRuns[0].milestones && prodRuns[0].milestones.length > 0) {
          prodMilestoneName = prodRuns[0].milestones[0].name;
          if (prodRuns.length > 1 && prodRuns[1].milestones && prodRuns[1].milestones.length > 0 && prodRuns[0].milestones[0].id !== prodRuns[1].milestones[0].id) {
            prodMilestoneName += ' & ' + prodRuns[1].milestones[0].name;
          }
        } else if (prodRuns[0] && prodRuns[0].milestone) {
          prodMilestoneName = prodRuns[0].milestone.name;
        }

        return {
          escapeRate: totalBugs > 0 ? this._calculatePercentage(bugsInProd, totalBugs) : 0,
          detectionRate: totalBugs > 0 ? this._calculatePercentage(bugsInTest, totalBugs) : 0,
          bugsInProd,
          bugsInTest,
          totalBugs,
          preprodMilestone: preprodMilestoneName,
          prodMilestone: prodMilestoneName
        };
      }

      // --- LOGIQUE PAR DEFAUT AUTOMATIQUE ---
      // 1. Récupérer les milestones actives (non complétées)
      const milestonesResponse = await this.client.get(`/projects/${projectId}/milestones`, {
        params: { is_completed: 0, sort: 'milestones:created_at', order: 'desc', per_page: 100 }
      });
      const activeMilestones = milestonesResponse.data.result || [];

      if (activeMilestones.length < 3) {
        return {
          escapeRate: 0,
          detectionRate: 0,
          bugsInProd: 0,
          bugsInTest: 0,
          preprodMilestone: activeMilestones[0] ? activeMilestones[0].name : 'N/A',
          prodMilestone: activeMilestones[2] ? activeMilestones[2].name : 'N/A',
          message: 'Pas assez de milestones actives pour comparer (3 requises).'
        };
      }

      // Parcourir pour trouver les 3 premières avec de l'activité (runs ou sessions)
      let preprodMilestone = null;
      let prodMilestone = null;
      let preprodRuns = [];
      let prodRuns = [];
      let preprodSessions = [];
      let prodSessions = [];
      let milestonesWithActivityCount = 0;

      for (const m of activeMilestones) {
        const [runsResp, sessionsResp] = await Promise.all([
          this.client.get(`/projects/${projectId}/runs`, { params: { milestone_id: m.id, per_page: 100 } }),
          this.client.get(`/projects/${projectId}/sessions`, { params: { milestone_id: m.id, per_page: 100 } })
        ]);
        
        const runs = runsResp.data.result || [];
        const sessions = sessionsResp.data.result || [];
        
        if (runs.length > 0 || sessions.length > 0) {
          milestonesWithActivityCount++;
          if (milestonesWithActivityCount === 1) {
            preprodMilestone = m;
            preprodRuns = runs;
            preprodSessions = sessions;
          } else if (milestonesWithActivityCount === 3) {
            prodMilestone = m;
            prodRuns = runs;
            prodSessions = sessions;
            break; // On a trouvé la 3ème avec activité
          }
        }
      }

      if (!preprodMilestone || !prodMilestone) {
        return {
          escapeRate: 0,
          detectionRate: 0,
          bugsInProd: 0,
          bugsInTest: 0,
          preprodMilestone: preprodMilestone ? preprodMilestone.name : 'N/A',
          prodMilestone: prodMilestone ? prodMilestone.name : 'N/A',
          message: 'Impossible de trouver 3 milestones avec de l\'activité (runs/sessions).'
        };
      }

      // 2. Bugs en TEST = somme des tests failed (status_id=2) dans les autres runs de la PROD (sans les mots clés de prod)
      let bugsInTest = 0;

      const isProdRunFn = (runName) => {
        const name = runName.toLowerCase();
        return name.includes('patch') || name.includes('retour de prod') || name.includes('retour') || name.includes('prod');
      };

      const testRuns = prodRuns.filter(r => !isProdRunFn(r.name));

      for (const run of testRuns) {
        bugsInTest += (run.status2_count || 0);
      }
      
      // Ajouter les échecs des sessions exploratoires de la PROD (m-2)
      for (const session of prodSessions) {
        bugsInTest += (session.status2_count || 0);
      }

      // 3. Bugs en PROD = somme des issues dans les runs contenant les mots clés de prod
      let bugsInProd = 0;
      const patchRuns = prodRuns.filter(r => isProdRunFn(r.name));

      for (const run of patchRuns) {
        // En Testmo, les issues remises au niveau du run sont dispos dans run.issues
        // On récupère le détail du run avec expands=issues
        const runDetails = await this.getRunDetails(run.id);
        if (runDetails.issues && runDetails.issues.length > 0) {
          bugsInProd += runDetails.issues.length;
        } else {
          // Si on veut être sûr, on compte au moins le nom de runs de patch s'il n'y a pas d'issues explicitement liées
          // Car l'utilisateur dit : "le nombre de tickets dans le run pour connaitre le nombre de retour de prod"
          // Par sécurité, s'il n'y a pas d'issues remontées dans `issues`, on consulte les résultats
          const results = await this.client.get(`/runs/${run.id}/results`, { params: { expands: 'issues' } });
          const failedResultsWithIssues = results.data.result.filter(res => res.issues && res.issues.length > 0);

          if (failedResultsWithIssues.length > 0) {
            bugsInProd += failedResultsWithIssues.length;
          } else if (runDetails.status2_count > 0) {
            // Alternative: Si pas d'issues liées API, on utilise les failures dans les patchs ?
            // Je vais m'appuyer prioritairement sur les issues. Si 0 issues et pas trouvé, on met 0.
            // Vu l'exigence : "le nombre de tickets dans le run". En Testmo les tickets = issues liés.
          }
        }
      }

      const totalBugs = bugsInTest + bugsInProd;

      const escapeRate = totalBugs > 0 ? this._calculatePercentage(bugsInProd, totalBugs) : 0;
      const detectionRate = totalBugs > 0 ? this._calculatePercentage(bugsInTest, totalBugs) : 0;

      return {
        escapeRate,
        detectionRate,
        bugsInProd,
        bugsInTest,
        totalBugs,
        preprodMilestone: preprodMilestone.name,
        prodMilestone: prodMilestone.name
      };

    } catch (error) {
      throw this._handleError('getEscapeAndDetectionRates', error);
    }
  }

  /**
   * Récupère les tendances annuelles de qualité (Escape Rate & DDP)
   * Basé sur les 20 derniers jalons (Milestones)
   * 
   * ISTQB: Test Process Improvement
   * LEAN: Analyse des tendances pour élimination du gaspillage
   */
  async getAnnualQualityTrends(projectId) {
    const cacheKey = `trends_${projectId}`;

    if (this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey).data;
    }

    try {
      // 1. Récupérer les derniers jalons (Milestones)
      const milestonesResponse = await this.client.get(`/projects/${projectId}/milestones`, {
        params: { sort: 'milestones:created_at', order: 'desc', per_page: 100 }
      });
      const milestones = (milestonesResponse.data.result || []).slice(0, 20);

      if (milestones.length === 0) return [];

      // 2. Récupérer les runs et sessions en VRAC (Bulk) pour le projet (LEAN)
      // On récupère les 200 derniers runs et sessions (ouverts et fermés)
      const [activeRunsResp, closedRunsResp, activeSessionsResp, closedSessionsResp] = await Promise.all([
        this.client.get(`/projects/${projectId}/runs`, { 
          params: { is_closed: 0, per_page: 100, expands: 'milestones' } 
        }),
        this.client.get(`/projects/${projectId}/runs`, { 
          params: { is_closed: 1, per_page: 100, expands: 'milestones' } 
        }),
        this.client.get(`/projects/${projectId}/sessions`, { 
          params: { is_closed: 0, per_page: 100 } 
        }),
        this.client.get(`/projects/${projectId}/sessions`, { 
          params: { is_closed: 1, per_page: 100 } 
        })
      ]);

      const allRuns = [
        ...(activeRunsResp.data.result || []),
        ...(closedRunsResp.data.result || [])
      ];
      
      const allSessions = [
        ...(activeSessionsResp.data.result || []),
        ...(closedSessionsResp.data.result || [])
      ];

      // Grouper les runs par milestoneId
      const runsByMilestone = new Map();
      allRuns.forEach(run => {
        if (run.milestone_id) {
          if (!runsByMilestone.has(run.milestone_id)) {
            runsByMilestone.set(run.milestone_id, []);
          }
          runsByMilestone.get(run.milestone_id).push(run);
        }
      });

      // Grouper les sessions par milestoneId
      const sessionsByMilestone = new Map();
      allSessions.forEach(session => {
        if (session.milestone_id) {
          if (!sessionsByMilestone.has(session.milestone_id)) {
            sessionsByMilestone.set(session.milestone_id, []);
          }
          sessionsByMilestone.get(session.milestone_id).push(session);
        }
      });

      // 3. Traitement des données par milestone
      const isProdRunFn = (runName) => {
        const name = runName.toLowerCase();
        return name.includes('patch') || name.includes('retour de prod') || name.includes('retour') || name.includes('prod');
      };

      const trends = [];

      for (const m of milestones) {
        const milestoneRuns = runsByMilestone.get(m.id) || [];
        const milestoneSessions = sessionsByMilestone.get(m.id) || [];
        
        // On ne traite que les jalons qui ont au moins un run ou une session
        if (milestoneRuns.length === 0 && milestoneSessions.length === 0) continue;

        const preprodRuns = milestoneRuns.filter(r => !isProdRunFn(r.name));
        const prodRuns = milestoneRuns.filter(r => isProdRunFn(r.name));

        // Calcul bugs en TEST (Runs + Sessions)
        const bugsInTest = preprodRuns.reduce((acc, r) => acc + (r.status2_count || 0), 0) + 
                           milestoneSessions.reduce((acc, s) => acc + (s.status2_count || 0), 0);
        
        // Calcul bugs en PROD (status2_count dans les runs de patch/prod)
        const bugsInProd = prodRuns.reduce((acc, r) => acc + (r.status2_count || 0), 0);

        const totalBugs = bugsInTest + bugsInProd;

        // On a besoin d'au moins un ticket d'anomalie pour calculer quelque chose d'utile
        if (totalBugs === 0 && milestoneRuns.length > 0) {
          // On continue quand même pour afficher le jalon avec 0%, mais on évite les divisions par zéro
        }

        trends.push({
          milestoneId: m.id,
          version: m.name,
          date: m.created_at,
          escapeRate: totalBugs > 0 ? this._calculatePercentage(bugsInProd, totalBugs) : 0,
          detectionRate: totalBugs > 0 ? this._calculatePercentage(bugsInTest, totalBugs) : 0,
          bugsInProd,
          bugsInTest,
          totalBugs,
          isCompleted: m.is_completed
        });
      }

      // Trier par date (chrono) pour le graphique
      const sortedTrends = trends.sort((a, b) => new Date(a.date) - new Date(b.date));

      this._setCache(cacheKey, sortedTrends);
      return sortedTrends;

    } catch (error) {
      throw this._handleError('getAnnualQualityTrends', error);
    }
  }

  /**
   * Calcule un pourcentage avec 2 décimales
   * @private
   */
  _calculatePercentage(value, total) {
    if (!total || total === 0) return 0;
    return parseFloat(((value / total) * 100).toFixed(2));
  }

  /**
   * Retourne des métriques vides par défaut
   * @private
   */
  _getEmptyMetrics() {
    return {
      raw: { total: 0, untested: 0, passed: 0, failed: 0, retest: 0, blocked: 0, skipped: 0, completed: 0 },
      completionRate: 0,
      passRate: 0,
      failureRate: 0,
      blockedRate: 0,
      skippedRate: 0,
      testEfficiency: 0,
      statusDistribution: {
        labels: ['Passed', 'Failed', 'Retest', 'Blocked', 'Skipped', 'Untested', 'WIP'],
        values: [0, 0, 0, 0, 0, 0, 0],
        colors: ['#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#6B7280', '#9CA3AF', '#3B82F6']
      },
      runsCount: 0,
      runs: [],
      slaStatus: { ok: true, alerts: [] },
      timestamp: new Date().toISOString(),
      itil: { mttr: 0, mttrTarget: 72, leadTime: 0, leadTimeTarget: 120, changeFailRate: 0, changeFailRateTarget: 20 },
      lean: { wipTotal: 0, wipTarget: 20, activeRuns: 0, closedRuns: 161 },
      istqb: { avgPassRate: 0, passRateTarget: 80, milestonesCompleted: 13, milestonesTotal: 27, blockRate: 0, blockRateTarget: 5 }
    };
  }

  /**
   * Vérifie les SLA ITIL
   * @private
   */
  _checkSLA(metrics) {
    const SLA_THRESHOLDS = {
      passRate: { target: 95, warning: 90, critical: 85 },
      blockedRate: { max: 5 },
      completionRate: { target: 90, warning: 80 }
    };

    const alerts = [];

    // Pass Rate SLA
    if (metrics.passRate < SLA_THRESHOLDS.passRate.critical) {
      alerts.push({
        severity: 'critical',
        metric: 'Pass Rate',
        value: metrics.passRate,
        threshold: SLA_THRESHOLDS.passRate.critical,
        message: `Pass rate critique: ${metrics.passRate}% < ${SLA_THRESHOLDS.passRate.critical}%`
      });
    } else if (metrics.passRate < SLA_THRESHOLDS.passRate.warning) {
      alerts.push({
        severity: 'warning',
        metric: 'Pass Rate',
        value: metrics.passRate,
        threshold: SLA_THRESHOLDS.passRate.warning,
        message: `Pass rate en warning: ${metrics.passRate}% < ${SLA_THRESHOLDS.passRate.warning}%`
      });
    }

    // Blocked Rate SLA
    if (metrics.blockedRate > SLA_THRESHOLDS.blockedRate.max) {
      alerts.push({
        severity: 'warning',
        metric: 'Blocked Rate',
        value: metrics.blockedRate,
        threshold: SLA_THRESHOLDS.blockedRate.max,
        message: `Trop de tests bloqués: ${metrics.blockedRate}% > ${SLA_THRESHOLDS.blockedRate.max}%`
      });
    }

    // Completion Rate SLA
    if (metrics.completionRate < SLA_THRESHOLDS.completionRate.warning) {
      alerts.push({
        severity: 'warning',
        metric: 'Completion Rate',
        value: metrics.completionRate,
        threshold: SLA_THRESHOLDS.completionRate.warning,
        message: `Avancement insuffisant: ${metrics.completionRate}% < ${SLA_THRESHOLDS.completionRate.warning}%`
      });
    }

    return {
      ok: alerts.length === 0,
      alerts: alerts
    };
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
      timestamp: Date.now()
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
      const response = await this.client.get(`/projects/${projectId}/folders`, { params });
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
    return folders.find(f => f.name === folderName) || null;
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
        data: { ids: folderIds }
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

        const response = await this.client.get(`/projects/${projectId}/cases`, { params });
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
  async findCaseByTag(projectId, tag, folderId = null) {
    const cases = await this.getCases(projectId, folderId, 'tags');
    // L'API retourne tags comme IDs numériques — on ne peut pas matcher par nom
    // Stratégie : on cherche par nom de case (le titre GitLab est unique par folder)
    return null; // Sera résolu par findCaseByName
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
    return cases.find(c => c.name === name) || null;
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
        logger.info(`Testmo: createCase payload custom_steps: ${JSON.stringify(caseData.custom_steps).substring(0, 500)}`);
      }
      const response = await this.client.post(`/projects/${projectId}/cases`, {
        cases: [caseData]
      });
      const created = response.data.result ? response.data.result[0] : response.data;
      if (created?.custom_steps) {
        logger.info(`Testmo: Case créé — steps retournés: ${JSON.stringify(created.custom_steps).substring(0, 300)}`);
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
    const manualTags = (testCase.tags || []).filter(t => {
      const name = typeof t === 'string' ? t : (t.name || t.tag || '');
      if (!name) return false;
      return !name.startsWith('gitlab-') && !name.startsWith('iteration-') && name !== 'sync-auto';
    });
    if (manualTags.length > 0) return true;

    if (testCase.custom_priority && testCase.custom_priority !== 'Normal' && testCase.custom_priority !== 2) return true;
    if (testCase.attachments && testCase.attachments.length > 0) return true;
    // Ne compter que les steps avec du contenu réel (format Testmo: text1 = contenu du step)
    const nonEmptySteps = (testCase.custom_steps || []).filter(s => {
      const content = typeof s === 'object' ? (s.text1 || s.step || s.content || '') : String(s || '');
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
        const isRetryable = !status || status === 429 || status >= 500 ||
          err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND';
        if (!isRetryable || attempt === maxRetries) break;
        const delay = baseDelay * Math.pow(2, attempt - 1); // 500ms, 1s, 2s
        logger.warn(`[Retry] ${label} — tentative ${attempt}/${maxRetries} échouée (${err.message}), nouvel essai dans ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
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
      timestamp: new Date().toISOString()
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

module.exports = new TestmoService();
