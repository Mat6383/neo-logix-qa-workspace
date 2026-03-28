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
    const { projectId, milestoneId, formats, recommendations } = req.body;

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
      const htmlContent = reportService.generateHTML(data, recommendations);
      result.files.html = Buffer.from(htmlContent, 'utf-8').toString('base64');
      result.files.htmlFilename = `${data.milestoneName}_Cloture_Tests.html`;
    }

    // 3. Generate PPTX
    if (formats.pptx) {
      const pres = await reportService.generatePPTX(data, recommendations);
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
