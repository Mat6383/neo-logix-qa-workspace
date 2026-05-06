'use strict';

const path = require('path');
const logger = require('./logger.service');

const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db', 'metrics-history.db');

let _alertsService = null;
function _getAlertsService() {
  if (!_alertsService) {
    try {
      _alertsService = require('./alerts.service').getAlertsService();
    } catch (_err) {
      // alerts service optional
    }
  }
  return _alertsService;
}

class MetricsHistoryService {
  constructor(dbPath) {
    this._dbPath = dbPath || DEFAULT_DB_PATH;
    this.db = null;
    this._initialized = false;
  }

  initDb() {
    if (this._initialized) return;

    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this._dbPath);

      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('busy_timeout = 5000');

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS metrics_snapshots (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id       INTEGER NOT NULL,
          project_name     TEXT    NOT NULL DEFAULT '',
          completion_rate  REAL,
          pass_rate        REAL,
          failure_rate     REAL,
          test_efficiency  REAL,
          total_tests      INTEGER,
          passed_tests     INTEGER,
          failed_tests     INTEGER,
          completed_tests  INTEGER,
          snapshot_date    TEXT    NOT NULL,
          created_at       TEXT    NOT NULL,
          UNIQUE(project_id, snapshot_date)
        )
      `);

      this._initialized = true;
      logger.info('MetricsHistory: SQLite initialisée → ' + this._dbPath);
    } catch (err) {
      logger.error("MetricsHistory: Impossible d'initialiser SQLite:", err.message);
    }
  }

  /**
   * Sauvegarde un snapshot ISTQB pour aujourd'hui (ou une date donnée).
   * Dedup: si un snapshot existe déjà pour (project_id, date), retourne l'existant sans INSERT.
   * @param {object} snap
   * @param {string} [dateOverride] YYYY-MM-DD (pour tests)
   * @returns {object} row inséré ou existant
   */
  saveSnapshot(snap, dateOverride) {
    if (!this.db) return null;

    const date = dateOverride || new Date().toISOString().slice(0, 10);
    const {
      projectId,
      projectName = '',
      completionRate = null,
      passRate = null,
      failureRate = null,
      testEfficiency = null,
      totalTests = null,
      passedTests = null,
      failedTests = null,
      completedTests = null,
    } = snap;

    // Check existing
    const existing = this.db
      .prepare('SELECT * FROM metrics_snapshots WHERE project_id = ? AND snapshot_date = ?')
      .get(projectId, date);
    if (existing) return existing;

    const stmt = this.db.prepare(`
      INSERT INTO metrics_snapshots
        (project_id, project_name, completion_rate, pass_rate, failure_rate,
         test_efficiency, total_tests, passed_tests, failed_tests, completed_tests,
         snapshot_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      projectId,
      projectName,
      completionRate ?? null,
      passRate ?? null,
      failureRate ?? null,
      testEfficiency ?? null,
      totalTests ?? null,
      passedTests ?? null,
      failedTests ?? null,
      completedTests ?? null,
      date,
      new Date().toISOString()
    );

    const inserted = this.db
      .prepare('SELECT * FROM metrics_snapshots WHERE id = ?')
      .get(result.lastInsertRowid);

    // Fire-and-forget: notif Slack si seuil SLA franchi
    if (snap.slaStatus) {
      const alertsSvc = _getAlertsService();
      if (alertsSvc) {
        alertsSvc.checkAndNotify(projectId, projectName, snap.slaStatus).catch(() => {});
      }
    }

    return inserted;
  }

  /**
   * Retourne les N derniers snapshots d'un projet, triés par date croissante.
   */
  getHistory(projectId, limit = 30) {
    if (!this.db) return [];
    return this.db
      .prepare(
        `SELECT * FROM metrics_snapshots
         WHERE project_id = ?
         ORDER BY snapshot_date ASC
         LIMIT ?`
      )
      .all(projectId, limit);
  }

  /**
   * Retourne le snapshot le plus récent pour un projet, ou null.
   */
  getLatest(projectId) {
    if (!this.db) return null;
    return (
      this.db
        .prepare(
          `SELECT * FROM metrics_snapshots
           WHERE project_id = ?
           ORDER BY snapshot_date DESC
           LIMIT 1`
        )
        .get(projectId) || null
    );
  }
}

let _instance = null;

function getMetricsHistoryService() {
  if (!_instance) {
    _instance = new MetricsHistoryService();
    _instance.initDb();
  }
  return _instance;
}

module.exports = MetricsHistoryService;
module.exports.getMetricsHistoryService = getMetricsHistoryService;
