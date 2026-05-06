'use strict';

// Tests unitaires pour MetricsHistoryService
// Utilise une base SQLite in-memory (:memory:)

const MetricsHistoryService = require('../services/metrics-history.service');

function makeService() {
  const svc = new MetricsHistoryService(':memory:');
  svc.initDb();
  return svc;
}

const SNAPSHOT = {
  projectId: 1,
  projectName: 'neo-pilot',
  completionRate: 87.5,
  passRate: 92.3,
  failureRate: 7.7,
  testEfficiency: 92.3,
  totalTests: 80,
  passedTests: 64,
  failedTests: 6,
  completedTests: 70,
};

describe('MetricsHistoryService — initDb', () => {
  test('initialise sans erreur', () => {
    const svc = makeService();
    expect(svc._initialized).toBe(true);
  });

  test('double appel initDb idempotent', () => {
    const svc = makeService();
    expect(() => svc.initDb()).not.toThrow();
  });
});

describe('MetricsHistoryService — saveSnapshot', () => {
  test('sauvegarde un snapshot et retourne le row', () => {
    const svc = makeService();
    const row = svc.saveSnapshot(SNAPSHOT);
    expect(row.id).toBeGreaterThan(0);
    expect(row.project_id).toBe(1);
    expect(row.pass_rate).toBeCloseTo(92.3);
    expect(row.snapshot_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('dedup — second saveSnapshot même jour retourne le row existant sans INSERT', () => {
    const svc = makeService();
    const r1 = svc.saveSnapshot(SNAPSHOT);
    const r2 = svc.saveSnapshot({ ...SNAPSHOT, passRate: 95 });
    expect(r2.id).toBe(r1.id);
    expect(r2.pass_rate).toBeCloseTo(92.3); // inchangé
  });

  test('deux projets différents même jour → 2 rows', () => {
    const svc = makeService();
    svc.saveSnapshot(SNAPSHOT);
    svc.saveSnapshot({ ...SNAPSHOT, projectId: 2, projectName: 'other' });
    const h1 = svc.getHistory(1, 10);
    const h2 = svc.getHistory(2, 10);
    expect(h1).toHaveLength(1);
    expect(h2).toHaveLength(1);
  });

  test('valeurs nulles tolérées (métriques manquantes)', () => {
    const svc = makeService();
    expect(() => svc.saveSnapshot({ projectId: 1, projectName: 'x' })).not.toThrow();
  });
});

describe('MetricsHistoryService — getHistory', () => {
  test('retourne vide si aucun snapshot', () => {
    const svc = makeService();
    expect(svc.getHistory(99, 30)).toEqual([]);
  });

  test('retourne les snapshots triés par date croissante', () => {
    const svc = makeService();
    svc.saveSnapshot(SNAPSHOT, '2026-01-01');
    svc.saveSnapshot({ ...SNAPSHOT, passRate: 80 }, '2026-01-02');
    const rows = svc.getHistory(1, 30);
    expect(rows).toHaveLength(2);
    expect(rows[0].snapshot_date).toBe('2026-01-01');
    expect(rows[1].snapshot_date).toBe('2026-01-02');
  });

  test('limit respecté', () => {
    const svc = makeService();
    for (let i = 1; i <= 5; i++) {
      svc.saveSnapshot({ ...SNAPSHOT, passRate: i * 10 }, `2026-01-0${i}`);
    }
    expect(svc.getHistory(1, 3)).toHaveLength(3);
  });

  test('champs retournés corrects', () => {
    const svc = makeService();
    svc.saveSnapshot(SNAPSHOT, '2026-05-06');
    const [row] = svc.getHistory(1, 1);
    expect(row).toMatchObject({
      project_id: 1,
      project_name: 'neo-pilot',
      completion_rate: expect.any(Number),
      pass_rate: expect.any(Number),
      failure_rate: expect.any(Number),
      test_efficiency: expect.any(Number),
      total_tests: 80,
      passed_tests: 64,
      failed_tests: 6,
      completed_tests: 70,
      snapshot_date: '2026-05-06',
    });
  });
});

describe('MetricsHistoryService — getLatest', () => {
  test('retourne null si aucun snapshot', () => {
    const svc = makeService();
    expect(svc.getLatest(1)).toBeNull();
  });

  test('retourne le snapshot le plus récent', () => {
    const svc = makeService();
    svc.saveSnapshot(SNAPSHOT, '2026-01-01');
    svc.saveSnapshot({ ...SNAPSHOT, passRate: 99 }, '2026-01-03');
    svc.saveSnapshot({ ...SNAPSHOT, passRate: 50 }, '2026-01-02');
    const row = svc.getLatest(1);
    expect(row.snapshot_date).toBe('2026-01-03');
  });
});
