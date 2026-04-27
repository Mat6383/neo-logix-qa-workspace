const testmoService = require('../services/testmo.service');
const logger = require('../services/logger.service');

function parseMilestones(query) {
  return query ? query.split(',').map(Number) : null;
}

async function getMetrics(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const preprod = parseMilestones(req.query.preprodMilestones);
    const prod = parseMilestones(req.query.prodMilestones);

    logger.info(`Récupération métriques pour projet ${projectId}`);
    const metrics = await testmoService.getProjectMetrics(projectId, preprod, prod);

    if (!metrics.slaStatus.ok) {
      logger.warn('Alertes SLA détectées:', { projectId, alerts: metrics.slaStatus.alerts });
    }

    res.json({ success: true, data: metrics, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function getQualityRates(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const preprod = parseMilestones(req.query.preprodMilestones);
    const prod = parseMilestones(req.query.prodMilestones);

    logger.info(`Récupération Quality Rates pour projet ${projectId}`);
    const rates = await testmoService.getEscapeAndDetectionRates(projectId, preprod, prod);

    res.json({ success: true, data: rates, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}/quality-rates:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function getAnnualTrends(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);

    logger.info(`Récupération Annual Trends pour projet ${projectId}`);
    const trends = await testmoService.getAnnualQualityTrends(projectId);

    res.json({ success: true, data: trends, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}/annual-trends:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

module.exports = { getMetrics, getQualityRates, getAnnualTrends };
