'use strict';

const request = require('supertest');

jest.mock('../../controllers/sync.controller', () => ({
  getProjects: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  getIterations: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  previewSync: (_req, res) => res.json({ success: true, timestamp: new Date().toISOString() }),
  executeSync: (_req, res) => res.json({ success: true, timestamp: new Date().toISOString() }),
  getHistory: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  testApi: (_req, res) => res.json({ success: true, timestamp: new Date().toISOString() }),
  syncIteration: (_req, res) => res.json({ success: true, timestamp: new Date().toISOString() }),
  statusToGitlab: (_req, res) => res.json({ success: true, timestamp: new Date().toISOString() }),
  testCleanup: (_req, res) => res.json({ success: true, timestamp: new Date().toISOString() }),
  getAutoConfig: (_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() }),
  updateAutoConfig: (_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() }),
  getStatuses: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  getFieldValues: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('GET /api/sync/projects', () => {
  test('200 — liste des projets configurés', async () => {
    const res = await request(app).get('/api/sync/projects');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/sync/:projectId/iterations', () => {
  test('400 — query search trop long (>100 chars)', async () => {
    const longSearch = 'a'.repeat(101);
    const res = await request(app).get(`/api/sync/neo-pilot/iterations?search=${longSearch}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/sync/neo-pilot/iterations');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('POST /api/sync/preview', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/preview')
      .send({ projectId: 'neo-pilot', iterationName: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — body vide', async () => {
    const res = await request(app).post('/api/sync/preview').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationName manquant', async () => {
    const res = await request(app)
      .post('/api/sync/preview')
      .set(CSRF)
      .send({ projectId: 'neo-pilot' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/sync/preview')
      .set(CSRF)
      .send({ projectId: 'neo-pilot', folderName: 'Sprint-01', iterationName: 'R01' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/sync/execute', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/execute')
      .send({ projectId: 'neo-pilot', iterationName: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — projectId manquant', async () => {
    const res = await request(app)
      .post('/api/sync/execute')
      .set(CSRF)
      .send({ iterationName: 'R01' });
    expect(res.status).toBe(400);
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/sync/execute')
      .set(CSRF)
      .send({ projectId: 'neo-pilot', folderName: 'Sprint-01', iterationName: 'R01' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/sync/history', () => {
  test('200 — liste historique', async () => {
    const res = await request(app).get('/api/sync/history');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('POST /api/sync/iteration', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app).post('/api/sync/iteration').send({ iteration: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — iteration manquant', async () => {
    const res = await request(app).post('/api/sync/iteration').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app).post('/api/sync/iteration').set(CSRF).send({ iteration: 'R01' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/sync/status-to-gitlab', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .send({ runId: 1, gitlabProjectId: '123', iterationName: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — runId manquant', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ gitlabProjectId: '123', iterationName: 'R01' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationName ET version absents', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ runId: 1, gitlabProjectId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('iterationName ou version requis');
  });

  test('200 — body valide avec iterationName', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ runId: 1, gitlabProjectId: '123', iterationName: 'R01' });
    expect(res.status).toBe(200);
  });

  test("200 — body valide avec version à la place d'iterationName", async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ runId: 1, gitlabProjectId: '123', version: '1.2.3' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/sync/auto-config', () => {
  test('200 — retourne la config courante', async () => {
    const res = await request(app).get('/api/sync/auto-config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('PUT /api/sync/auto-config', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app).put('/api/sync/auto-config').send({ enabled: true });
    expect(res.status).toBe(403);
  });

  test('400 — body vide (aucun champ valide)', async () => {
    const res = await request(app).put('/api/sync/auto-config').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — au moins un champ valide', async () => {
    const res = await request(app).put('/api/sync/auto-config').set(CSRF).send({ enabled: false });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/sync/:projectId/statuses', () => {
  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/sync/neo-pilot/statuses');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: [] });
  });

  test('400 — projectId invalide (trop court)', async () => {
    const res = await request(app).get('/api/sync//statuses');
    expect(res.status).toBe(404); // route non matchée par Express
  });
});

describe('GET /api/sync/:projectId/field-values', () => {
  test('400 — query param field manquant', async () => {
    const res = await request(app).get('/api/sync/neo-pilot/field-values');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — field valide', async () => {
    const res = await request(app).get('/api/sync/neo-pilot/field-values?field=Version%20Prod');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: [] });
  });

  test('400 — field vide', async () => {
    const res = await request(app).get('/api/sync/neo-pilot/field-values?field=');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });
});
