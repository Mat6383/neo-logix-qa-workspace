const express = require('express');
const router = express.Router();
const { validateBody, reportsGenerateBody } = require('../validators');
const { generateReport } = require('../controllers/reports.controller');

router.post('/generate', validateBody(reportsGenerateBody), generateReport);

module.exports = router;
