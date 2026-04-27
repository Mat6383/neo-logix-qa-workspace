const logger = require('../services/logger.service');
const syncService = require('../services/sync.service');
const syncHistoryService = require('../services/syncHistory.service');
const statusSyncService = require('../services/status-sync.service');
const autoSyncConfig = require('../services/auto-sync-config.service');
const PROJECTS = require('../config/projects.config');
const gitlabServiceInstance = require('../services/gitlab.service');

function getProjects(_req, res) {
  const list = PROJECTS.map((p) => ({ id: p.id, label: p.label, configured: p.configured }));
  res.json({ success: true, data: list, timestamp: new Date().toISOString() });
}

async function getIterations(req, res) {
  try {
    const { projectId } = req.params;
    const search = req.query.search || '';

    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    if (!project.configured) return res.status(400).json({ success: false, error: `Projet "${project.label}" non configuré` });
    if (!project.gitlab.projectId) return res.status(400).json({ success: false, error: `Projet "${project.label}" sans projectId GitLab` });

    const iterations = await gitlabServiceInstance.searchIterations(project.gitlab.projectId, search);
    res.json({
      success: true,
      data: iterations.map((it) => ({ id: it.id, title: it.title, state: it.state, web_url: it.web_url })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Erreur GET /api/sync/${req.params.projectId}/iterations:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function previewSync(req, res) {
  try {
    const { projectId, iterationName } = req.body;
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project) return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    if (!project.configured) return res.status(400).json({ success: false, error: `Projet "${project.label}" non configuré` });

    logger.info(`Preview: ${project.label} / "${iterationName}"`);
    const preview = await syncService.previewIteration(iterationName, project);
    syncHistoryService.addRun(project.label, iterationName, 'preview', {
      created: preview.summary.toCreate,
      updated: preview.summary.toUpdate,
      skipped: preview.summary.toSkip,
      total: preview.summary.total,
    });
    res.json({ success: true, data: preview, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/sync/preview:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function executeSync(req, res) {
  const { projectId, iterationName } = req.body;
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
  if (!project.configured) return res.status(400).json({ success: false, error: `Projet "${project.label}" non configuré` });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, data = {}) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  try {
    logger.info(`Execute: ${project.label} / "${iterationName}"`);
    const stats = await syncService.syncIteration(iterationName, { projectConfig: project }, (type, data) => send(type, data));
    syncHistoryService.addRun(project.label, iterationName, 'execute', stats);
  } catch (error) {
    logger.error('Execute SSE error:', error);
    send('error', { message: error.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

function getHistory(_req, res) {
  try {
    const rows = syncHistoryService.getHistory(50);
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur GET /api/sync/history:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function testApi(_req, res) {
  try {
    logger.info('Lancement test API Testmo...');
    const result = await syncService.testTestmoApi();
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/sync/test-api:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function syncIteration(req, res) {
  try {
    const { iteration, isTest = false, dryRun = false } = req.body;
    logger.info(`Lancement sync itération "${iteration}"...`);
    const result = await syncService.syncIteration(iteration, { isTest, dryRun });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/sync/iteration:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function statusToGitlab(req, res) {
  const { runId, iterationName, gitlabProjectId, dryRun = false, version } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, data = {}) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

  try {
    logger.info(`StatusSync: run=${runId} iteration="${iterationName}" glProject=${gitlabProjectId}`);
    await statusSyncService.syncRunStatusToGitLab(runId, iterationName, gitlabProjectId, (type, data) => send(type, data), Boolean(dryRun), version || null);
  } catch (error) {
    logger.error('Erreur POST /api/sync/status-to-gitlab:', error);
    send('error', { message: error.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}

async function testCleanup(_req, res) {
  try {
    const result = await syncService.cleanupTestFolder();
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur DELETE /api/sync/test-cleanup:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

function getAutoConfig(_req, res) {
  res.json({ success: true, data: autoSyncConfig.getConfig(), timestamp: new Date().toISOString() });
}

function updateAutoConfig(req, res) {
  try {
    const { enabled, runId, iterationName, gitlabProjectId } = req.body;
    const patch = {};
    if (enabled !== undefined) patch.enabled = Boolean(enabled);
    if (runId !== undefined) patch.runId = parseInt(runId);
    if (iterationName !== undefined) patch.iterationName = String(iterationName).trim();
    if (gitlabProjectId !== undefined) patch.gitlabProjectId = String(gitlabProjectId).trim();

    const updated = autoSyncConfig.updateConfig(patch);
    logger.info(`[AutoSync] Config mise à jour via API: ${JSON.stringify(updated)}`);
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Erreur PUT /api/sync/auto-config:', err);
    res.status(500).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
  }
}

module.exports = {
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
};
