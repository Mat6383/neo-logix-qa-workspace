/**
 * ================================================
 * ISTQB METRICS SERVICE
 * ================================================
 * Calculs ISTQB : Project Metrics, Escape Rate, Detection Rate, Annual Trends.
 * Dépend de testmoService pour les appels HTTP Testmo (injecté au constructeur).
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

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

// ─── Service class ───────────────────────────────────────────────────────────

class IstqbMetricsService {
  /**
   * @param {Object} testmoService - Instance de TestmoService (injectée)
   */
  constructor(testmoService) {
    this.testmo = testmoService;
  }

  /**
   * Agrège les métriques ISTQB pour un projet
   * ISTQB Section 5.4.2: Test Summary Report
   *
   * @param {number} projectId
   * @param {Array|null} preprodMilestones
   * @param {Array|null} prodMilestones
   * @returns {Object} Métriques ISTQB complètes
   */
  async getProjectMetrics(projectId, preprodMilestones = null, _prodMilestones = null) {
    const client = this.testmo.client;

    try {
      // Récupérer les runs actifs
      const runsData = await this.testmo.getProjectRuns(projectId, true);
      let runs = runsData.result || [];

      // Si sélection manuelle de jalons de préprod / prod
      if (preprodMilestones && preprodMilestones.length > 0) {
        try {
          const runPromises = [];
          for (const mId of preprodMilestones) {
            runPromises.push(
              client.get(`/projects/${projectId}/runs`, {
                params: {
                  milestone_id: mId,
                  is_closed: 0,
                  per_page: 100,
                  expands: 'users,milestones,configs',
                },
              })
            );
            runPromises.push(
              client.get(`/projects/${projectId}/runs`, {
                params: {
                  milestone_id: mId,
                  is_closed: 1,
                  per_page: 100,
                  expands: 'users,milestones,configs',
                },
              })
            );
          }
          const allRunsData = await Promise.all(runPromises);

          runs = [];
          allRunsData.forEach((resp) => {
            if (resp.data.result) {
              runs = runs.concat(resp.data.result);
            }
          });
          logger.info(
            `[getProjectMetrics] Récupération de ${runs.length} runs pour les jalons ${preprodMilestones.join(', ')}`
          );
        } catch (e) {
          logger.error(`Erreur lors de la récupération des runs filtrés par jalon:`, {
            status: e.response?.status,
            message: e.message,
          });
        }
      }

      // --- SESSIONS EXPLORATOIRES ---
      let sessions = [];
      try {
        const sessionsData = await this.testmo.getProjectSessions(projectId, false);
        sessions = sessionsData.result || [];

        if (preprodMilestones && preprodMilestones.length > 0) {
          sessions = sessions.filter((s) => preprodMilestones.includes(s.milestone_id));
        } else {
          sessions = sessions.filter((s) => !s.is_closed);
        }

        logger.info(
          `[getProjectMetrics] Récupération de ${sessions.length} sessions exploratoires`
        );
      } catch (e) {
        logger.error(`Erreur lors de la récupération des sessions exploratoires:`, {
          status: e.response?.status,
          message: e.message,
        });
      }

      // Fetch dynamic TV metrics (Closed Runs & Milestones)
      const [closedRunsResponse, milestonesResponse] = await Promise.all([
        client
          .get(`/projects/${projectId}/runs`, { params: { is_closed: 1, per_page: 100 } })
          .catch(() => ({ data: { total: 0 } })),
        client
          .get(`/projects/${projectId}/milestones`, { params: { per_page: 100 } })
          .catch(() => ({ data: { result: [] } })),
      ]);

      const closedRunsCount = closedRunsResponse.data.total || 0;
      const milestones = milestonesResponse.data.result || [];
      const milestonesTotal = milestones.length || 1;
      const milestonesCompleted = milestones.filter((m) => m.is_completed).length;

      if (runs.length === 0 && sessions.length === 0) {
        logger.warn(`No active runs or sessions found for project ${projectId}`);
        return this._getEmptyMetrics();
      }

      // Agrégation des métriques (runs + sessions)
      const aggregated = runs.reduce(
        (acc, run) => ({
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
          failure: acc.failure + (run.failure_count || 0),
        }),
        {
          total: 0,
          untested: 0,
          passed: 0,
          failed: 0,
          retest: 0,
          blocked: 0,
          skipped: 0,
          wip: 0,
          completed: 0,
          success: 0,
          failure: 0,
        }
      );

      // Ajout des sessions exploratoires dans la répartition globale
      const sessionAggregated = aggregateSessions(sessions);
      aggregated.total += sessionAggregated.total;
      aggregated.passed += sessionAggregated.passed;
      aggregated.failed += sessionAggregated.failed;
      aggregated.completed += sessionAggregated.completed;
      aggregated.success += sessionAggregated.success;
      aggregated.failure += sessionAggregated.failure;
      aggregated.wip += sessionAggregated.wip;

      const leadTime =
        Math.round(
          (runs.reduce(
            (acc, r) => acc + (Date.now() - new Date(r.created_at).getTime()) / (1000 * 3600),
            0
          ) /
            (runs.length || 1)) *
            10
        ) / 10;
      const mttr = Math.round(leadTime * (aggregated.failed / (aggregated.passed || 1)) * 10) / 10;

      // Calculs ISTQB
      const resultMetrics = {
        raw: aggregated,
        completionRate: _calculatePercentage(aggregated.completed, aggregated.total),
        passRate: _calculatePercentage(aggregated.passed, aggregated.completed),
        failureRate: _calculatePercentage(aggregated.failed, aggregated.completed),
        blockedRate: _calculatePercentage(aggregated.blocked, aggregated.total),
        skippedRate: _calculatePercentage(aggregated.skipped, aggregated.total),
        testEfficiency: _calculatePercentage(
          aggregated.passed,
          aggregated.passed + aggregated.failed
        ),
        statusDistribution: {
          labels: ['Passed', 'Failed', 'Retest', 'Blocked', 'Skipped', 'Untested', 'WIP'],
          values: [
            aggregated.passed,
            aggregated.failed,
            aggregated.retest,
            aggregated.blocked,
            aggregated.skipped,
            aggregated.untested,
            aggregated.wip,
          ],
          colors: ['#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#6B7280', '#9CA3AF', '#3B82F6'],
        },
        runsCount: runs.length + sessions.length,
        runs: [
          ...runs.map((run) => ({
            id: run.id,
            name: run.name,
            total: run.total_count || 0,
            completed: run.completed_count || 0,
            passed: run.status1_count || 0,
            failed: run.status2_count || 0,
            blocked: run.status4_count || 0,
            wip: run.status7_count || 0,
            untested: run.untested_count || 0,
            completionRate: _calculatePercentage(run.completed_count, run.total_count),
            passRate: _calculatePercentage(run.status1_count, run.completed_count),
            created_at: run.created_at,
            milestone: run.milestone_id,
            isExploratory: false,
          })),
          ...sessions.map((session) => {
            const isTerminal = !!session.is_closed;
            const total = session.total_count || 0;
            const executed =
              (session.status1_count || 0) +
              (session.status2_count || 0) +
              (session.status4_count || 0) +
              (session.status5_count || 0);

            let completionRate = 0;
            if (isTerminal || executed > 0) {
              completionRate = 100;
            } else if (total > 0) {
              completionRate = _calculatePercentage(executed, total);
            }

            const successCount = session.success_count || 0;
            const failureCount = session.failure_count || 0;
            const sessionPassRate = _calculatePercentage(successCount, successCount + failureCount);

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
              isClosed: !!session.is_closed,
            };
          }),
        ],
        timestamp: new Date().toISOString(),
        itil: {
          mttr: mttr,
          mttrTarget: 72,
          leadTime: leadTime,
          leadTimeTarget: 120,
          changeFailRate: _calculatePercentage(aggregated.failed, aggregated.completed),
          changeFailRateTarget: 20,
        },
        lean: {
          wipTotal: aggregated.wip,
          wipTarget: 20,
          activeRuns: runs.length,
          closedRuns: closedRunsCount,
        },
        istqb: {
          avgPassRate: _calculatePercentage(aggregated.passed, aggregated.completed),
          passRateTarget: 80,
          milestonesCompleted: milestonesCompleted,
          milestonesTotal: milestonesTotal,
          blockRate: _calculatePercentage(aggregated.blocked, aggregated.total),
          blockRateTarget: 5,
        },
      };

      resultMetrics.runs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      resultMetrics.slaStatus = this._checkSLA(resultMetrics);

      return resultMetrics;
    } catch (error) {
      throw this.testmo._handleError('getProjectMetrics', error);
    }
  }

  /**
   * Calcule le Taux d'Échappement et le Taux de Détection
   * ISTQB: Escape Rate & Defect Detection Percentage (DDP)
   */
  async getEscapeAndDetectionRates(projectId, preprodMilestones = null, prodMilestones = null) {
    const client = this.testmo.client;

    try {
      if (
        (preprodMilestones && preprodMilestones.length > 0) ||
        (prodMilestones && prodMilestones.length > 0)
      ) {
        let allRuns = [];
        try {
          const requiredMilestones = [
            ...new Set([...(preprodMilestones || []), ...(prodMilestones || [])]),
          ];

          const runPromises = [];
          const sessionPromises = [];
          for (const mId of requiredMilestones) {
            runPromises.push(
              client.get(`/projects/${projectId}/runs`, {
                params: {
                  milestone_id: mId,
                  is_closed: 0,
                  per_page: 100,
                  expands: 'users,milestones,configs',
                },
              })
            );
            runPromises.push(
              client.get(`/projects/${projectId}/runs`, {
                params: {
                  milestone_id: mId,
                  is_closed: 1,
                  per_page: 100,
                  expands: 'users,milestones,configs',
                },
              })
            );
            sessionPromises.push(
              client.get(`/projects/${projectId}/sessions`, {
                params: { milestone_id: mId, is_closed: 0, per_page: 100 },
              })
            );
            sessionPromises.push(
              client.get(`/projects/${projectId}/sessions`, {
                params: { milestone_id: mId, is_closed: 1, per_page: 100 },
              })
            );
          }
          const [allRunsData, allSessionsData] = await Promise.all([
            Promise.all(runPromises),
            Promise.all(sessionPromises),
          ]);

          allRunsData.forEach((resp) => {
            if (resp.data.result) {
              allRuns = allRuns.concat(resp.data.result);
            }
          });

          let allSessions = [];
          allSessionsData.forEach((resp) => {
            if (resp.data.result) {
              allSessions = allSessions.concat(resp.data.result);
            }
          });

          allRuns = Array.from(new Map(allRuns.map((item) => [item.id, item])).values());
          allSessions = Array.from(new Map(allSessions.map((item) => [item.id, item])).values());

          logger.info(
            `[getEscapeAndDetectionRates] Récupération unique de ${allRuns.length} runs et ${allSessions.length} sessions pour les jalons ${requiredMilestones.join(', ')}`
          );

          this._tempSessions = allSessions;
        } catch (e) {
          logger.error(`Erreur récupération Quality Rates runs/sessions spécifiques:`, {
            status: e.response?.status,
            message: e.message,
          });
        }

        let preprodRuns = [];
        let prodRuns = [];

        if (preprodMilestones && preprodMilestones.length > 0) {
          preprodRuns = allRuns.filter((r) => preprodMilestones.includes(r.milestone_id));
        } else {
          const latestMiles = [
            ...new Set(allRuns.filter((r) => r.milestone_id).map((r) => r.milestone_id)),
          ].slice(0, 3);
          if (latestMiles.length > 0) {
            preprodRuns = allRuns.filter((r) => r.milestone_id === latestMiles[0]);
          }
        }

        if (prodMilestones && prodMilestones.length > 0) {
          const isProdRunFn = (runName) => {
            const name = runName.toLowerCase();
            return (
              name.includes('patch') ||
              name.includes('retour de prod') ||
              name.includes('retour') ||
              name.includes('prod')
            );
          };
          prodRuns = allRuns.filter(
            (r) => prodMilestones.includes(r.milestone_id) && isProdRunFn(r.name)
          );
        } else {
          const isProdRunFn = (runName) => {
            const name = runName.toLowerCase();
            return (
              name.includes('patch') ||
              name.includes('retour de prod') ||
              name.includes('retour') ||
              name.includes('prod')
            );
          };
          const latestMiles = [
            ...new Set(allRuns.filter((r) => r.milestone_id).map((r) => r.milestone_id)),
          ];

          for (let i = 0; i < latestMiles.length; i++) {
            const milestoneRuns = allRuns.filter((r) => r.milestone_id === latestMiles[i]);
            const prodInMilestone = milestoneRuns.filter((r) => isProdRunFn(r.name));
            if (prodInMilestone.length > 0) {
              prodRuns = prodInMilestone;
              break;
            }
          }
        }

        if (preprodRuns.length === 0 || prodRuns.length === 0) {
          return {
            escapeRate: 0,
            detectionRate: 0,
            bugsInProd: 0,
            bugsInTest: 0,
            totalBugs: 0,
            preprodMilestone: 'Sélection incomplète',
            prodMilestone: 'Sélection incomplète',
            message: "Impossible de trouver des runs pour l'un des environnements.",
          };
        }

        let bugsInTest = 0;
        for (const run of preprodRuns) {
          bugsInTest += run.status2_count || 0;
        }

        if (this._tempSessions && preprodMilestones) {
          const preprodSessions = this._tempSessions.filter((s) =>
            preprodMilestones.includes(s.milestone_id)
          );
          for (const session of preprodSessions) {
            bugsInTest += session.status2_count || 0;
          }
        }
        delete this._tempSessions;

        let bugsInProd = 0;
        for (const run of prodRuns) {
          try {
            const runDetails = run.issues ? run : await this.testmo.getRunDetails(run.id);
            if (runDetails.issues && runDetails.issues.length > 0) {
              bugsInProd += runDetails.issues.length;
            } else {
              const results = await client.get(`/runs/${run.id}/results`, {
                params: { expands: 'issues' },
              });
              const failedResultsWithIssues = (results.data.result || []).filter(
                (res) => res.issues && res.issues.length > 0
              );
              if (failedResultsWithIssues.length > 0) {
                bugsInProd += failedResultsWithIssues.length;
              }
            }
          } catch (e) {
            logger.error('Erreur details run production:', {
              status: e.response?.status,
              message: e.message,
            });
          }
        }

        const totalBugs = bugsInTest + bugsInProd;

        let preprodMilestoneName = 'Sélection manuelle';
        if (
          preprodRuns.length > 0 &&
          preprodRuns[0].milestones &&
          preprodRuns[0].milestones.length > 0
        ) {
          preprodMilestoneName = preprodRuns[0].milestones[0].name;
          if (
            preprodRuns.length > 1 &&
            preprodRuns[1].milestones &&
            preprodRuns[1].milestones.length > 0 &&
            preprodRuns[0].milestones[0].id !== preprodRuns[1].milestones[0].id
          ) {
            preprodMilestoneName += ' & ' + preprodRuns[1].milestones[0].name;
          }
        } else if (preprodRuns[0] && preprodRuns[0].milestone) {
          preprodMilestoneName = preprodRuns[0].milestone.name;
        }

        let prodMilestoneName = 'Sélection manuelle';
        if (prodRuns.length > 0 && prodRuns[0].milestones && prodRuns[0].milestones.length > 0) {
          prodMilestoneName = prodRuns[0].milestones[0].name;
          if (
            prodRuns.length > 1 &&
            prodRuns[1].milestones &&
            prodRuns[1].milestones.length > 0 &&
            prodRuns[0].milestones[0].id !== prodRuns[1].milestones[0].id
          ) {
            prodMilestoneName += ' & ' + prodRuns[1].milestones[0].name;
          }
        } else if (prodRuns[0] && prodRuns[0].milestone) {
          prodMilestoneName = prodRuns[0].milestone.name;
        }

        return {
          escapeRate: totalBugs > 0 ? _calculatePercentage(bugsInProd, totalBugs) : 0,
          detectionRate: totalBugs > 0 ? _calculatePercentage(bugsInTest, totalBugs) : 0,
          bugsInProd,
          bugsInTest,
          totalBugs,
          preprodMilestone: preprodMilestoneName,
          prodMilestone: prodMilestoneName,
        };
      }

      // --- LOGIQUE PAR DEFAUT AUTOMATIQUE ---
      const milestonesResponse = await client.get(`/projects/${projectId}/milestones`, {
        params: { is_completed: 0, sort: 'milestones:created_at', order: 'desc', per_page: 100 },
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
          message: 'Pas assez de milestones actives pour comparer (3 requises).',
        };
      }

      let preprodMilestone = null;
      let prodMilestone = null;
      let prodRuns = [];
      let prodSessions = [];
      let milestonesWithActivityCount = 0;

      for (const m of activeMilestones) {
        const [runsResp, sessionsResp] = await Promise.all([
          client.get(`/projects/${projectId}/runs`, {
            params: { milestone_id: m.id, per_page: 100 },
          }),
          client.get(`/projects/${projectId}/sessions`, {
            params: { milestone_id: m.id, per_page: 100 },
          }),
        ]);

        const runs = runsResp.data.result || [];
        const sessions = sessionsResp.data.result || [];

        if (runs.length > 0 || sessions.length > 0) {
          milestonesWithActivityCount++;
          if (milestonesWithActivityCount === 1) {
            preprodMilestone = m;
          } else if (milestonesWithActivityCount === 3) {
            prodMilestone = m;
            prodRuns = runs;
            prodSessions = sessions;
            break;
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
          message: "Impossible de trouver 3 milestones avec de l'activité (runs/sessions).",
        };
      }

      let bugsInTest = 0;

      const isProdRunFn = (runName) => {
        const name = runName.toLowerCase();
        return (
          name.includes('patch') ||
          name.includes('retour de prod') ||
          name.includes('retour') ||
          name.includes('prod')
        );
      };

      const testRuns = prodRuns.filter((r) => !isProdRunFn(r.name));

      for (const run of testRuns) {
        bugsInTest += run.status2_count || 0;
      }

      for (const session of prodSessions) {
        bugsInTest += session.status2_count || 0;
      }

      let bugsInProd = 0;
      const patchRuns = prodRuns.filter((r) => isProdRunFn(r.name));

      for (const run of patchRuns) {
        const runDetails = await this.testmo.getRunDetails(run.id);
        if (runDetails.issues && runDetails.issues.length > 0) {
          bugsInProd += runDetails.issues.length;
        } else {
          const results = await client.get(`/runs/${run.id}/results`, {
            params: { expands: 'issues' },
          });
          const failedResultsWithIssues = results.data.result.filter(
            (res) => res.issues && res.issues.length > 0
          );

          if (failedResultsWithIssues.length > 0) {
            bugsInProd += failedResultsWithIssues.length;
          } else if (runDetails.status2_count > 0) {
            // No issues linked API — bugsInProd stays 0 per business logic
          }
        }
      }

      const totalBugs = bugsInTest + bugsInProd;

      const escapeRate = totalBugs > 0 ? _calculatePercentage(bugsInProd, totalBugs) : 0;
      const detectionRate = totalBugs > 0 ? _calculatePercentage(bugsInTest, totalBugs) : 0;

      return {
        escapeRate,
        detectionRate,
        bugsInProd,
        bugsInTest,
        totalBugs,
        preprodMilestone: preprodMilestone.name,
        prodMilestone: prodMilestone.name,
      };
    } catch (error) {
      throw this.testmo._handleError('getEscapeAndDetectionRates', error);
    }
  }

  /**
   * Récupère les tendances annuelles de qualité (Escape Rate & DDP)
   * ISTQB: Test Process Improvement
   */
  async getAnnualQualityTrends(projectId) {
    const cacheKey = `trends_${projectId}`;
    const client = this.testmo.client;

    if (this.testmo._isCacheValid(cacheKey)) {
      return this.testmo.cache.get(cacheKey).data;
    }

    try {
      const milestonesResponse = await client.get(`/projects/${projectId}/milestones`, {
        params: { sort: 'milestones:created_at', order: 'desc', per_page: 100 },
      });
      const milestones = (milestonesResponse.data.result || []).slice(0, 20);

      if (milestones.length === 0) return [];

      const [activeRunsResp, closedRunsResp, activeSessionsResp, closedSessionsResp] =
        await Promise.all([
          client.get(`/projects/${projectId}/runs`, {
            params: { is_closed: 0, per_page: 100, expands: 'milestones' },
          }),
          client.get(`/projects/${projectId}/runs`, {
            params: { is_closed: 1, per_page: 100, expands: 'milestones' },
          }),
          client.get(`/projects/${projectId}/sessions`, {
            params: { is_closed: 0, per_page: 100 },
          }),
          client.get(`/projects/${projectId}/sessions`, {
            params: { is_closed: 1, per_page: 100 },
          }),
        ]);

      const allRuns = [
        ...(activeRunsResp.data.result || []),
        ...(closedRunsResp.data.result || []),
      ];

      const allSessions = [
        ...(activeSessionsResp.data.result || []),
        ...(closedSessionsResp.data.result || []),
      ];

      const runsByMilestone = new Map();
      allRuns.forEach((run) => {
        if (run.milestone_id) {
          if (!runsByMilestone.has(run.milestone_id)) {
            runsByMilestone.set(run.milestone_id, []);
          }
          runsByMilestone.get(run.milestone_id).push(run);
        }
      });

      const sessionsByMilestone = new Map();
      allSessions.forEach((session) => {
        if (session.milestone_id) {
          if (!sessionsByMilestone.has(session.milestone_id)) {
            sessionsByMilestone.set(session.milestone_id, []);
          }
          sessionsByMilestone.get(session.milestone_id).push(session);
        }
      });

      const isProdRunFn = (runName) => {
        const name = runName.toLowerCase();
        return (
          name.includes('patch') ||
          name.includes('retour de prod') ||
          name.includes('retour') ||
          name.includes('prod')
        );
      };

      const trends = [];

      for (const m of milestones) {
        const milestoneRuns = runsByMilestone.get(m.id) || [];
        const milestoneSessions = sessionsByMilestone.get(m.id) || [];

        if (milestoneRuns.length === 0 && milestoneSessions.length === 0) continue;

        const preprodRuns = milestoneRuns.filter((r) => !isProdRunFn(r.name));
        const prodRuns = milestoneRuns.filter((r) => isProdRunFn(r.name));

        const bugsInTest =
          preprodRuns.reduce((acc, r) => acc + (r.status2_count || 0), 0) +
          milestoneSessions.reduce((acc, s) => acc + (s.status2_count || 0), 0);

        const bugsInProd = prodRuns.reduce((acc, r) => acc + (r.status2_count || 0), 0);

        const totalBugs = bugsInTest + bugsInProd;

        trends.push({
          milestoneId: m.id,
          version: m.name,
          date: m.created_at,
          escapeRate: totalBugs > 0 ? _calculatePercentage(bugsInProd, totalBugs) : 0,
          detectionRate: totalBugs > 0 ? _calculatePercentage(bugsInTest, totalBugs) : 0,
          bugsInProd,
          bugsInTest,
          totalBugs,
          isCompleted: m.is_completed,
        });
      }

      const sortedTrends = trends.sort((a, b) => new Date(a.date) - new Date(b.date));

      this.testmo._setCache(cacheKey, sortedTrends);
      return sortedTrends;
    } catch (error) {
      throw this.testmo._handleError('getAnnualQualityTrends', error);
    }
  }

  /**
   * Retourne des métriques vides par défaut
   * @private
   */
  _getEmptyMetrics() {
    return {
      raw: {
        total: 0,
        untested: 0,
        passed: 0,
        failed: 0,
        retest: 0,
        blocked: 0,
        skipped: 0,
        completed: 0,
      },
      completionRate: 0,
      passRate: 0,
      failureRate: 0,
      blockedRate: 0,
      skippedRate: 0,
      testEfficiency: 0,
      statusDistribution: {
        labels: ['Passed', 'Failed', 'Retest', 'Blocked', 'Skipped', 'Untested', 'WIP'],
        values: [0, 0, 0, 0, 0, 0, 0],
        colors: ['#10B981', '#EF4444', '#8B5CF6', '#F59E0B', '#6B7280', '#9CA3AF', '#3B82F6'],
      },
      runsCount: 0,
      runs: [],
      slaStatus: { ok: true, alerts: [] },
      timestamp: new Date().toISOString(),
      itil: {
        mttr: 0,
        mttrTarget: 72,
        leadTime: 0,
        leadTimeTarget: 120,
        changeFailRate: 0,
        changeFailRateTarget: 20,
      },
      lean: { wipTotal: 0, wipTarget: 20, activeRuns: 0, closedRuns: 161 },
      istqb: {
        avgPassRate: 0,
        passRateTarget: 80,
        milestonesCompleted: 13,
        milestonesTotal: 27,
        blockRate: 0,
        blockRateTarget: 5,
      },
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
      completionRate: { target: 90, warning: 80 },
    };

    const alerts = [];

    if (metrics.passRate < SLA_THRESHOLDS.passRate.critical) {
      alerts.push({
        severity: 'critical',
        metric: 'Pass Rate',
        value: metrics.passRate,
        threshold: SLA_THRESHOLDS.passRate.critical,
        message: `Pass rate critique: ${metrics.passRate}% < ${SLA_THRESHOLDS.passRate.critical}%`,
      });
    } else if (metrics.passRate < SLA_THRESHOLDS.passRate.warning) {
      alerts.push({
        severity: 'warning',
        metric: 'Pass Rate',
        value: metrics.passRate,
        threshold: SLA_THRESHOLDS.passRate.warning,
        message: `Pass rate en warning: ${metrics.passRate}% < ${SLA_THRESHOLDS.passRate.warning}%`,
      });
    }

    if (metrics.blockedRate > SLA_THRESHOLDS.blockedRate.max) {
      alerts.push({
        severity: 'warning',
        metric: 'Blocked Rate',
        value: metrics.blockedRate,
        threshold: SLA_THRESHOLDS.blockedRate.max,
        message: `Trop de tests bloqués: ${metrics.blockedRate}% > ${SLA_THRESHOLDS.blockedRate.max}%`,
      });
    }

    if (metrics.completionRate < SLA_THRESHOLDS.completionRate.warning) {
      alerts.push({
        severity: 'warning',
        metric: 'Completion Rate',
        value: metrics.completionRate,
        threshold: SLA_THRESHOLDS.completionRate.warning,
        message: `Avancement insuffisant: ${metrics.completionRate}% < ${SLA_THRESHOLDS.completionRate.warning}%`,
      });
    }

    return {
      ok: alerts.length === 0,
      alerts: alerts,
    };
  }
}

// Singleton — instancié après que testmo.service soit chargé pour éviter la dépendance circulaire
let _instance = null;
function getIstqbMetricsService() {
  if (!_instance) {
    const testmoService = require('./testmo.service');
    _instance = new IstqbMetricsService(testmoService);
  }
  return _instance;
}

module.exports = IstqbMetricsService;
module.exports.getIstqbMetricsService = getIstqbMetricsService;
module.exports._calculatePercentage = _calculatePercentage;
module.exports.aggregateSessions = aggregateSessions;
module.exports.globalMetrics = globalMetrics;
