'use strict';

const { getAlertsService } = require('../services/alerts.service');
const logger = require('../services/logger.service');

function getConfig(_req, res) {
  const svc = getAlertsService();
  res.json({ success: true, data: svc.getConfig(), timestamp: new Date().toISOString() });
}

function updateConfig(req, res) {
  try {
    const svc = getAlertsService();
    const current = svc.getConfig();
    const { enabled, slack_webhook_url, cooldown_hours, metrics } = req.body;
    const updated = {
      ...current,
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      ...(slack_webhook_url !== undefined && {
        slack_webhook_url: String(slack_webhook_url).trim(),
      }),
      ...(cooldown_hours !== undefined && { cooldown_hours: Number(cooldown_hours) }),
      ...(metrics && { metrics: { ...current.metrics, ...metrics } }),
    };
    svc.saveConfig(updated);
    logger.info(`[Alerts] Config mise à jour via API`);
    res.json({ success: true, data: svc.getConfig(), timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Erreur PUT /api/alerts/config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function testAlert(_req, res) {
  try {
    const svc = getAlertsService();
    const result = await svc.sendTest();
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Erreur POST /api/alerts/test:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getConfig, updateConfig, testAlert };
