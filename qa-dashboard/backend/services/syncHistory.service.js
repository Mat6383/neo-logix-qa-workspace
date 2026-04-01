/**
 * ================================================
 * SYNC HISTORY SERVICE - SQLite persistence
 * ================================================
 * Persiste l'historique des synchronisations GitLab → Testmo
 * dans une base SQLite locale.
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

const path = require('path');
const logger = require('./logger.service');

const DB_PATH = path.join(__dirname, '..', 'db', 'sync-history.db');

class SyncHistoryService {
  constructor() {
    this.db = null;
    this._initialized = false;
  }

  /**
   * Initialise la base SQLite et crée la table si elle n'existe pas.
   */
  initDb() {
    if (this._initialized) return;

    try {
      // Lazy-require to avoid crashing server if package missing
      const Database = require('better-sqlite3');
      this.db = new Database(DB_PATH);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sync_runs (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          project_name   TEXT    NOT NULL,
          iteration_name TEXT    NOT NULL,
          mode           TEXT    NOT NULL,
          created        INTEGER NOT NULL DEFAULT 0,
          updated        INTEGER NOT NULL DEFAULT 0,
          skipped        INTEGER NOT NULL DEFAULT 0,
          enriched       INTEGER NOT NULL DEFAULT 0,
          errors         INTEGER NOT NULL DEFAULT 0,
          total_issues   INTEGER NOT NULL DEFAULT 0,
          executed_at    TEXT    NOT NULL
        )
      `);

      this._initialized = true;
      logger.info('SyncHistory: Base SQLite initialisée → ' + DB_PATH);
    } catch (err) {
      logger.error('SyncHistory: Impossible d\'initialiser SQLite:', err.message);
    }
  }

  /**
   * Insère un enregistrement de run de synchronisation.
   *
   * @param {string} projectName   - Nom du projet (ex: "Neo-Pilot")
   * @param {string} iterationName - Nom de l'itération (ex: "R14 - run 1")
   * @param {string} mode          - 'preview' ou 'execute'
   * @param {Object} results       - { created, updated, skipped, enriched, errors, total }
   * @returns {number|null} ID de la ligne insérée, ou null en cas d'erreur
   */
  addRun(projectName, iterationName, mode, results = {}) {
    if (!this._initialized) this.initDb();
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_runs
          (project_name, iteration_name, mode, created, updated, skipped, enriched, errors, total_issues, executed_at)
        VALUES
          (@project_name, @iteration_name, @mode, @created, @updated, @skipped, @enriched, @errors, @total_issues, @executed_at)
      `);

      const info = stmt.run({
        project_name:   projectName,
        iteration_name: iterationName,
        mode,
        created:        results.created   || 0,
        updated:        results.updated   || 0,
        skipped:        results.skipped   || 0,
        enriched:       results.enriched  || 0,
        errors:         results.errors    || 0,
        total_issues:   results.total     || 0,
        executed_at:    new Date().toISOString()
      });

      logger.info(`SyncHistory: run ${info.lastInsertRowid} enregistré (${projectName} / ${iterationName} / ${mode})`);
      return info.lastInsertRowid;
    } catch (err) {
      logger.error('SyncHistory: Erreur insertion:', err.message);
      return null;
    }
  }

  /**
   * Retourne les derniers runs, du plus récent au plus ancien.
   *
   * @param {number} limit - Nombre max de résultats (défaut 50)
   * @returns {Array}
   */
  getHistory(limit = 50) {
    if (!this._initialized) this.initDb();
    if (!this.db) return [];

    try {
      const rows = this.db
        .prepare('SELECT * FROM sync_runs ORDER BY id DESC LIMIT ?')
        .all(limit);
      return rows;
    } catch (err) {
      logger.error('SyncHistory: Erreur lecture historique:', err.message);
      return [];
    }
  }
}

module.exports = new SyncHistoryService();
