'use strict';
/**
 * Tests d'intégration — statusSyncService.syncRunStatusToGitLab
 *
 * nock intercepte les appels axios Testmo (http://mock-testmo.test)
 * jest.spyOn mocke les méthodes gitlabService (GraphQL/REST complexe)
 */
const nock = require('nock');
const statusSyncService = require('../services/status-sync.service');
const gitlabService = require('../services/gitlab.service');

const TESTMO_BASE = 'http://mock-testmo.test';
const GL_PROJECT = 63;
const RUN_ID = 42;

const MOCK_RUN_INFO = { result: { id: RUN_ID, name: 'R14 - run 1' } };
const MOCK_RESULTS = {
  result: [
    { case_id: 101, case_name: 'Connexion admin', status_id: 2, is_latest: true },  // Passed → Test::OK
    { case_id: 102, case_name: 'Export PDF',     status_id: 3, is_latest: true },  // Failed → Test::KO
    { case_id: 103, case_name: 'Recherche',      status_id: 99, is_latest: true }, // Inconnu → skip
  ],
};
const MOCK_ISSUES = [
  { id: 1001, iid: 1, title: 'Connexion admin', labels: ['Test::WIP'] },
  { id: 1002, iid: 2, title: 'Export PDF',      labels: ['Test::OK'] },
];
const MOCK_ITERATION = { id: 'gid://gitlab/Iteration/7', title: 'R14 - run 1' };

function setupNockTestmo() {
  nock(TESTMO_BASE)
    .get(`/api/v1/runs/${RUN_ID}`)
    .reply(200, MOCK_RUN_INFO);
  nock(TESTMO_BASE)
    .get(`/api/v1/runs/${RUN_ID}/results`)
    .reply(200, MOCK_RESULTS);
  // _getCaseNames est toujours appelé même si case_name est déjà dans les résultats
  // TESTMO_PROJECT_ID non défini dans setup.js → défaut 1
  nock(TESTMO_BASE)
    .get('/api/v1/projects/1/cases')
    .query(true)
    .reply(200, { result: [], last_page: 1 });
}

beforeAll(() => {
  // Annule le délai entre requêtes (400ms × nb résultats) pour accélérer les tests
  statusSyncService.apiDelay = 0;
});

afterAll(() => {
  statusSyncService.apiDelay = 400;
});

afterEach(() => {
  nock.cleanAll();
  jest.restoreAllMocks();
});

describe('syncRunStatusToGitLab — flow nominal', () => {
  test('2 résultats mappés → 2 updated, 1 skipped (status inconnu)', async () => {
    setupNockTestmo();

    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue(MOCK_ISSUES);
    jest.spyOn(gitlabService, 'updateWorkItemStatus').mockResolvedValue({});
    jest.spyOn(gitlabService, 'getIssueNotes').mockResolvedValue([]);
    jest.spyOn(gitlabService, 'addIssueComment').mockResolvedValue({});

    const events = [];
    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT,
      (type, data) => events.push({ type, data })
    );

    expect(stats.updated).toBe(2);
    expect(stats.skipped).toBe(1);
    expect(stats.errors).toBe(0);
    expect(gitlabService.updateWorkItemStatus).toHaveBeenCalledTimes(2);
  });

  test('les appels Testmo passent bien par nock (pas de requête réseau réelle)', async () => {
    setupNockTestmo();
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue([]);
    jest.spyOn(gitlabService, 'getIssueNotes').mockResolvedValue([]);

    await statusSyncService.syncRunStatusToGitLab(RUN_ID, 'R14 - run 1', GL_PROJECT);

    expect(nock.isDone()).toBe(true); // tous les intercepteurs nock ont été consommés
  });
});

describe('syncRunStatusToGitLab — mode dryRun', () => {
  test('dryRun=true → updated incrémenté mais updateWorkItemStatus jamais appelé', async () => {
    setupNockTestmo();
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue(MOCK_ISSUES);
    jest.spyOn(gitlabService, 'updateWorkItemStatus').mockResolvedValue({});

    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT, () => {}, true
    );

    expect(stats.dryRun).toBe(true);
    expect(stats.updated).toBe(2);
    expect(gitlabService.updateWorkItemStatus).not.toHaveBeenCalled();
  });
});

describe('syncRunStatusToGitLab — erreurs', () => {
  test('aucun résultat Testmo → stats vides, aucun appel GitLab', async () => {
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}`).reply(200, MOCK_RUN_INFO);
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}/results`).reply(200, { result: [] });
    // results vides → retour anticipé avant _getCaseNames et GitLab
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'updateWorkItemStatus').mockResolvedValue({});

    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT
    );

    expect(stats.updated).toBe(0);
    expect(gitlabService.updateWorkItemStatus).not.toHaveBeenCalled();
  });

  test('Testmo renvoie 429 → lance une erreur', async () => {
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}`).reply(200, MOCK_RUN_INFO);
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}/results`).reply(429, 'Too Many Requests');
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);

    await expect(
      statusSyncService.syncRunStatusToGitLab(RUN_ID, 'R14 - run 1', GL_PROJECT)
    ).rejects.toThrow();
  });

  test("updateWorkItemStatus échoue sur une issue → error incrémenté, sync continue", async () => {
    setupNockTestmo();
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue(MOCK_ISSUES);
    jest.spyOn(gitlabService, 'getIssueNotes').mockResolvedValue([]);
    jest.spyOn(gitlabService, 'addIssueComment').mockResolvedValue({});
    jest.spyOn(gitlabService, 'updateWorkItemStatus')
      .mockRejectedValueOnce(new Error('GitLab 500'))
      .mockResolvedValue({});

    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT
    );

    expect(stats.errors).toBe(1);
    expect(stats.updated).toBe(1); // la 2ème issue passe quand même
  });
});
