/**
 * Tests unitaires pour syncHistory.service.js
 * On mock better-sqlite3 pour utiliser une base en mémoire (:memory:)
 * et jest.resetModules() pour obtenir une instance fraîche par groupe.
 */

jest.mock('better-sqlite3', () => {
  const RealDatabase = jest.requireActual('better-sqlite3');
  return function MockDatabase() {
    return new RealDatabase(':memory:');
  };
});

jest.mock('../services/logger.service', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function getService() {
  jest.resetModules();
  return require('../services/syncHistory.service');
}

describe('SyncHistoryService — initDb', () => {
  it('crée la table sync_runs sans erreur', () => {
    const svc = getService();
    expect(() => svc.initDb()).not.toThrow();
    expect(svc._initialized).toBe(true);
  });

  it('ne re-initialise pas si déjà initialisé', () => {
    const svc = getService();
    svc.initDb();
    const dbRef = svc.db;
    svc.initDb();
    expect(svc.db).toBe(dbRef);
  });
});

describe('SyncHistoryService — addRun', () => {
  let svc;

  beforeEach(() => {
    svc = getService();
    svc.initDb();
  });

  it('insère un run et retourne un ID entier', () => {
    const id = svc.addRun('Neo-Pilot', 'R14', 'execute', {
      created: 5, updated: 2, skipped: 1, enriched: 3, errors: 0, total: 10,
    });
    expect(typeof id).toBe('number');
    expect(id).toBeGreaterThan(0);
  });

  it('utilise 0 pour les champs results manquants', () => {
    const id = svc.addRun('Neo-Pilot', 'R14', 'preview', {});
    expect(id).toBeGreaterThan(0);
    const rows = svc.getHistory();
    expect(rows[0].created).toBe(0);
    expect(rows[0].errors).toBe(0);
  });

  it('persiste les valeurs correctement', () => {
    svc.addRun('Neo-Pilot', 'R15', 'execute', {
      created: 3, updated: 1, skipped: 0, enriched: 2, errors: 0, total: 6,
    });
    const rows = svc.getHistory();
    expect(rows[0].project_name).toBe('Neo-Pilot');
    expect(rows[0].iteration_name).toBe('R15');
    expect(rows[0].mode).toBe('execute');
    expect(rows[0].created).toBe(3);
    expect(rows[0].total_issues).toBe(6);
  });

  it('retourne null si db non initialisée (db=null)', () => {
    const svc2 = getService();
    svc2._initialized = true;
    svc2.db = null;
    const result = svc2.addRun('x', 'y', 'execute', {});
    expect(result).toBeNull();
  });

  it('enregistre le champ executed_at en ISO string', () => {
    svc.addRun('Neo-Pilot', 'R14', 'execute', {});
    const rows = svc.getHistory();
    expect(rows[0].executed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('SyncHistoryService — getHistory', () => {
  let svc;

  beforeEach(() => {
    svc = getService();
    svc.initDb();
  });

  it('retourne un tableau vide si aucun run', () => {
    const rows = svc.getHistory();
    expect(rows).toEqual([]);
  });

  it('retourne les runs du plus récent au plus ancien', () => {
    svc.addRun('Proj', 'R1', 'execute', {});
    svc.addRun('Proj', 'R2', 'execute', {});
    svc.addRun('Proj', 'R3', 'execute', {});
    const rows = svc.getHistory();
    expect(rows[0].iteration_name).toBe('R3');
    expect(rows[2].iteration_name).toBe('R1');
  });

  it('respecte la limite passée en paramètre', () => {
    for (let i = 0; i < 5; i++) {
      svc.addRun('Proj', `R${i}`, 'execute', {});
    }
    const rows = svc.getHistory(3);
    expect(rows).toHaveLength(3);
  });

  it('limite par défaut à 50 entrées', () => {
    for (let i = 0; i < 60; i++) {
      svc.addRun('Proj', `R${i}`, 'execute', {});
    }
    const rows = svc.getHistory();
    expect(rows).toHaveLength(50);
  });

  it('retourne [] si db=null', () => {
    const svc2 = getService();
    svc2._initialized = true;
    svc2.db = null;
    expect(svc2.getHistory()).toEqual([]);
  });
});
