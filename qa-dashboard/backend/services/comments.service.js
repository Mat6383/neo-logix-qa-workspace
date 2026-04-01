/**
 * ================================================
 * COMMENTS SERVICE - CrossTest OK Dashboard 7
 * ================================================
 * Persistance SQLite des commentaires par issue GitLab
 * One comment per issue (upsert on conflict)
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

const Database = require('better-sqlite3');
const path = require('path');
const logger = require('./logger.service');

class CommentsService {
  constructor() {
    this.db = null;
  }

  /**
   * Initialise la base de données SQLite et crée la table si besoin
   */
  init() {
    try {
      const dbPath = path.join(__dirname, '../db/crosstest-comments.db');
      this.db = new Database(dbPath);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS crosstest_comments (
          id                INTEGER PRIMARY KEY AUTOINCREMENT,
          issue_iid         INTEGER NOT NULL,
          gitlab_project_id INTEGER NOT NULL DEFAULT 63,
          milestone_context TEXT,
          comment           TEXT NOT NULL,
          created_at        TEXT NOT NULL,
          updated_at        TEXT NOT NULL,
          UNIQUE(issue_iid, gitlab_project_id)
        );

        CREATE INDEX IF NOT EXISTS idx_crosstest_comments_issue
          ON crosstest_comments(issue_iid, gitlab_project_id);
      `);

      logger.info('CommentsService: SQLite initialisé (crosstest-comments.db)');
    } catch (error) {
      logger.error('CommentsService: Erreur initialisation SQLite:', error);
      throw error;
    }
  }

  /**
   * Retourne tous les commentaires sous forme d'objet indexé par issue_iid
   * @returns {Object} { [iid]: { id, issue_iid, comment, milestone_context, created_at, updated_at } }
   */
  getAll() {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM crosstest_comments WHERE gitlab_project_id = 63 ORDER BY updated_at DESC'
      ).all();

      const result = {};
      for (const row of rows) {
        result[row.issue_iid] = row;
      }
      return result;
    } catch (error) {
      logger.error('CommentsService: Erreur getAll:', error);
      throw error;
    }
  }

  /**
   * Insère ou met à jour un commentaire (upsert)
   * @param {number} iid               - GitLab issue IID
   * @param {string} comment           - Texte du commentaire
   * @param {string} milestoneContext  - ex: "R06"
   * @returns {Object} La ligne insérée/mise à jour
   */
  upsert(iid, comment, milestoneContext = null) {
    try {
      const now = new Date().toISOString();
      const stmt = this.db.prepare(`
        INSERT INTO crosstest_comments (issue_iid, gitlab_project_id, milestone_context, comment, created_at, updated_at)
        VALUES (@iid, 63, @milestoneContext, @comment, @now, @now)
        ON CONFLICT(issue_iid, gitlab_project_id) DO UPDATE SET
          comment           = excluded.comment,
          milestone_context = excluded.milestone_context,
          updated_at        = excluded.updated_at
      `);
      stmt.run({ iid, milestoneContext, comment, now });

      const row = this.db.prepare(
        'SELECT * FROM crosstest_comments WHERE issue_iid = ? AND gitlab_project_id = 63'
      ).get(iid);
      return row;
    } catch (error) {
      logger.error(`CommentsService: Erreur upsert iid=${iid}:`, error);
      throw error;
    }
  }

  /**
   * Supprime le commentaire d'une issue
   * @param {number} iid - GitLab issue IID
   * @returns {boolean} true si une ligne a été supprimée
   */
  delete(iid) {
    try {
      const result = this.db.prepare(
        'DELETE FROM crosstest_comments WHERE issue_iid = ? AND gitlab_project_id = 63'
      ).run(iid);
      return result.changes > 0;
    } catch (error) {
      logger.error(`CommentsService: Erreur delete iid=${iid}:`, error);
      throw error;
    }
  }
}

module.exports = new CommentsService();
