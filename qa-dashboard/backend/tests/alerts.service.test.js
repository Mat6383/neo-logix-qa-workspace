'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');

function makeTmpConfigPath() {
  return path.join(os.tmpdir(), `alerts-cfg-${Date.now()}.json`);
}

const AlertsService = require('../services/alerts.service');

describe('AlertsService — config', () => {
  test('getConfig retourne la config par défaut si aucun fichier', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    const cfg = svc.getConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.slack_webhook_url).toBe('');
    expect(cfg.cooldown_hours).toBe(4);
    expect(cfg.metrics.passRate_critical).toBe(true);
    expect(cfg.metrics.passRate_warning).toBe(false);
    expect(cfg.metrics.completionRate_warning).toBe(true);
    expect(cfg.metrics.blockedRate_warning).toBe(true);
  });

  test('saveConfig persiste et getConfig relit depuis fichier', () => {
    const cfgPath = makeTmpConfigPath();
    const svc = new AlertsService({ configPath: cfgPath, dbPath: ':memory:' });
    svc.saveConfig({
      ...svc.getConfig(),
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/test',
      cooldown_hours: 2,
    });
    const svc2 = new AlertsService({ configPath: cfgPath, dbPath: ':memory:' });
    const cfg = svc2.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.slack_webhook_url).toBe('https://hooks.slack.com/test');
    expect(cfg.cooldown_hours).toBe(2);
    fs.unlinkSync(cfgPath);
  });
});

describe('AlertsService — cooldown', () => {
  test('_isCoolingDown retourne false si aucune entrée', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    expect(svc._isCoolingDown('proj-1', 4)).toBe(false);
  });

  test('_isCoolingDown retourne true si last_sent_at < cooldown_hours', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    svc._db
      .prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)')
      .run('proj-1', recent);
    expect(svc._isCoolingDown('proj-1', 4)).toBe(true);
  });

  test('_isCoolingDown retourne false si last_sent_at > cooldown_hours', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    const old = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    svc._db
      .prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)')
      .run('proj-1', old);
    expect(svc._isCoolingDown('proj-1', 4)).toBe(false);
  });

  test('_updateCooldown upsert last_sent_at', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    svc._updateCooldown('proj-1');
    const row = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('proj-1');
    expect(row).toBeTruthy();
    expect(row.last_sent_at).toBeTruthy();
  });
});

describe('AlertsService — checkAndNotify', () => {
  function makeSvc(cfgOverride = {}) {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    svc.saveConfig({ ...svc.getConfig(), ...cfgOverride });
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

  const OK_SLA = { ok: true, alerts: [] };

  test('ne POST pas si disabled', async () => {
    const svc = makeSvc({ enabled: false });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('ne POST pas si slaStatus.ok = true', async () => {
    const svc = makeSvc({ enabled: true, slack_webhook_url: 'https://hooks.slack.com/x' });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', OK_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('ne POST pas si webhook URL vide', async () => {
    const svc = makeSvc({ enabled: true, slack_webhook_url: '' });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('ne POST pas si cooldown actif', async () => {
    const svc = makeSvc({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
    });
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    svc._db
      .prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)')
      .run('1', recent);
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('POST webhook et update cooldown si toutes conditions remplies', async () => {
    const svc = makeSvc({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
    });
    svc._postWebhook = jest.fn().mockResolvedValue();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).toHaveBeenCalledTimes(1);
    const [url, payload] = svc._postWebhook.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/x');
    expect(payload.text).toContain('neo-pilot');
    expect(payload.text).toContain('Pass rate');
    const cooldownRow = svc._db
      .prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?')
      .get('1');
    expect(cooldownRow).toBeTruthy();
  });

  test('filtre les alertes selon config metrics', async () => {
    const svc = makeSvc({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
      metrics: {
        passRate_critical: false,
        passRate_warning: false,
        completionRate_warning: false,
        blockedRate_warning: false,
      },
    });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });
});
