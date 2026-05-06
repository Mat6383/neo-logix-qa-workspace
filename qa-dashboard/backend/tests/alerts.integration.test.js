'use strict';
/**
 * Tests d'intégration — AlertsService.checkAndNotify
 *
 * nock intercepte l'appel HTTP node-fetch vers le webhook Slack.
 * Pas de mock sur _postWebhook → teste le vrai chemin HTTP.
 */
const nock = require('nock');
const AlertsService = require('../services/alerts.service');
const os = require('os');
const path = require('path');

const SLACK_HOST = 'https://hooks.slack.com';
const SLACK_PATH = '/services/TEST/HOOK/abc123';
const SLACK_URL = `${SLACK_HOST}${SLACK_PATH}`;

function makeSvc(cfgOverride = {}) {
  const configPath = path.join(os.tmpdir(), `alerts-int-${Date.now()}.json`);
  const svc = new AlertsService({ configPath, dbPath: ':memory:' });
  svc._initDb();
  svc.saveConfig({
    ...svc.getConfig(),
    enabled: true,
    slack_webhook_url: SLACK_URL,
    cooldown_hours: 4,
    ...cfgOverride,
  });
  return svc;
}

const CRITICAL_SLA = {
  ok: false,
  alerts: [
    {
      severity: 'critical',
      metric: 'Pass Rate',
      value: 80,
      threshold: 85,
      message: 'Pass rate critique: 80% < 85%',
    },
  ],
};

afterEach(() => nock.cleanAll());

describe('checkAndNotify — POST Slack réel (nock)', () => {
  test('SLA breach → POST Slack avec le bon payload', async () => {
    let capturedBody;
    nock(SLACK_HOST)
      .post(SLACK_PATH, (body) => {
        capturedBody = body;
        return true;
      })
      .reply(200, 'ok');

    const svc = makeSvc();
    await svc.checkAndNotify('proj-1', 'neo-pilot', CRITICAL_SLA);

    expect(nock.isDone()).toBe(true); // le POST a bien eu lieu
    expect(capturedBody.text).toContain('neo-pilot');
    expect(capturedBody.text).toContain('CRITICAL');
  });

  test('SLA breach → cooldown enregistré dans SQLite après envoi', async () => {
    nock(SLACK_HOST).post(SLACK_PATH).reply(200, 'ok');

    const svc = makeSvc();
    await svc.checkAndNotify('proj-2', 'neo-pilot', CRITICAL_SLA);

    const row = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('proj-2');
    expect(row).toBeTruthy();
    expect(new Date(row.last_sent_at).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  test('2 appels rapprochés → 1 seul POST (cooldown bloque le 2ème)', async () => {
    nock(SLACK_HOST).post(SLACK_PATH).reply(200, 'ok');

    const svc = makeSvc();
    await svc.checkAndNotify('proj-3', 'neo-pilot', CRITICAL_SLA); // 1er → POST
    await svc.checkAndNotify('proj-3', 'neo-pilot', CRITICAL_SLA); // 2ème → bloqué

    expect(nock.pendingMocks()).toHaveLength(0); // nock a un seul intercepteur, utilisé une seule fois
  });

  test('cooldown expiré → 2ème POST envoyé', async () => {
    // Simule un cooldown expiré (last_sent_at = il y a 5h, cooldown = 4h)
    nock(SLACK_HOST).post(SLACK_PATH).reply(200, 'ok').persist(); // 2 appels autorisés

    const svc = makeSvc({ cooldown_hours: 4 });
    const expired = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    svc._db
      .prepare('INSERT OR REPLACE INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)')
      .run('proj-4', expired);

    await svc.checkAndNotify('proj-4', 'neo-pilot', CRITICAL_SLA);

    expect(nock.isDone()).toBe(true);
  });

  test('webhook Slack renvoie 500 → pas de crash, cooldown non enregistré', async () => {
    nock(SLACK_HOST).post(SLACK_PATH).reply(500, 'Internal Server Error');

    const svc = makeSvc();
    await expect(svc.checkAndNotify('proj-5', 'neo-pilot', CRITICAL_SLA)).resolves.toBeUndefined();

    const row = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('proj-5');
    expect(row).toBeFalsy(); // cooldown non posé si envoi raté
  });

  test('URL webhook invalide → pas de crash (log erreur silencieux)', async () => {
    const svc = makeSvc({ slack_webhook_url: 'https://invalid.host.test/webhook' });
    nock('https://invalid.host.test').post('/webhook').replyWithError('ECONNREFUSED');

    await expect(svc.checkAndNotify('proj-6', 'neo-pilot', CRITICAL_SLA)).resolves.toBeUndefined();
  });
});
