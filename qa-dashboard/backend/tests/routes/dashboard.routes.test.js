'use strict';

const request = require('supertest');

jest.mock('../../controllers/dashboard.controller', () => ({
  getMetrics: jest.fn((_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() })
  ),
  getQualityRates: jest.fn((_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() })
  ),
  getAnnualTrends: jest.fn((_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() })
  ),
  getMetricsHistory: jest.fn((_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() })
  ),
  parseMilestones: jest.fn(() => null),
}));

const app = require('../../server');

describe('GET /api/dashboard/:projectId', () => {
  test('400 — projectId non numérique', async () => {
    const res = await request(app).get('/api/dashboard/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — projectId zéro', async () => {
    const res = await request(app).get('/api/dashboard/0');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/dashboard/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('Cache-Control header présent (2min)', async () => {
    const res = await request(app).get('/api/dashboard/1');
    expect(res.headers['cache-control']).toBe('private, max-age=120');
  });
});

describe('GET /api/dashboard/:projectId/quality-rates', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/dashboard/abc/quality-rates');
    expect(res.status).toBe(400);
  });

  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/dashboard/1/quality-rates');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/dashboard/:projectId/annual-trends', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/dashboard/abc/annual-trends');
    expect(res.status).toBe(400);
  });

  test('200 — projectId valide avec Cache-Control 5min', async () => {
    const res = await request(app).get('/api/dashboard/1/annual-trends');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=300');
  });
});

describe('GET /api/dashboard/:projectId/history', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/dashboard/abc/history');
    expect(res.status).toBe(400);
  });

  test('400 — projectId zéro', async () => {
    const res = await request(app).get('/api/dashboard/0/history');
    expect(res.status).toBe(400);
  });

  test('200 — projectId valide retourne tableau', async () => {
    const res = await request(app).get('/api/dashboard/1/history');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: [] });
  });

  test('200 — param limit accepté', async () => {
    const res = await request(app).get('/api/dashboard/1/history?limit=7');
    expect(res.status).toBe(200);
  });
});
