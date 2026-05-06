'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger.service');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'data', 'alerts-config.json');
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db', 'metrics-history.db');

function _defaultConfig() {
  return {
    enabled: false,
    slack_webhook_url: '',
    cooldown_hours: 4,
    metrics: {
      passRate_critical: true,
      passRate_warning: false,
      completionRate_warning: true,
      blockedRate_warning: true,
    },
  };
}

class AlertsService {
  constructor({ configPath, dbPath } = {}) {
    this._configPath = configPath || DEFAULT_CONFIG_PATH;
    this._dbPath = dbPath || DEFAULT_DB_PATH;
    this._config = this._loadConfig();
    this._db = null;
    if (this._dbPath !== ':memory:') this._initDb();
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this._configPath)) {
        return JSON.parse(fs.readFileSync(this._configPath, 'utf-8'));
      }
    } catch (err) {
      logger.warn(`[Alerts] Impossible de lire config: ${err.message}`);
    }
    return _defaultConfig();
  }

  getConfig() {
    return { ...this._config, metrics: { ...this._config.metrics } };
  }

  saveConfig(config) {
    this._config = config;
    try {
      const dir = path.dirname(this._configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._configPath, JSON.stringify(config, null, 2), 'utf-8');
      logger.info('[Alerts] Config sauvegardée');
    } catch (err) {
      logger.error(`[Alerts] Impossible de sauvegarder config: ${err.message}`);
    }
  }

  _initDb() {
    if (this._db) return;
    try {
      const Database = require('better-sqlite3');
      this._db = new Database(this._dbPath);
      this._db.pragma('journal_mode = WAL');
      this._db.exec(`
        CREATE TABLE IF NOT EXISTS alert_cooldowns (
          project_id   TEXT PRIMARY KEY,
          last_sent_at TEXT NOT NULL
        )
      `);
    } catch (err) {
      logger.error(`[Alerts] Impossible d'initialiser SQLite: ${err.message}`);
    }
  }

  _isCoolingDown(projectId, cooldownHours) {
    if (!this._db) return false;
    const row = this._db
      .prepare('SELECT last_sent_at FROM alert_cooldowns WHERE project_id = ?')
      .get(String(projectId));
    if (!row) return false;
    const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 3600000;
    return elapsed < cooldownHours;
  }

  _updateCooldown(projectId) {
    if (!this._db) return;
    this._db
      .prepare('INSERT OR REPLACE INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)')
      .run(String(projectId), new Date().toISOString());
  }

  _alertMatchesConfig(alert) {
    const { metrics } = this._config;
    if (alert.metric === 'Pass Rate' && alert.severity === 'critical') return metrics.passRate_critical;
    if (alert.metric === 'Pass Rate' && alert.severity === 'warning')  return metrics.passRate_warning;
    if (alert.metric === 'Completion Rate')                             return metrics.completionRate_warning;
    if (alert.metric === 'Blocked Rate')                               return metrics.blockedRate_warning;
    return true;
  }

  _buildPayload(projectName, alerts) {
    const lines = alerts.map(a => `• ${a.severity.toUpperCase()} — ${a.message}`).join('\n');
    return {
      text: `🚨 [${projectName}] Alerte QA — ${alerts.length} problème(s) détecté(s)\n${lines}`,
    };
  }

  async _postWebhook(url, payload) {
    const fetch = require('node-fetch');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Slack webhook HTTP ${res.status}`);
  }

  async checkAndNotify(projectId, projectName, slaStatus) {
    const cfg = this.getConfig();
    if (!cfg.enabled || !cfg.slack_webhook_url || !slaStatus || slaStatus.ok) return;
    if (this._isCoolingDown(String(projectId), cfg.cooldown_hours)) return;

    const filtered = (slaStatus.alerts || []).filter(a => this._alertMatchesConfig(a));
    if (filtered.length === 0) return;

    const payload = this._buildPayload(projectName, filtered);
    try {
      await this._postWebhook(cfg.slack_webhook_url, payload);
      this._updateCooldown(String(projectId));
      logger.info(`[Alerts] Notification Slack envoyée pour projet ${projectName}`);
    } catch (err) {
      logger.error(`[Alerts] Échec envoi Slack: ${err.message}`);
    }
  }

  async sendTest() {
    const cfg = this.getConfig();
    if (!cfg.slack_webhook_url) {
      return { ok: false, error: 'Webhook URL non configurée' };
    }
    try {
      await this._postWebhook(cfg.slack_webhook_url, {
        text: '✅ [QA Dashboard] Test de connexion Slack OK',
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

let _instance = null;
function getAlertsService() {
  if (!_instance) _instance = new AlertsService();
  return _instance;
}

module.exports = AlertsService;
module.exports.getAlertsService = getAlertsService;
