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
const rateLimit = require('express-rate-limit');
const testmoService = require('./services/testmo.service');
const ReportService = require('./services/report.service');
const logger = require('./services/logger.service');
const reportService = new ReportService(testmoService);

// Routeurs
const healthRouter = require('./routes/health.routes');
const dashboardRouter = require('./routes/dashboard.routes');
const projectsRouter = require('./routes/projects.routes');
const runsRouter = require('./routes/runs.routes');
const syncRouter = require('./routes/sync.routes');
const reportsRouter = require('./routes/reports.routes');
const crosstestRouter = require('./routes/crosstest.routes');
const cacheRouter = require('./routes/cache.routes');
const featureFlagsRouter = require('./routes/featureFlags.routes');

// ==========================================
// Configuration Application
// ==========================================
const app = express();
const PORT = process.env.PORT || 3001;

// Validation des variables d'environnement critiques (ITIL Configuration Management)
const REQUIRED_ENV = ['TESTMO_URL', 'TESTMO_TOKEN', 'GITLAB_URL', 'GITLAB_TOKEN'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length > 0) {
  logger.error(`CONFIGURATION MANQUANTE: ${missingEnv.join(', ')} requis dans .env`);
  process.exit(1);
}

// Avertissements pour variables recommandées
const RECOMMENDED_ENV = ['GITLAB_WRITE_TOKEN', 'FRONTEND_URL', 'SYNC_TIMEZONE'];
RECOMMENDED_ENV.forEach(k => {
  if (!process.env[k]) {
    logger.warn(`[Config] Variable optionnelle non définie : ${k} (valeur par défaut utilisée)`);
  }
});

// ==========================================
// Middlewares de sécurité (ITIL Security)
// ==========================================
app.use(helmet()); // Protection headers HTTP
app.use(compression()); // Compression GZIP (LEAN)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — support multi-origines via FRONTEND_URL (virgule-séparé)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (ex: curl, Postman, health checks internes)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    logger.warn(`CORS: origine refusée — ${origin}`);
    callback(new Error(`CORS: origine non autorisée — ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Rate-limiting global (ITIL Availability Management — protection DoS)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // fenêtre d'1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes — réessayez dans une minute (rate limit: 200 req/min)'
  },
  skip: (req) => req.path === '/api/health' // health check jamais limité
});

// Rate-limiter plus strict sur les routes coûteuses
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_HEAVY_MAX) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Trop de requêtes sur cet endpoint — réessayez dans une minute'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/reports/generate', heavyLimiter);
app.use('/api/sync/execute', heavyLimiter);
app.use('/api/sync/status-to-gitlab', heavyLimiter);

// Middleware de logging des requêtes (ITIL Event Management)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// ==========================================
// ROUTES API — Routeurs montés
// ==========================================
app.use('/api/health', healthRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/runs', runsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/crosstest', crosstestRouter);
app.use('/api/cache', cacheRouter);
app.use('/api/feature-flags', featureFlagsRouter);

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
const SYNC_TIMEZONE = process.env.SYNC_TIMEZONE || 'Europe/Paris';

cron.schedule('*/5 8-17 * * 1-5', () => {
  const { enabled } = autoSyncConfig.getConfig();
  if (!enabled) {
    logger.debug('[AutoSync] Cron déclenché mais auto-sync désactivé — ignoré');
    return;
  }
  logger.info('[AutoSync] Cron déclenché');
  runAutoSync();
}, { timezone: SYNC_TIMEZONE });

logger.info(`[AutoSync] Cron enregistré — lun-ven 8h-18h toutes les 5 min (timezone: ${SYNC_TIMEZONE})`);
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
