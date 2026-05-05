/**
 * Tests — sync.service.js (GitLab → Testmo pipeline)
 * Couvre : parseIterationName (pur), syncIteration (mocké)
 */

const syncService = require('../services/sync.service');

// ─── parseIterationName — fonction pure ─────────────────────────────────────

describe('parseIterationName', () => {
  test('format standard "R06 - run 1" → parent=R06, child=R06 - run 1', () => {
    const result = syncService.parseIterationName('R06 - run 1');
    expect(result.parent).toBe('R06');
    expect(result.child).toBe('R06 - run 1');
  });

  test('format sans espaces "R06-run1" → normalise les tirets', () => {
    const result = syncService.parseIterationName('R06-run1');
    expect(result.parent).toBe('R06');
    expect(result.child).toContain('R06');
  });

  test('cadence auto "Itération #3 (...)" → parent=Iteration-3, child=Iteration-3', () => {
    const result = syncService.parseIterationName('Itération #3 (01/01 → 31/01)');
    expect(result.parent).toBe('Iteration-3');
    expect(result.child).toBe('Iteration-3');
  });

  test('cadence auto variante ASCII "Iteration #7" → parent=Iteration-7', () => {
    const result = syncService.parseIterationName('Iteration #7 (15/03 → 28/03)');
    expect(result.parent).toBe('Iteration-7');
    expect(result.child).toBe('Iteration-7');
  });

  test('format simple "R14" (pas de tiret) → parent=R14, child=R14', () => {
    const result = syncService.parseIterationName('R14');
    expect(result.parent).toBe('R14');
    expect(result.child).toBe('R14');
  });
});

// ─── syncIteration — dryRun ──────────────────────────────────────────────────

describe('syncIteration — dryRun=true', () => {
  let gitlabModule, testmoModule;

  beforeEach(() => {
    gitlabModule = require('../services/gitlab.service');
    testmoModule = require('../services/testmo.service');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retourne les stats correctes sans créer de cases', async () => {
    Object.assign(gitlabModule, {
      findIteration: jest.fn().mockResolvedValue({ id: 42, title: 'R06 - run 1' }),
      getIssuesByFilters: jest.fn().mockResolvedValue([
        {
          id: 100,
          iid: 1,
          title: 'Cas de test A',
          web_url: 'https://gitlab.test/issues/1',
          project_id: '5',
        },
        {
          id: 101,
          iid: 2,
          title: 'Cas de test B',
          web_url: 'https://gitlab.test/issues/2',
          project_id: '5',
        },
      ]),
    });
    Object.assign(testmoModule, {
      getOrCreateFolder: jest
        .fn()
        .mockResolvedValueOnce({ id: 10, name: '[TEST-API] R06' })
        .mockResolvedValueOnce({ id: 11, name: 'R06 - run 1' }),
      findCaseByName: jest.fn().mockResolvedValue(null),
    });

    const stats = await syncService.syncIteration(
      'R06 - run 1',
      { iterationName: 'R06 - run 1' },
      { dryRun: true },
      () => {}
    );

    expect(stats.created).toBe(2);
    expect(stats.errors).toBe(0);
  });

  test('retourne une erreur si itération non trouvée', async () => {
    Object.assign(gitlabModule, {
      findIteration: jest.fn().mockResolvedValue(null),
    });

    const stats = await syncService.syncIteration(
      'R99 - inexistant',
      { iterationName: 'R99 - inexistant' },
      { dryRun: true }
    );

    expect(stats.error).toBeDefined();
    expect(stats.error).toContain('R99 - inexistant');
    expect(stats.created).toBe(0);
  });
});
