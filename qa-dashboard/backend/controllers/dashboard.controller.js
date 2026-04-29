const { getIstqbMetricsService } = require('../services/istqb-metrics.service');
const logger = require('../services/logger.service');

function parseMilestones(query) {
  if (!query) return null;
  const ids = query
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  return ids.length > 0 ? ids : null;
}

async function getMetrics(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const preprod = parseMilestones(req.query.preprodMilestones);
    const prod = parseMilestones(req.query.prodMilestones);

    logger.info(`Récupération métriques pour projet ${projectId}`);
    const metrics = await getIstqbMetricsService().getProjectMetrics(projectId, preprod, prod);

    if (!metrics.slaStatus.ok) {
      logger.warn('Alertes SLA détectées:', { projectId, alerts: metrics.slaStatus.alerts });
    }

    res.json({ success: true, data: metrics, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}:`, error);
    res
      .status(500)
      .json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function getQualityRates(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);
    const preprod = parseMilestones(req.query.preprodMilestones);
    const prod = parseMilestones(req.query.prodMilestones);

    logger.info(`Récupération Quality Rates pour projet ${projectId}`);
    const rates = await getIstqbMetricsService().getEscapeAndDetectionRates(
      projectId,
      preprod,
      prod
    );

    res.json({ success: true, data: rates, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}/quality-rates:`, error);
    res
      .status(500)
      .json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

async function getAnnualTrends(req, res) {
  try {
    const projectId = parseInt(req.params.projectId);

    logger.info(`Récupération Annual Trends pour projet ${projectId}`);
    const trends = await getIstqbMetricsService().getAnnualQualityTrends(projectId);

    res.json({ success: true, data: trends, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur GET /api/dashboard/${req.params.projectId}/annual-trends:`, error);
    res
      .status(500)
      .json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
}

module.exports = { getMetrics, getQualityRates, getAnnualTrends, parseMilestones };
