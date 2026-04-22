const express = require('express');
const router = express.Router();

/**
 * Route de santé (Health Check)
 * DevOps: Monitoring et disponibilité
 */
router.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
});

module.exports = router;
