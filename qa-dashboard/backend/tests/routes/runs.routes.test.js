'use strict';

const request = require('supertest');

const mockTestmo = {
  getRunDetails: jest.fn(),
  getRunResults: jest.fn(),
  getProjects: jest.fn(),
  getProjectRuns: jest.fn(),
  getProjectMilestones: jest.fn(),
  getAutomationRuns: jest.fn(),
  clearCache: jest.fn(),
};

jest.mock('../../services/testmo.service', () => mockTestmo);

const app = require('../../server');

beforeEach(() => jest.clearAllMocks());

describe('GET /api/runs/:runId', () => {
  test('400 — runId non numérique', async () => {
    const res = await request(app).get('/api/runs/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — runId zéro', async () => {
    const res = await request(app).get('/api/runs/0');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — runId valide', async () => {
    mockTestmo.getRunDetails.mockResolvedValue({ id: 42, name: 'Run 42' });
    const res = await request(app).get('/api/runs/42');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('500 — service lève une erreur', async () => {
    mockTestmo.getRunDetails.mockRejectedValue(new Error('timeout'));
    const res = await request(app).get('/api/runs/1');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('GET /api/runs/:runId/results', () => {
  test('400 — runId invalide', async () => {
    const res = await request(app).get('/api/runs/abc/results');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — runId valide sans filtre status', async () => {
    mockTestmo.getRunResults.mockResolvedValue([]);
    const res = await request(app).get('/api/runs/42/results');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('200 — runId valide avec filtre status', async () => {
    mockTestmo.getRunResults.mockResolvedValue([]);
    const res = await request(app).get('/api/runs/42/results?status=3,5');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
