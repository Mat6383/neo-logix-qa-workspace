import { describe, it, expect } from 'vitest';
import { buildRows } from '../exportCSV';

const project = { id: 1, name: 'Neo-Pilot' };

const metrics = {
  globalMetrics: {
    passRate: 92.5,
    completionRate: 88,
    failureRate: 7.5,
    testEfficiency: 85,
    totalTests: 120,
    raw: { completed: 105, passed: 97, failed: 8, wip: 10, blocked: 5, untested: 5 },
  },
  qualityRates: {
    escapeRate: 2.1,
    detectionRate: 97.9,
    bugsInProd: 2,
    bugsInTest: 28,
    totalBugs: 30,
  },
};

describe('exportCSV — buildRows', () => {
  it('inclut le nom du projet', () => {
    const rows = buildRows(metrics, project);
    const found = rows.find(r => r[0] === 'Projet');
    expect(found[1]).toBe('Neo-Pilot');
  });

  it('inclut le pass rate formaté', () => {
    const rows = buildRows(metrics, project);
    const row = rows.find(r => r[0] === 'Pass Rate');
    expect(row[1]).toBe('92.50');
  });

  it('inclut le completion rate', () => {
    const rows = buildRows(metrics, project);
    const row = rows.find(r => r[0] === 'Completion Rate');
    expect(row[1]).toBe('88');
  });

  it('inclut escape rate et detection rate', () => {
    const rows = buildRows(metrics, project);
    expect(rows.find(r => r[0] === 'Escape Rate')[1]).toBe('2.10');
    expect(rows.find(r => r[0] === 'Detection Rate')[1]).toBe('97.90');
  });

  it('inclut total bugs', () => {
    const rows = buildRows(metrics, project);
    expect(rows.find(r => r[0] === 'Total bugs')[1]).toBe('30');
  });

  it('gère les métriques absentes sans crash (null/undefined)', () => {
    const rows = buildRows(null, null);
    const projectRow = rows.find(r => r[0] === 'Projet');
    expect(projectRow[1]).toBe('');
    const passRow = rows.find(r => r[0] === 'Pass Rate');
    expect(passRow[1]).toBe('');
  });

  it('inclut les données brutes (total cas, passés, échoués)', () => {
    const rows = buildRows(metrics, project);
    expect(rows.find(r => r[0] === 'Total cas')[1]).toBe('120');
    expect(rows.find(r => r[0] === 'Passés')[1]).toBe('97');
    expect(rows.find(r => r[0] === 'Échoués')[1]).toBe('8');
  });

  it('formate les décimaux avec 2 chiffres, les entiers sans décimale', () => {
    const rows = buildRows(metrics, project);
    // 88 est entier → "88", 92.5 est décimal → "92.50"
    expect(rows.find(r => r[0] === 'Completion Rate')[1]).toBe('88');
    expect(rows.find(r => r[0] === 'Pass Rate')[1]).toBe('92.50');
  });
});
