const Sentry = require('@sentry/node');
const logger = require('./logger.service');

function init() {
  if (!process.env.SENTRY_DSN) {
    logger.info('[Sentry] DSN non configuré — monitoring désactivé');
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  logger.info('[Sentry] Initialisé');
}

function captureException(err) {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
}

module.exports = { init, captureException };
