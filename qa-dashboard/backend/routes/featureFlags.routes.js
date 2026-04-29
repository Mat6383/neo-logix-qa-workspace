const { Router } = require('express');

const router = Router();

const FLAGS = {
  syncEnabled: process.env.SYNC_AUTO_ENABLED === 'true',
  tvModeEnabled: process.env.TV_MODE_ENABLED !== 'false',
  crossTestEnabled: process.env.CROSSTEST_ENABLED !== 'false',
  reportEnabled: process.env.REPORT_ENABLED !== 'false',
};

router.get('/', (_req, res) => {
  res.json({ flags: FLAGS, timestamp: new Date().toISOString() });
});

module.exports = router;
