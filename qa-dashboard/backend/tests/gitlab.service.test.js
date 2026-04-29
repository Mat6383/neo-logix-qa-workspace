/**
 * Tests — gitlab.service.js (client API GitLab)
 * Couvre : formatEstimate (pur), getIssueNotes, findIterationForProject,
 *           searchIterations, executeGraphQL
 *
 * Stratégie de mock :
 *   REST  → service.client.get = jest.fn() sur l'instance
 *   GraphQL → jest.spyOn(axios, 'post') (executeGraphQL appelle axios.post directement)
 */

const axios = require('axios');
const { GitLabService } = require('../services/gitlab.service');

function makeService() {
  process.env.GITLAB_URL          = 'https://gitlab.test';
  process.env.GITLAB_TOKEN        = 'test-token';
  process.env.GITLAB_WRITE_TOKEN  = 'test-write-token';
  process.env.GITLAB_PROJECT_ID   = '5';
  const svc = new GitLabService();
  svc.apiDelay = 0;
  return svc;
}

// ─── formatEstimate (méthode statique pure) ──────────────────────────────────

describe('GitLabService.formatEstimate', () => {
  test('0 secondes → chaîne vide', () => {
    expect(GitLabService.formatEstimate(0)).toBe('');
  });

  test('valeur négative → chaîne vide', () => {
    expect(GitLabService.formatEstimate(-300)).toBe('');
  });

  test('null → chaîne vide', () => {
    expect(GitLabService.formatEstimate(null)).toBe('');
  });

  test('undefined → chaîne vide', () => {
    expect(GitLabService.formatEstimate(undefined)).toBe('');
  });

  test('1800 secondes → "30m"', () => {
    expect(GitLabService.formatEstimate(1800)).toBe('30m');
  });

  test('3600 secondes → "1h"', () => {
    expect(GitLabService.formatEstimate(3600)).toBe('1h');
  });

  test('5400 secondes → "1h 30m"', () => {
    expect(GitLabService.formatEstimate(5400)).toBe('1h 30m');
  });

  test('45 secondes → "45s"', () => {
    expect(GitLabService.formatEstimate(45)).toBe('45s');
  });
});

// ─── getIssueNotes ───────────────────────────────────────────────────────────

describe('getIssueNotes', () => {
  test('filtre les notes système, retourne uniquement les notes utilisateur', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, body: 'Commentaire manuel', system: false, created_at: '2024-01-01' },
        { id: 2, body: 'assigned to @user', system: true,  created_at: '2024-01-02' },
        { id: 3, body: 'Autre commentaire', system: false, created_at: '2024-01-03' }
      ],
      headers: { 'x-next-page': '' }
    });

    const notes = await service.getIssueNotes('5', 42);

    expect(notes).toHaveLength(2);
    expect(notes.every(n => !n.system)).toBe(true);
  });

  test('erreur API → retourne [] sans lever d\'exception', async () => {
    const service = makeService();
    // Court-circuiter _withRetry pour éviter les délais de retry (600ms+)
    service._withRetry = async (fn) => fn();
    service.client.get = jest.fn().mockRejectedValue(
      Object.assign(new Error('Network Error'), { response: { status: 500 } })
    );

    const notes = await service.getIssueNotes('5', 99);
    expect(notes).toEqual([]);
  });

  test('tableau de notes vide → retourne []', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [],
      headers: { 'x-next-page': '' }
    });

    const notes = await service.getIssueNotes('5', 1);
    expect(notes).toEqual([]);
  });
});

// ─── findIterationForProject ─────────────────────────────────────────────────

describe('findIterationForProject', () => {
  test('trouve par titre normalisé (insensible à la casse et aux tirets)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 10, iid: 1, title: 'R06 - run 1' },
        { id: 11, iid: 2, title: 'R07 - run 2' }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.findIterationForProject('5', 'R06-run1');
    expect(result).not.toBeNull();
    expect(result.id).toBe(10);
  });

  test('trouve par iid pour les cadences auto "Itération #3"', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 30, iid: 3, title: null },
        { id: 40, iid: 4, title: null }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.findIterationForProject('5', 'Itération #3 (01/01 → 31/01)');
    expect(result).not.toBeNull();
    expect(result.iid).toBe(3);
  });

  test('retourne null si itération introuvable', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [{ id: 10, iid: 1, title: 'R06 - run 1' }],
      headers: { 'x-next-page': '' }
    });

    const result = await service.findIterationForProject('5', 'R99 - inexistant');
    expect(result).toBeNull();
  });
});

// ─── searchIterations ────────────────────────────────────────────────────────

describe('searchIterations', () => {
  test('génère un titre de fallback pour les cadences auto (title=null)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, iid: 1, title: null, start_date: '2024-01-01', due_date: '2024-01-14' },
        { id: 2, iid: 2, title: 'R06 - run 1', start_date: null, due_date: null }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.searchIterations('5');

    const cadenceAuto = result.find(it => it.id === 1);
    expect(cadenceAuto.title).toMatch(/Itération #1/);
  });

  test('trie par iid décroissant (plus récente en premier)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, iid: 1, title: 'R06' },
        { id: 3, iid: 3, title: 'R08' },
        { id: 2, iid: 2, title: 'R07' }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.searchIterations('5');
    expect(result[0].iid).toBe(3);
    expect(result[1].iid).toBe(2);
    expect(result[2].iid).toBe(1);
  });

  test('filtre localement par search (case-insensitive)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, iid: 1, title: 'R06 - run 1' },
        { id: 2, iid: 2, title: 'R07 - run 2' },
        { id: 3, iid: 3, title: 'R08 - run 3' }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.searchIterations('5', 'R07');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
});

// ─── executeGraphQL ──────────────────────────────────────────────────────────

describe('executeGraphQL', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retourne data.data si la réponse ne contient pas d\'erreurs', async () => {
    const service = makeService();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { data: { workItemUpdate: { workItem: { id: 'gid://1' }, errors: [] } } }
    });

    const result = await service.executeGraphQL('query { test }', {});
    expect(result).toHaveProperty('workItemUpdate');
  });

  test('throw si la réponse contient des erreurs GraphQL', async () => {
    const service = makeService();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { errors: [{ message: 'Field does not exist' }] }
    });

    await expect(service.executeGraphQL('query { bad }', {}))
      .rejects.toThrow('Field does not exist');
  });

  test('throw sur erreur réseau (axios reject)', async () => {
    const service = makeService();
    // Court-circuiter _withRetry pour éviter les délais de retry (600ms+)
    service._withRetry = async (fn) => fn();
    jest.spyOn(axios, 'post').mockRejectedValue(
      Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    );

    await expect(service.executeGraphQL('query { test }', {}))
      .rejects.toThrow();
  });
});
