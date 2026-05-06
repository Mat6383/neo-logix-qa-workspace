'use strict';

const express = require('express');
const router = express.Router();
const { validateBody, alertsConfigBody } = require('../validators');
const { getConfig, updateConfig, testAlert } = require('../controllers/alerts.controller');

router.get('/config', getConfig);
router.put('/config', validateBody(alertsConfigBody), updateConfig);
router.post('/test', testAlert);

module.exports = router;
