'use strict';

const request = require('supertest');

jest.mock('../../services/testmo.service', () => ({
  clearCache: jest.fn(),
  getProjects: jest.fn(),
  getProjectRuns: jest.fn(),
  getProjectMilestones: jest.fn(),
  getAutomationRuns: jest.fn(),
  getRunDetails: jest.fn(),
  getRunResults: jest.fn(),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('GET /api/feature-flags', () => {
  test('200 avec objet flags', async () => {
    const res = await request(app).get('/api/feature-flags');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('flags');
    expect(res.body.flags).toHaveProperty('syncEnabled');
    expect(res.body.flags).toHaveProperty('tvModeEnabled');
    expect(res.body.flags).toHaveProperty('crossTestEnabled');
    expect(res.body.flags).toHaveProperty('reportEnabled');
  });
});

describe('POST /api/cache/clear', () => {
  test('403 sans X-Requested-With', async () => {
    const res = await request(app).post('/api/cache/clear');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 avec X-Requested-With', async () => {
    const res = await request(app).post('/api/cache/clear').set(CSRF);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
