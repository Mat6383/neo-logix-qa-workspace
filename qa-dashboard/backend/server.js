/**
 * ================================================
 * TESTMO DASHBOARD - Backend Server
 * ================================================
 * Serveur Express sécurisé pour API Testmo
 * 
 * Standards:
 * - ISTQB: Métriques de test standardisées
 * - ITIL: Service management et logging
 * - LEAN: Cache et optimisation des requêtes
 * - DevOps: Sécurité et bonnes pratiques
 * 
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const testmoService = require('./services/testmo.service');
const ReportService = require('./services/report.service');
const logger = require('./services/logger.service');
const reportService = new ReportService(testmoService);

// ==========================================
// Configuration Application
// ==========================================
const app = express();
const PORT = process.env.PORT || 3001;

// Validation des variables d'environnement critiques
if (!process.env.TESTMO_URL || !process.env.TESTMO_TOKEN) {
  logger.error('CONFIGURATION MANQUANTE: TESTMO_URL et TESTMO_TOKEN requis dans .env');
  process.exit(1);
}

// ==========================================
// Middlewares de sécurité (ITIL Security)
// ==========================================
app.use(helmet()); // Protection headers HTTP
app.use(compression()); // Compression GZIP (LEAN)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Middleware de logging des requêtes (ITIL Event Management)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ==========================================
// ROUTES API
// ==========================================

/**
 * Route de santé (Health Check)
 * DevOps: Monitoring et disponibilité
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

/**
 * Liste tous les projets Testmo
 * ISTQB: Test Project Scope
 */
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await testmoService.getProjects();

    res.json({
      success: true,
      data: projects,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erreur GET /api/projects:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Métriques ISTQB complètes d'un projet
 * ISTQB Section 5.4.2: Test Summary Report
 * Endpoint principal du dashboard
 */
app.get('/api/dashboard/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Project ID invalide'
      });
    }

    const preprodMilestones = req.query.preprodMilestones ? req.query.preprodMilestones.split(',').map(Number) : null;
    const prodMilestones = req.query.prodMilestones ? req.query.prodMilestones.split(',').map(Number) : null;

    logger.info(`Récupération métriques pour projet ${projectId}`);
    const metrics = await testmoService.getProjectMetrics(projectId, preprodMilestones, prodMilestones);

    // Log des alertes SLA (ITIL)
    if (!metrics.slaStatus.ok) {
      logger.warn('Alertes SLA détectées:', {
        projectId,
        alerts: metrics.slaStatus.alerts
      });
    }

    res.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Taux d'échappement et de détection
 * Endpoint pour le Dashboard 3
 */
