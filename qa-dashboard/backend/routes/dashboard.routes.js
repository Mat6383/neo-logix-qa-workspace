const express = require('express');
const router = express.Router();
const { validateParams, projectIdParam } = require('../validators');
const {
  getMetrics,
  getQualityRates,
  getAnnualTrends,
  getMetricsHistory,
} = require('../controllers/dashboard.controller');

const cache2min = (req, res, next) => {
  res.set('Cache-Control', 'private, max-age=120');
  next();
};
const cache5min = (req, res, next) => {
  res.set('Cache-Control', 'private, max-age=300');
  next();
};

router.get('/:projectId', validateParams(projectIdParam), cache2min, getMetrics);
router.get('/:projectId/quality-rates', validateParams(projectIdParam), cache2min, getQualityRates);
router.get('/:projectId/annual-trends', validateParams(projectIdParam), cache5min, getAnnualTrends);
router.get('/:projectId/history', validateParams(projectIdParam), getMetricsHistory);

module.exports = router;
