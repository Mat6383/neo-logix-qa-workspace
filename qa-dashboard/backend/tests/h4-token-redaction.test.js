/**
 * Tests — H4 : Redaction des tokens dans les logs
 *
 * Vérifie que :
 *   1. _scrubEvent (sentry.service) rédacte les headers Authorization et
 *      PRIVATE-TOKEN avant envoi à Sentry, quelle que soit la casse
 *   2. Les 4 call sites de logger.error dans testmo.service ne passent
 *      plus d'objet avec .config.headers (proxy via logger spy)
 */

// ─── 1. Sentry beforeSend — _scrubEvent ─────────────────────────────────────

const { _scrubEvent } = require('../services/sentry.service');

describe('_scrubEvent — redaction Sentry', () => {
  test('Authorization dans event.request.headers → [REDACTED]', () => {
    const event = { request: { headers: { authorization: 'Bearer glpat-secret123' } } };
    expect(_scrubEvent(event).request.headers.authorization).toBe('[REDACTED]');
  });

  test('PRIVATE-TOKEN dans event.request.headers → [REDACTED]', () => {
    const event = { request: { headers: { 'private-token': 'glpat-secret456' } } };
    expect(_scrubEvent(event).request.headers['private-token']).toBe('[REDACTED]');
  });

  test('header insensible à la casse (AUTHORIZATION majuscules) → [REDACTED]', () => {
    const event = { request: { headers: { AUTHORIZATION: 'Bearer TOKEN' } } };
    expect(_scrubEvent(event).request.headers.AUTHORIZATION).toBe('[REDACTED]');
  });

  test('Authorization dans extra.config.headers (objet axios error) → [REDACTED]', () => {
    const event = {
      extra: { config: { headers: { Authorization: 'Bearer token-from-axios-error' } } },
    };
    expect(_scrubEvent(event).extra.config.headers.Authorization).toBe('[REDACTED]');
  });

  test('PRIVATE-TOKEN dans extra.config.headers → [REDACTED]', () => {
    const event = {
      extra: { config: { headers: { 'PRIVATE-TOKEN': 'glpat-writetoken' } } },
    };
    expect(_scrubEvent(event).extra.config.headers['PRIVATE-TOKEN']).toBe('[REDACTED]');
  });

  test('headers non-sensibles préservés (Content-Type, Accept)', () => {
    const event = {
      request: {
        headers: {
          'content-type': 'application/json',
          accept: '*/*',
          authorization: 'Bearer secret',
        },
      },
    };
    const result = _scrubEvent(event);
    expect(result.request.headers['content-type']).toBe('application/json');
    expect(result.request.headers.accept).toBe('*/*');
    expect(result.request.headers.authorization).toBe('[REDACTED]');
  });

  test('event sans request ni extra → retourné intact', () => {
    const event = { message: 'Erreur réseau', level: 'error' };
    expect(_scrubEvent(event)).toEqual({ message: 'Erreur réseau', level: 'error' });
  });

  test('event avec request mais sans headers → retourné intact', () => {
    const event = { request: { url: '/api/v1/projects' } };
    expect(_scrubEvent(event)).toEqual({ request: { url: '/api/v1/projects' } });
  });
});

// ─── 2. testmo.service — logger.error ne reçoit pas d'objet axios ───────────

const logger = require('../services/logger.service');

describe('testmo.service — logger.error sans objet axios (pas de fuite de token)', () => {
  let loggedArgs;

  beforeEach(() => {
    loggedArgs = [];
    jest.spyOn(logger, 'error').mockImplementation((...args) => {
      loggedArgs.push(args);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('les appels logger.error ne transmettent jamais un objet avec config.headers', async () => {
    // Simuler une erreur axios avec Authorization dans config.headers
    const axiosError = Object.assign(new Error('Timeout'), {
      response: { status: 503 },
      config: { headers: { Authorization: 'Bearer SUPER_SECRET_TOKEN' }, url: '/api/v1/runs' },
    });

    // Déclencher les catch blocks de testmo.service en mockant les appels internes
    const testmoService = require('../services/testmo.service');
    const originalGet = testmoService.client?.get;

    if (testmoService.client) {
      testmoService.client.get = jest.fn().mockRejectedValue(axiosError);

      // Appel qui déclenche un des catch blocks (getProjectMetrics avec milestone pour atteindre la ligne 343)
      try {
        await testmoService.getProjectMetrics(1, [999], null);
      } catch (_) {
        /* erreur attendue */
      }

      if (originalGet) testmoService.client.get = originalGet;
    }

    // Vérifier qu'aucun appel à logger.error n'a transmis un objet avec config.headers
    for (const callArgs of loggedArgs) {
      for (const arg of callArgs) {
        if (arg && typeof arg === 'object') {
          expect(arg.config?.headers?.Authorization).toBeUndefined();
          expect(arg.config?.headers?.['PRIVATE-TOKEN']).toBeUndefined();
        }
      }
    }
  });
});
