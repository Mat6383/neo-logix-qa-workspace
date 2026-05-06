'use strict';
const request = require('supertest');
const express = require('express');

jest.mock('../../services/alerts.service', () => {
  const mockSvc = {
    getConfig: jest.fn(() => ({
      enabled: false,
      slack_webhook_url: '',
      cooldown_hours: 4,
      metrics: { passRate_critical: true, passRate_warning: false, completionRate_warning: true, blockedRate_warning: true },
    })),
    saveConfig: jest.fn(),
    sendTest: jest.fn().mockResolvedValue({ ok: true }),
  };
  return { getAlertsService: () => mockSvc };
});

const alertsRouter = require('../../routes/alerts.routes');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/alerts', alertsRouter);
  return app;
}

describe('GET /api/alerts/config', () => {
  test('retourne la config', async () => {
    const res = await request(makeApp()).get('/api/alerts/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cooldown_hours).toBe(4);
  });
});

describe('PUT /api/alerts/config', () => {
  test('accepte un patch valide', async () => {
    const res = await request(makeApp())
      .put('/api/alerts/config')
      .send({ enabled: true, slack_webhook_url: 'https://hooks.slack.com/x', cooldown_hours: 2 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejette cooldown_hours < 1', async () => {
    const res = await request(makeApp())
      .put('/api/alerts/config')
      .send({ cooldown_hours: 0 });
    expect(res.status).toBe(400);
  });

  test('rejette cooldown_hours > 168', async () => {
    const res = await request(makeApp())
      .put('/api/alerts/config')
      .send({ cooldown_hours: 200 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/alerts/test', () => {
  test('retourne ok: true', async () => {
    const res = await request(makeApp()).post('/api/alerts/test');
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });
});
