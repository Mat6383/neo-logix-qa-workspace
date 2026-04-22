const express = require('express');
const router = express.Router();
const logger = require('../services/logger.service');
const gitlabServiceInstance = require('../services/gitlab.service');
const commentsService = require('../services/comments.service');
const { validateParams, validateBody, iterationIdParam, iidParam, crosstestCommentBody, crosstestCommentPutBody } = require('../validators');

const CROSSTEST_PROJECT_ID = 63;

/**
 * GET /api/crosstest/iterations
 * Liste les itérations GitLab du projet 63 (avec filtre search optionnel)
 */
router.get('/iterations', async (req, res) => {
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
router.get('/issues/:iterationId', validateParams(iterationIdParam), async (req, res) => {
  try {
    const iterationId = parseInt(req.params.iterationId);

    const issues = await gitlabServiceInstance.getIssuesByLabelAndIterationForProject(
      CROSSTEST_PROJECT_ID,
      'CrossTest::OK',
      iterationId
    );

    const data = issues.map(issue => ({
      iid: issue.iid,
      title: issue.title,
      url: issue.web_url,
      state: issue.state,
      assignees: (issue.assignees || []).map(a => a.name),
      labels: (issue.labels || []).filter(l => l !== 'CrossTest::OK'),
      created_at: issue.created_at,
      closed_at: issue.closed_at || null
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
router.get('/comments', (req, res) => {
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
router.post('/comments', validateBody(crosstestCommentBody), (req, res) => {
  try {
    const { issue_iid, comment, milestone_context } = req.body;
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
router.put('/comments/:iid', validateParams(iidParam), validateBody(crosstestCommentPutBody), (req, res) => {
  try {
    const iid = parseInt(req.params.iid);
    const { comment, milestone_context } = req.body;
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
router.delete('/comments/:iid', validateParams(iidParam), (req, res) => {
  try {
    const iid = parseInt(req.params.iid);
    const deleted = commentsService.delete(iid);
    res.json({ success: true, deleted, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error(`Erreur DELETE /api/crosstest/comments/${req.params.iid}:`, error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

module.exports = router;
