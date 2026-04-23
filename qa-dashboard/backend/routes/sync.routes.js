const express = require('express');
const router = express.Router();
const {
  validateParams,
  validateBody,
  syncProjectIdParam,
  syncPreviewBody,
  syncExecuteBody,
  syncIterationBody,
  syncStatusToGitlabBody,
  autoConfigBody,
} = require('../validators');
const {
  getProjects,
  getIterations,
  previewSync,
  executeSync,
  getHistory,
  testApi,
  syncIteration,
  statusToGitlab,
  testCleanup,
  getAutoConfig,
  updateAutoConfig,
} = require('../controllers/sync.controller');

router.get('/projects', getProjects);
router.get('/:projectId/iterations', validateParams(syncProjectIdParam), getIterations);
router.post('/preview', validateBody(syncPreviewBody), previewSync);
router.post('/execute', validateBody(syncExecuteBody), executeSync);
router.get('/history', getHistory);
router.post('/test-api', testApi);
router.post('/iteration', validateBody(syncIterationBody), syncIteration);
router.post('/status-to-gitlab', validateBody(syncStatusToGitlabBody), statusToGitlab);
router.delete('/test-cleanup', testCleanup);
router.get('/auto-config', getAutoConfig);
router.put('/auto-config', validateBody(autoConfigBody), updateAutoConfig);

module.exports = router;
