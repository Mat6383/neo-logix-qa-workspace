'use strict';

const request = require('supertest');

const mockTestmo = {
  getProjects: jest.fn(),
  getProjectRuns: jest.fn(),
  getProjectMilestones: jest.fn(),
  getAutomationRuns: jest.fn(),
  clearCache: jest.fn(),
  getRunDetails: jest.fn(),
  getRunResults: jest.fn(),
};

jest.mock('../../services/testmo.service', () => mockTestmo);

const app = require('../../server');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/projects', () => {
  test('200 avec liste de projets', async () => {
    mockTestmo.getProjects.mockResolvedValue([{ id: 1, name: 'Neo Pilot' }]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('500 quand le service lève une erreur', async () => {
    mockTestmo.getProjects.mockRejectedValue(new Error('Testmo down'));
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('GET /api/projects/:projectId/runs', () => {
  test('400 — projectId non numérique (abc)', async () => {
    const res = await request(app).get('/api/projects/abc/runs');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — projectId négatif (-1)', async () => {
    const res = await request(app).get('/api/projects/-1/runs');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — projectId zéro', async () => {
    const res = await request(app).get('/api/projects/0/runs');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — query active invalide', async () => {
    const res = await request(app).get('/api/projects/1/runs?active=maybe');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    mockTestmo.getProjectRuns.mockResolvedValue([]);
    const res = await request(app).get('/api/projects/1/runs');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/projects/:projectId/milestones', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/projects/abc/milestones');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    mockTestmo.getProjectMilestones.mockResolvedValue([]);
    const res = await request(app).get('/api/projects/1/milestones');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/projects/:projectId/automation', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/projects/abc/automation');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    mockTestmo.getAutomationRuns.mockResolvedValue([]);
    const res = await request(app).get('/api/projects/1/automation');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
