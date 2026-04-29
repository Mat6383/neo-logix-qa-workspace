const Sentry = require('@sentry/node');
const logger = require('./logger.service');

const SENSITIVE_HEADERS = ['authorization', 'private-token'];

function _scrubEvent(event) {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        event.request.headers[key] = '[REDACTED]';
      }
    }
  }
  const configHeaders = event.extra?.config?.headers;
  if (configHeaders) {
    for (const key of Object.keys(configHeaders)) {
      if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
        configHeaders[key] = '[REDACTED]';
      }
    }
  }
  return event;
}

function init() {
  if (!process.env.SENTRY_DSN) {
    logger.info('[Sentry] DSN non configuré — monitoring désactivé');
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    beforeSend: _scrubEvent,
  });
  logger.info('[Sentry] Initialisé');
}

function captureException(err) {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
}

module.exports = { init, captureException, _scrubEvent };
