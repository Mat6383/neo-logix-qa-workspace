const express = require('express');
const router = express.Router();
const { validateParams, projectIdParam } = require('../validators');
const { getMetrics, getQualityRates, getAnnualTrends } = require('../controllers/dashboard.controller');

router.get('/:projectId', validateParams(projectIdParam), getMetrics);
router.get('/:projectId/quality-rates', validateParams(projectIdParam), getQualityRates);
router.get('/:projectId/annual-trends', validateParams(projectIdParam), getAnnualTrends);

module.exports = router;