app.get('/api/dashboard/:projectId/quality-rates', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Project ID invalide'
      });
    }

    const preprodMilestones = req.query.preprodMilestones ? req.query.preprodMilestones.split(',').map(Number) : null;
    const prodMilestones = req.query.prodMilestones ? req.query.prodMilestones.split(',').map(Number) : null;

    logger.info(`Récupération Quality Rates pour projet ${projectId}`);
    const rates = await testmoService.getEscapeAndDetectionRates(projectId, preprodMilestones, prodMilestones);

    res.json({
      success: true,
      data: rates,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}/quality-rates:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Tendances annuelles de qualité (Dashboard 5)
 * ISTQB: Test Process Improvement
 */
app.get('/api/dashboard/:projectId/annual-trends', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Project ID invalide'
      });
    }

    logger.info(`Récupération Annual Trends pour projet ${projectId}`);
    const trends = await testmoService.getAnnualQualityTrends(projectId);

    res.json({
      success: true,
      data: trends,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}/annual-trends:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liste des runs actifs d'un projet
 * ISTQB: Test Monitoring
 */
app.get('/api/projects/:projectId/runs', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const activeOnly = req.query.active !== 'false'; // Par défaut: actifs seulement

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Project ID invalide'
      });
    }

    const runs = await testmoService.getProjectRuns(projectId, activeOnly);

    res.json({
      success: true,
      data: runs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/projects/${req.params.projectId}/runs:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Liste des milestones d'un projet
 */
app.get('/api/projects/:projectId/milestones', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Project ID invalide'
      });
    }

    const milestones = await testmoService.getProjectMilestones(projectId);

    res.json({
      success: true,
      data: milestones,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/projects/${req.params.projectId}/milestones:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Détails d'un run spécifique
 * ISTQB: Test Reporting
 */
app.get('/api/runs/:runId', async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);

    if (isNaN(runId)) {
      return res.status(400).json({
        success: false,
        error: 'Run ID invalide'
      });
    }

    const runDetails = await testmoService.getRunDetails(runId);

    res.json({
      success: true,
      data: runDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/runs/${req.params.runId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Résultats détaillés d'un run
 * API Testmo 2025: Nouveau endpoint
 */
app.get('/api/runs/:runId/results', async (req, res) => {
  try {
    const runId = parseInt(req.params.runId);
    const statusFilter = req.query.status; // Ex: '3,5' pour Failed+Blocked

    if (isNaN(runId)) {
      return res.status(400).json({
        success: false,
        error: 'Run ID invalide'
      });
    }

    const results = await testmoService.getRunResults(runId, statusFilter);

    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/runs/${req.params.runId}/results:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Runs d'automation d'un projet
 * ISTQB: Automated Testing
 */
app.get('/api/projects/:projectId/automation', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'Project ID invalide'
      });
    }

    const automationRuns = await testmoService.getAutomationRuns(projectId);

    res.json({
      success: true,
      data: automationRuns,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`Erreur GET /api/projects/${req.params.projectId}/automation:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Nettoie le cache (maintenance)
 * LEAN: Gestion optimisée du cache
 */
app.post('/api/cache/clear', (req, res) => {
  try {
    testmoService.clearCache();
    logger.info('Cache cleared manually');

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erreur POST /api/cache/clear:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ==========================================
// ROUTES REPORT GENERATION
// ==========================================

/**
 * Génère un rapport de clôture de tests (HTML et/ou PPTX)
 * ISTQB §5.4.2 Test Closure Report
 */
app.post('/api/reports/generate', async (req, res) => {
  try {
    const { projectId, milestoneId, formats, recommendations, complement } = req.body;

    if (!projectId || !milestoneId) {
      return res.status(400).json({ success: false, error: 'projectId et milestoneId requis' });
    }
    if (!formats || (!formats.html && !formats.pptx)) {
      return res.status(400).json({ success: false, error: 'Au moins un format (html/pptx) requis' });
    }

    logger.info(`Génération rapport: project=${projectId}, milestone=${milestoneId}, formats=${JSON.stringify(formats)}`);

    // 1. Collect data
    const data = await reportService.collectReportData(projectId, milestoneId);

    const result = { success: true, files: {} };

    // 2. Generate HTML
    if (formats.html) {
      const htmlContent = reportService.generateHTML(data, recommendations, complement);
      result.files.html = Buffer.from(htmlContent, 'utf-8').toString('base64');
      result.files.htmlFilename = `${data.milestoneName}_Cloture_Tests.html`;
    }

    // 3. Generate PPTX
    if (formats.pptx) {
      const pres = await reportService.generatePPTX(data, recommendations, complement);
      const pptxBuffer = await pres.write({ outputType: 'nodebuffer' });
      result.files.pptx = pptxBuffer.toString('base64');
      result.files.pptxFilename = `${data.milestoneName}_Cloture_Tests.pptx`;
    }

    result.summary = {
      milestone: data.milestoneName,
      verdict: data.verdict,
      totalTests: data.stats.totalTests,
      passRate: data.stats.passRate,
      failedTests: data.failedTests.length,
    };

    logger.info(`Rapport généré: ${data.milestoneName} — ${data.verdict}`);
    res.json(result);

  } catch (error) {
    logger.error('Erreur POST /api/reports/generate:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ROUTES SYNC GitLab → Testmo
// ==========================================
const syncService = require('./services/sync.service');
const syncHistoryService = require('./services/syncHistory.service');
const PROJECTS = require('./config/projects.config');
const gitlabServiceInstance = require('./services/gitlab.service');
const statusSyncService = require('./services/status-sync.service');

// Initialise SQLite au démarrage
syncHistoryService.initDb();

// ---- Dashboard 6: Multi-project Sync API --------------------------------

/**
 * GET /api/sync/projects
 * Retourne la liste des projets configurés (id, label, configured)
 */
app.get('/api/sync/projects', (req, res) => {
  const list = PROJECTS.map(p => ({
    id:         p.id,
    label:      p.label,
    configured: p.configured
  }));
  res.json({ success: true, data: list, timestamp: new Date().toISOString() });
});

/**
 * GET /api/sync/:projectId/iterations
 * Recherche les itérations GitLab d'un projet
 * Query: ?search=R14
 */
app.get('/api/sync/:projectId/iterations', async (req, res) => {
  try {
    const { projectId } = req.params;
    const search = req.query.search || '';

    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    }
    if (!project.configured) {
      return res.status(400).json({ success: false, error: `Projet "${project.label}" non configuré (pas d'accès GitLab)` });
    }
    if (!project.gitlab.projectId) {
      return res.status(400).json({ success: false, error: `Projet "${project.label}" sans projectId GitLab` });
    }

    const iterations = await gitlabServiceInstance.searchIterations(project.gitlab.projectId, search);

    res.json({
      success: true,
      data: iterations.map(it => ({
        id:    it.id,
        title: it.title,
        state: it.state,
        web_url: it.web_url
      })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Erreur GET /api/sync/${req.params.projectId}/iterations:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/sync/preview
 * Body: { projectId, iterationName }
 * Dry-run — retourne { iteration, folder, issues, summary }
 */
app.post('/api/sync/preview', async (req, res) => {
  try {
    const { projectId, iterationName } = req.body;
    if (!projectId || !iterationName) {
      return res.status(400).json({ success: false, error: '"projectId" et "iterationName" requis' });
    }

    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    }
    if (!project.configured) {
      return res.status(400).json({
        success: false,
        error: `Projet "${project.label}" non configuré — accès GitLab manquant`
      });
    }

    logger.info(`Preview: ${project.label} / "${iterationName}"`);
    const preview = await syncService.previewIteration(iterationName, project);

    // Enregistrer le preview en historique
    syncHistoryService.addRun(project.label, iterationName, 'preview', {
      created: preview.summary.toCreate,
      updated: preview.summary.toUpdate,
      skipped: preview.summary.toSkip,
      total:   preview.summary.total
    });

    res.json({ success: true, data: preview, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/sync/preview:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/sync/execute
 * Body: { projectId, iterationName }
 * Exécute la synchronisation avec streaming SSE
 */
app.post('/api/sync/execute', async (req, res) => {
  const { projectId, iterationName } = req.body;

  if (!projectId || !iterationName) {
    return res.status(400).json({ success: false, error: '"projectId" et "iterationName" requis' });
  }

  const project = PROJECTS.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
  }
  if (!project.configured) {
    return res.status(400).json({
      success: false,
      error: `Projet "${project.label}" non configuré — accès GitLab manquant`
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // désactive le buffering nginx si présent
  res.flushHeaders();

  const send = (type, data = {}) => {
    const payload = JSON.stringify({ type, ...data });
    res.write(`data: ${payload}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  // Heartbeat pour garder la connexion vivante
  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  try {
    logger.info(`Execute: ${project.label} / "${iterationName}"`);

    const stats = await syncService.syncIteration(
      iterationName,
      { projectConfig: project },
      (type, data) => send(type, data)
    );

    // Enregistrer en historique
    syncHistoryService.addRun(project.label, iterationName, 'execute', stats);

    // 'done' a déjà été émis par syncIteration, mais on s'assure
    if (!stats.error) {
      // déjà émis — ne pas doubler
    }
  } catch (error) {
    logger.error('Execute SSE error:', error);
    send('error', { message: error.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * GET /api/sync/history
 * Retourne les 50 derniers runs depuis SQLite
 */
app.get('/api/sync/history', (req, res) => {
  try {
    const rows = syncHistoryService.getHistory(50);
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur GET /api/sync/history:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ---- Fin Dashboard 6 ---------------------------------------------------

// ==========================================
// ROUTES DASHBOARD 7 — CrossTest OK
// ==========================================
const commentsService = require('./services/comments.service');
commentsService.init();

const CROSSTEST_PROJECT_ID = 63;

/**
 * GET /api/crosstest/iterations
 * Liste les itérations GitLab du projet 63 (avec filtre search optionnel)
 */
app.get('/api/crosstest/iterations', async (req, res) => {
  try {
    const search = req.query.search || '';
    const iterations = await gitlabServiceInstance.searchIterations(CROSSTEST_PROJECT_ID, search);
    res.json({
      success: true,
      data: iterations.map(it => ({ id: it.id, title: it.title, state: it.state })),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Erreur GET /api/crosstest/iterations:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/crosstest/issues/:iterationId
 * Issues avec label CrossTest::OK pour l'itération donnée
 */
app.get('/api/crosstest/issues/:iterationId', async (req, res) => {
  try {
    const iterationId = parseInt(req.params.iterationId);
    if (isNaN(iterationId)) {
      return res.status(400).json({ success: false, error: 'iterationId invalide' });
    }

    const issues = await gitlabServiceInstance.getIssuesByLabelAndIterationForProject(
      CROSSTEST_PROJECT_ID,
      'CrossTest::OK',
      iterationId
    );

    const data = issues.map(issue => ({
      iid:        issue.iid,
      title:      issue.title,
      url:        issue.web_url,
      state:      issue.state,
      assignees:  (issue.assignees || []).map(a => a.name),
      labels:     (issue.labels || []).filter(l => l !== 'CrossTest::OK'),
      created_at: issue.created_at,
      closed_at:  issue.closed_at || null
    }));

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/crosstest/issues/${req.params.iterationId}:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * GET /api/crosstest/comments
 * Tous les commentaires (indexés par issue_iid)
 */
app.get('/api/crosstest/comments', (req, res) => {
  try {
    const data = commentsService.getAll();
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur GET /api/crosstest/comments:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/crosstest/comments
 * Crée ou met à jour un commentaire { issue_iid, comment, milestone_context }
 */
app.post('/api/crosstest/comments', (req, res) => {
  try {
    const { issue_iid, comment, milestone_context } = req.body;
    if (!issue_iid || !comment) {
      return res.status(400).json({ success: false, error: '"issue_iid" et "comment" requis' });
    }
    const row = commentsService.upsert(issue_iid, comment, milestone_context || null);
    res.json({ success: true, data: row, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/crosstest/comments:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * PUT /api/crosstest/comments/:iid
 * Met à jour le texte d'un commentaire { comment, milestone_context }
 */
app.put('/api/crosstest/comments/:iid', (req, res) => {
  try {
    const iid = parseInt(req.params.iid);
    if (isNaN(iid)) {
      return res.status(400).json({ success: false, error: 'iid invalide' });
    }
    const { comment, milestone_context } = req.body;
    if (!comment) {
      return res.status(400).json({ success: false, error: '"comment" requis' });
    }
    const row = commentsService.upsert(iid, comment, milestone_context || null);
    res.json({ success: true, data: row, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur PUT /api/crosstest/comments/${req.params.iid}:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * DELETE /api/crosstest/comments/:iid
 * Supprime le commentaire d'une issue
 */
app.delete('/api/crosstest/comments/:iid', (req, res) => {
  try {
    const iid = parseInt(req.params.iid);
    if (isNaN(iid)) {
      return res.status(400).json({ success: false, error: 'iid invalide' });
    }
    const deleted = commentsService.delete(iid);
    res.json({ success: true, deleted, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur DELETE /api/crosstest/comments/${req.params.iid}:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ---- Fin Dashboard 7 ---------------------------------------------------

/**
 * Test API Testmo — Valide les endpoints folders/cases (beta)
 * Crée un dossier [TEST-API] R06 > R06 - run 1 + un case de test
 */
app.post('/api/sync/test-api', async (req, res) => {
  try {
    logger.info('Lancement test API Testmo...');
    const result = await syncService.testTestmoApi();
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/sync/test-api:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * Synchronise une itération GitLab vers Testmo
 * Body: { iteration: "R06 - run 1", isTest: false, dryRun: false }
 */
app.post('/api/sync/iteration', async (req, res) => {
  try {
    const { iteration, isTest = false, dryRun = false } = req.body;
    if (!iteration) {
      return res.status(400).json({ success: false, error: 'Paramètre "iteration" requis' });
    }
    logger.info(`Lancement sync itération "${iteration}"...`);
    const result = await syncService.syncIteration(iteration, { isTest, dryRun });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur POST /api/sync/iteration:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

/**
 * POST /api/sync/status-to-gitlab
 * Synchronise les statuts Testmo d'un run vers les labels GitLab.
 * Utilise SSE pour le streaming de la progression.
 *
 * Body: { runId, iterationName, gitlabProjectId }
 *   runId           - ID du run Testmo (ex: 283)
 *   iterationName   - Nom de l'itération GitLab (ex: "R14 - run 1")
 *   gitlabProjectId - ID du projet GitLab (ex: 42)
 */
app.post('/api/sync/status-to-gitlab', async (req, res) => {
  const { runId, iterationName, gitlabProjectId, dryRun = false } = req.body;

  if (!runId || !iterationName || !gitlabProjectId) {
    return res.status(400).json({
      success: false,
      error: '"runId", "iterationName" et "gitlabProjectId" requis'
    });
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (type, data = {}) => {
    const payload = JSON.stringify({ type, ...data });
    res.write(`data: ${payload}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  try {
    logger.info(`StatusSync: run=${runId} iteration="${iterationName}" glProject=${gitlabProjectId}`);

    await statusSyncService.syncRunStatusToGitLab(
      parseInt(runId),
      iterationName,
      gitlabProjectId,
      (type, data) => send(type, data),
      Boolean(dryRun)
    );
  } catch (error) {
    logger.error('Erreur POST /api/sync/status-to-gitlab:', error);
    send('error', { message: error.message });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
});

/**
 * Nettoyage du dossier de test [TEST-API]
 */
app.delete('/api/sync/test-cleanup', async (req, res) => {
  try {
    const result = await syncService.cleanupTestFolder();
    res.json({ success: result.success, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Erreur DELETE /api/sync/test-cleanup:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// ─── Routes API : lecture / mise à jour de la config cron auto-sync ──────────

/**
 * GET /api/sync/auto-config
 * Retourne la configuration courante du cron auto-sync
 */
app.get('/api/sync/auto-config', (req, res) => {
  res.json({ success: true, data: autoSyncConfig.getConfig(), timestamp: new Date().toISOString() });
});

/**
 * PUT /api/sync/auto-config
 * Met à jour la config à chaud (pas de redémarrage nécessaire)
 *
 * Body (tous les champs sont optionnels) :
 *   { enabled, runId, iterationName, gitlabProjectId }
 */
app.put('/api/sync/auto-config', (req, res) => {
  try {
    const { enabled, runId, iterationName, gitlabProjectId } = req.body;
    const patch = {};
    if (enabled          !== undefined) patch.enabled         = Boolean(enabled);
    if (runId            !== undefined) patch.runId           = parseInt(runId);
    if (iterationName    !== undefined) patch.iterationName   = String(iterationName).trim();
    if (gitlabProjectId  !== undefined) patch.gitlabProjectId = String(gitlabProjectId).trim();

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'Aucun champ valide fourni (enabled, runId, iterationName, gitlabProjectId)' });
    }

    const updated = autoSyncConfig.updateConfig(patch);
    logger.info(`[AutoSync] Config mise à jour via API: ${JSON.stringify(updated)}`);
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Erreur PUT /api/sync/auto-config:', err);
    res.status(500).json({ success: false, error: err.message, timestamp: new Date().toISOString() });
  }
});

// ==========================================
// Gestion des erreurs 404
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// Gestion globale des erreurs (ITIL)
// ==========================================
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Erreur interne du serveur'
      : err.message,
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// AUTO-SYNC CRON — Testmo → GitLab
// ==========================================
// Toutes les 5 minutes, lundi-vendredi de 8h à 18h
// Expression cron : */5 8-17 * * 1-5
// (heure 8-17 = de 8:00 à 17:55, dernière exécution avant 18h)

const cron           = require('node-cron');
const autoSyncConfig = require('./services/auto-sync-config.service');

/**
 * Lance la sync automatique Testmo → GitLab
 * sans SSE (logging uniquement).
 * Lit la config depuis autoSyncConfig (dynamique, modifiable à chaud).
 */
async function runAutoSync() {
  const { valid, errors } = autoSyncConfig.validate();
  if (!valid) {
    logger.warn(`[AutoSync] Config invalide — sync ignorée: ${errors.join(', ')}`);
    return;
  }

  const { runId, iterationName, gitlabProjectId } = autoSyncConfig.getConfig();
  logger.info(`[AutoSync] Démarrage — run=${runId} iteration="${iterationName}" glProject=${gitlabProjectId}`);

  try {
    const stats = await statusSyncService.syncRunStatusToGitLab(
      runId,
      iterationName,
      gitlabProjectId,
      (type, data) => {
        if (type === 'updated')   logger.info(`[AutoSync] ✓ #${data.issueIid} "${data.caseName}" → ${data.label}`);
        else if (type === 'error') logger.error(`[AutoSync] ✗ #${data.issueIid} "${data.caseName}": ${data.error}`);
        else if (type === 'done')  logger.info(`[AutoSync] Terminé — updated=${data.updated} skipped=${data.skipped} errors=${data.errors}`);
        else if (type === 'warn')  logger.warn(`[AutoSync] ${data.message}`);
      },
      false // dryRun = false
    );
    logger.info(`[AutoSync] Stats: updated=${stats.updated} skipped=${stats.skipped} errors=${stats.errors} total=${stats.total}`);
  } catch (err) {
    logger.error(`[AutoSync] Erreur critique: ${err.message}`);
  }
}

// Cron toujours enregistré — c'est le flag `enabled` dans la config qui pilote
cron.schedule('*/5 8-17 * * 1-5', () => {
  const { enabled } = autoSyncConfig.getConfig();
  if (!enabled) {
    logger.debug('[AutoSync] Cron déclenché mais auto-sync désactivé — ignoré');
    return;
  }
  logger.info('[AutoSync] Cron déclenché');
  runAutoSync();
}, { timezone: 'Europe/Paris' });

logger.info('[AutoSync] Cron enregistré — lun-ven 8h-18h toutes les 5 min (Europe/Paris)');
logger.info(`[AutoSync] Config initiale: ${JSON.stringify(autoSyncConfig.getConfig())}`);

// ==========================================
// Démarrage du serveur
// ==========================================
app.listen(PORT, () => {
  logger.info(`
╔════════════════════════════════════════════════╗
║   TESTMO DASHBOARD - Backend Server Started   ║
╠════════════════════════════════════════════════╣
║  Port:        ${PORT}                            
║  Environment: ${process.env.NODE_ENV || 'development'}                   
║  Testmo URL:  ${process.env.TESTMO_URL}        
║  Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:3000'}    
╠════════════════════════════════════════════════╣
║  Standards: ISTQB | LEAN | ITIL | DevOps      ║
║  Author: Matou - Neo-Logix QA Lead            ║
╚════════════════════════════════════════════════╝
  `);

  logger.info('Server ready to accept connections');
});

// Gestion propre de l'arrêt (ITIL Change Management)
process.on('SIGTERM', () => {
  logger.info('SIGTERM reçu - Arrêt gracieux du serveur');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT reçu - Arrêt gracieux du serveur');
  process.exit(0);
});

module.exports = app;
