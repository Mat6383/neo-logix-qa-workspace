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
  getAllRunResults: jest.fn(),
  createRun: jest.fn(),
  updateRunCaseIds: jest.fn(),
  findFolder: jest.fn(),
  getCases: jest.fn(),
};

const mockRunManager = {
  getFolderCases: jest.fn(),
  getProjectRunsList: jest.fn(),
  createRunFromCases: jest.fn(),
  computeMergePreview: jest.fn(),
  mergeRunCases: jest.fn(),
};

jest.mock('../../services/testmo.service', () => mockTestmo);
jest.mock('../../services/run-manager.service', () => mockRunManager);

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

beforeEach(() => jest.clearAllMocks());

describe('GET /api/runs/folder-cases', () => {
  test('400 — syncProjectId manquant', async () => {
    const res = await request(app).get('/api/runs/folder-cases?iterationName=R14');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationName manquant', async () => {
    const res = await request(app).get('/api/runs/folder-cases?syncProjectId=neo-pilot');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — paramètres valides', async () => {
    mockRunManager.getFolderCases.mockResolvedValue({
      folderId: 10,
      folderName: 'R14',
      caseIds: [1, 2],
    });
    const res = await request(app).get(
      '/api/runs/folder-cases?syncProjectId=neo-pilot&iterationName=R14'
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { caseIds: [1, 2] } });
  });

  test('500 — dossier introuvable', async () => {
    mockRunManager.getFolderCases.mockRejectedValue(new Error('Dossier introuvable'));
    const res = await request(app).get(
      '/api/runs/folder-cases?syncProjectId=neo-pilot&iterationName=R14'
    );
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('GET /api/runs/project-runs', () => {
  test('400 — syncProjectId manquant', async () => {
    const res = await request(app).get('/api/runs/project-runs');
    expect(res.status).toBe(400);
  });

  test('200 — liste retournée', async () => {
    mockRunManager.getProjectRunsList.mockResolvedValue([{ id: 42, name: 'Run R14' }]);
    const res = await request(app).get('/api/runs/project-runs?syncProjectId=neo-pilot');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});

describe('POST /api/runs', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/runs')
      .send({ syncProjectId: 'neo-pilot', name: 'Run R14', caseIds: [1] });
    expect(res.status).toBe(403);
  });

  test('400 — body vide', async () => {
    const res = await request(app).post('/api/runs').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — caseIds vide', async () => {
    const res = await request(app).post('/api/runs').set(CSRF).send({
      syncProjectId: 'neo-pilot',
      name: 'Run R14',
      caseIds: [],
    });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — run créé', async () => {
    mockRunManager.createRunFromCases.mockResolvedValue({ id: 99, name: 'Run R14' });
    const res = await request(app)
      .post('/api/runs')
      .set(CSRF)
      .send({
        syncProjectId: 'neo-pilot',
        name: 'Run R14',
        caseIds: [1, 2, 3],
      });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { id: 99 } });
  });
});

describe('POST /api/runs/:runId/merge-preview', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/runs/42/merge-preview')
      .send({ caseIds: [1] });
    expect(res.status).toBe(403);
  });

  test('400 — runId invalide', async () => {
    const res = await request(app)
      .post('/api/runs/abc/merge-preview')
      .set(CSRF)
      .send({ caseIds: [1] });
    expect(res.status).toBe(400);
  });

  test('400 — caseIds manquant', async () => {
    const res = await request(app).post('/api/runs/42/merge-preview').set(CSRF).send({});
    expect(res.status).toBe(400);
  });

  test('200 — preview calculé', async () => {
    mockTestmo.getAllRunResults.mockResolvedValue([
      { case_id: 1, status_id: 2, elapsed: 60, comment: '', custom_steps_results: [] },
    ]);
    mockRunManager.computeMergePreview.mockReturnValue({
      toAdd: [2, 3],
      pristineInRun: [],
      testedInRun: [1],
      inRunNotInSync: [],
    });
    const res = await request(app)
      .post('/api/runs/42/merge-preview')
      .set(CSRF)
      .send({ caseIds: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(res.body.data.toAdd).toHaveLength(2);
  });
});

describe('POST /api/runs/:runId/merge', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/runs/42/merge')
      .send({ caseIds: [1] });
    expect(res.status).toBe(403);
  });

  test('400 — runId invalide', async () => {
    const res = await request(app)
      .post('/api/runs/0/merge')
      .set(CSRF)
      .send({ caseIds: [1] });
    expect(res.status).toBe(400);
  });

  test('200 — merge exécuté', async () => {
    mockRunManager.mergeRunCases.mockResolvedValue({ added: 2, preserved: 1 });
    const res = await request(app)
      .post('/api/runs/42/merge')
      .set(CSRF)
      .send({ caseIds: [1, 2, 3] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { added: 2 } });
  });
});
