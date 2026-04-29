'use strict';

const request = require('supertest');
const app = require('../../server');

describe('GET /api/health', () => {
  test('200 avec status OK, timestamp, uptime, environment, version', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'OK',
      environment: 'test',
      version: '1.0.0',
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('404 — route inexistante', () => {
  test('GET /api/nonexistent → 404 avec success: false', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});
