const express = require('express');
const router = express.Router();
const testmoService = require('../services/testmo.service');
const logger = require('../services/logger.service');

/**
 * Nettoie le cache (maintenance)
 * LEAN: Gestion optimisée du cache
 */
router.post('/clear', (req, res) => {
  try {
    testmoService.clearCache();
    logger.info('Cache cleared manually');

    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Erreur POST /api/cache/clear:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
