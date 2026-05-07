const express = require('express');
const router = express.Router();
const testmoService = require('../services/testmo.service');
const runManager = require('../services/run-manager.service');
const logger = require('../services/logger.service');
const {
  validateParams,
  validateBody,
  validateQuery,
  runIdParam,
  folderCasesQuery,
  projectRunsQuery,
  createRunBody,
  mergeBody,
} = require('../validators');

// ── Routes statiques (AVANT /:runId) ──────────────────────────────────────

router.get('/folder-cases', validateQuery(folderCasesQuery), async (req, res, next) => {
  try {
    const { syncProjectId, iterationName } = req.query;
    const data = await runManager.getFolderCases(syncProjectId, iterationName);
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur GET /api/runs/folder-cases:', error);
    next(error);
  }
});

router.get('/project-runs', validateQuery(projectRunsQuery), async (req, res, next) => {
  try {
    const { syncProjectId, activeOnly = 'true' } = req.query;
    const runs = await runManager.getProjectRunsList(syncProjectId, activeOnly === 'true');
    res.json({ success: true, data: runs, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur GET /api/runs/project-runs:', error);
    next(error);
  }
});

router.post('/', validateBody(createRunBody), async (req, res, next) => {
  try {
    const { syncProjectId, name, caseIds, milestoneId } = req.body;
    const run = await runManager.createRunFromCases(syncProjectId, name, caseIds, milestoneId);
    res.json({ success: true, data: run, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/runs:', error);
    next(error);
  }
});

// ── Routes paramétrées ────────────────────────────────────────────────────

router.get('/:runId', validateParams(runIdParam), async (req, res, next) => {
  try {
    const runId = parseInt(req.params.runId);

    const runDetails = await testmoService.getRunDetails(runId);

    res.json({
      success: true,
      data: runDetails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Erreur GET /api/runs/${req.params.runId}:`, error);
    next(error);
  }
});

router.get('/:runId/results', validateParams(runIdParam), async (req, res, next) => {
  try {
    const runId = parseInt(req.params.runId);
    const statusFilter = req.query.status; // Ex: '3,5' pour Failed+Blocked

    const results = await testmoService.getRunResults(runId, statusFilter);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Erreur GET /api/runs/${req.params.runId}/results:`, error);
    next(error);
  }
});

router.post(
  '/:runId/merge-preview',
  validateParams(runIdParam),
  validateBody(mergeBody),
  async (req, res, next) => {
    try {
      const runId = parseInt(req.params.runId);
      const { caseIds } = req.body;
      const existingResults = await testmoService.getAllRunResults(runId);
      const preview = runManager.computeMergePreview(existingResults, caseIds);
      res.json({ success: true, data: preview, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur POST /api/runs/${req.params.runId}/merge-preview:`, error);
      next(error);
    }
  }
);

router.post(
  '/:runId/merge',
  validateParams(runIdParam),
  validateBody(mergeBody),
  async (req, res, next) => {
    try {
      const runId = parseInt(req.params.runId);
      const { caseIds } = req.body;
      const result = await runManager.mergeRunCases(runId, caseIds);
      res.json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur POST /api/runs/${req.params.runId}/merge:`, error);
      next(error);
    }
  }
);

module.exports = router;
