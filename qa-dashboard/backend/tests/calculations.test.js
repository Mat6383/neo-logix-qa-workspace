/**
 * ================================================
 * TESTS DE VÉRIFICATION DES CALCULS ISTQB
 * ================================================
 * Vérifie la cohérence des formules utilisées dans testmo.service.js
 *
 * Données réelles de référence (sprint en cours) :
 *   - Session Gab   : success=2, failure=1  → passRate = 66.67%
 *   - Session Pauline : success=1, failure=0 → passRate = 100%
 *   - Session Sophie : success=0, failure=3  → passRate = 0%
 */

// ─── Helpers extraits de testmo.service.js (sans dépendances) ───────────────

function _calculatePercentage(value, total) {
  if (!total || total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
}

function sessionPassRate(session) {
  const successCount = session.success_count || 0;
  const failureCount = session.failure_count || 0;
  return _calculatePercentage(successCount, successCount + failureCount);
}

function aggregateSessions(sessions) {
  const aggregated = {
    total: 0, passed: 0, failed: 0,
    completed: 0, success: 0, failure: 0, wip: 0,
  };

  sessions.forEach(session => {
    const successCount = session.success_count || 0;
    const failureCount = session.failure_count || 0;
    const sessionTotal = successCount + failureCount;

    if (sessionTotal > 0) {
      aggregated.total     += sessionTotal;
      aggregated.passed    += successCount;
      aggregated.failed    += failureCount;
      aggregated.completed += sessionTotal;
      aggregated.success   += successCount;
      aggregated.failure   += failureCount;
    } else {
      aggregated.total += 1;
      aggregated.wip   += 1;
    }
  });

  return aggregated;
}

function globalMetrics(aggregated) {
  return {
    completionRate:  _calculatePercentage(aggregated.completed, aggregated.total),
    passRate:        _calculatePercentage(aggregated.passed, aggregated.completed),
    failureRate:     _calculatePercentage(aggregated.failed, aggregated.completed),
    testEfficiency:  _calculatePercentage(aggregated.passed, aggregated.passed + aggregated.failed),
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('_calculatePercentage', () => {
  test('retourne 0 quand total vaut 0', () => {
    expect(_calculatePercentage(5, 0)).toBe(0);
  });

  test('retourne 0 quand total est null', () => {
    expect(_calculatePercentage(5, null)).toBe(0);
  });

  test('retourne 0 quand total est undefined', () => {
    expect(_calculatePercentage(5, undefined)).toBe(0);
  });

  test('calcule 100% quand value === total', () => {
    expect(_calculatePercentage(5, 5)).toBe(100);
  });

  test('calcule 50% correctement', () => {
    expect(_calculatePercentage(1, 2)).toBe(50);
  });

  test('arrondit à 2 décimales', () => {
    // 2/3 = 66.666... → 66.67
    expect(_calculatePercentage(2, 3)).toBe(66.67);
  });

  test('retourne 0 quand value vaut 0', () => {
    expect(_calculatePercentage(0, 10)).toBe(0);
  });
});

describe('sessionPassRate — calcul basé sur success_count / failure_count', () => {
  test('Session Gab : 2 passed, 1 failed → 66.67%', () => {
    const session = { success_count: 2, failure_count: 1 };
    expect(sessionPassRate(session)).toBe(66.67);
  });

  test('Session Pauline : 1 passed, 0 failed → 100%', () => {
    const session = { success_count: 1, failure_count: 0 };
    expect(sessionPassRate(session)).toBe(100);
  });

  test('Session Sophie : 0 passed, 3 failed → 0%', () => {
    const session = { success_count: 0, failure_count: 3 };
    expect(sessionPassRate(session)).toBe(0);
  });

  test('Session sans aucun résultat → 0% (pas de division par zéro)', () => {
    const session = { success_count: 0, failure_count: 0 };
    expect(sessionPassRate(session)).toBe(0);
  });

  test('Session avec champs manquants → 0%', () => {
    expect(sessionPassRate({})).toBe(0);
  });

  test('Retest : 3 passed cumulés, 1 failed → 75%', () => {
    // Un test repassé en passed après un failed : 3 passed (logs), 1 failed (log)
    const session = { success_count: 3, failure_count: 1 };
    expect(sessionPassRate(session)).toBe(75);
  });
});

describe('aggregateSessions — intégration des sessions dans les métriques globales', () => {
  test('une session avec résultats contribue au total et aux compteurs', () => {
    const sessions = [{ success_count: 2, failure_count: 1 }];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(3);
    expect(agg.passed).toBe(2);
    expect(agg.failed).toBe(1);
    expect(agg.completed).toBe(3);
    expect(agg.wip).toBe(0);
  });

  test('une session sans résultat est comptée comme 1 WIP', () => {
    const sessions = [{ success_count: 0, failure_count: 0 }];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(1);
    expect(agg.wip).toBe(1);
    expect(agg.passed).toBe(0);
    expect(agg.failed).toBe(0);
    expect(agg.completed).toBe(0);
  });

  test('plusieurs sessions (Gab + Pauline + Sophie) agrégées correctement', () => {
    const sessions = [
      { success_count: 2, failure_count: 1 }, // Gab
      { success_count: 1, failure_count: 0 }, // Pauline
      { success_count: 0, failure_count: 3 }, // Sophie
    ];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(7);     // 3 + 1 + 3
    expect(agg.passed).toBe(3);    // 2 + 1 + 0
    expect(agg.failed).toBe(4);    // 1 + 0 + 3
    expect(agg.completed).toBe(7);
    expect(agg.wip).toBe(0);
  });

  test('mix session avec résultats et session WIP', () => {
    const sessions = [
      { success_count: 5, failure_count: 0 },
      { success_count: 0, failure_count: 0 }, // WIP
    ];
    const agg = aggregateSessions(sessions);
    expect(agg.total).toBe(6);     // 5 + 1 WIP
    expect(agg.passed).toBe(5);
    expect(agg.wip).toBe(1);
    expect(agg.completed).toBe(5); // La session WIP n'est pas completed
  });

  test('liste de sessions vide → agrégat à zéro', () => {
    const agg = aggregateSessions([]);
    expect(agg.total).toBe(0);
    expect(agg.passed).toBe(0);
    expect(agg.failed).toBe(0);
    expect(agg.wip).toBe(0);
  });
});

// ─── Helper extrait de testmo.service.js — isCaseEnriched ────────────────────
function isCaseEnriched(testCase) {
  if (testCase.estimate && testCase.estimate > 0) return true;
  if (testCase.issues && testCase.issues.length > 0) return true;

  const manualTags = (testCase.tags || []).filter(t => {
    const name = typeof t === 'string' ? t : (t.name || t.tag || '');
    if (!name) return false;
    return !name.startsWith('gitlab-') && !name.startsWith('iteration-') && name !== 'sync-auto';
  });
  if (manualTags.length > 0) return true;

  if (testCase.custom_priority && testCase.custom_priority !== 'Normal' && testCase.custom_priority !== 2) return true;
  if (testCase.attachments && testCase.attachments.length > 0) return true;
  if (testCase.custom_steps && testCase.custom_steps.length > 0) return true;

  return false;
}

describe('isCaseEnriched — protection anti-écrasement des cas enrichis', () => {
  // ── Cas NON enrichis (sync peut écraser) ──
  test('case vide (auto-créé, pas de data) → false', () => {
    expect(isCaseEnriched({})).toBe(false);
  });

  test('only auto-tags (sync-auto, gitlab-, iteration-) → false', () => {
    const c = { tags: ['sync-auto', 'gitlab-6015', 'iteration-r14-run-1'] };
    expect(isCaseEnriched(c)).toBe(false);
  });

  test('tags sous forme objet { name } uniquement auto → false', () => {
    const c = { tags: [{ name: 'sync-auto' }, { name: 'gitlab-6015' }] };
    expect(isCaseEnriched(c)).toBe(false);
  });

  // ── Cas ENRICHIS (sync doit skiper) ──
  test('a des custom_steps (data ajoutée manuellement) → true', () => {
    const c = { custom_steps: [{ step: 'Ouvrir la page', expected: 'Page affichée' }] };
    expect(isCaseEnriched(c)).toBe(true);
  });

  test('a un estimate → true', () => {
    expect(isCaseEnriched({ estimate: 900 })).toBe(true);
  });

  test('a des issues liées → true', () => {
    expect(isCaseEnriched({ issues: [{ id: 1 }] })).toBe(true);
  });

  test('a un tag manuel (ni gitlab-, ni iteration-, ni sync-auto) → true', () => {
    const c = { tags: ['sync-auto', 'regression'] };
    expect(isCaseEnriched(c)).toBe(true);
  });

  test('priorité custom ≠ Normal → true', () => {
    expect(isCaseEnriched({ custom_priority: 'High' })).toBe(true);
  });

  test('a des attachments → true', () => {
    expect(isCaseEnriched({ attachments: [{ id: 1 }] })).toBe(true);
  });

  // ── Régression : tags malformés (bug #6015) ──
  test('tag objet avec champ .tag (pas .name) → ne crash pas, auto-tag ignoré', () => {
    // Cas qui provoquait "Cannot read properties of undefined (reading 'startsWith')"
    const c = { tags: [{ id: 5, tag: 'sync-auto' }, { id: 6, tag: 'gitlab-6015' }] };
    expect(() => isCaseEnriched(c)).not.toThrow();
    expect(isCaseEnriched(c)).toBe(false); // ce sont des auto-tags
  });

  test('tag objet avec champ .tag manuel → true', () => {
    const c = { tags: [{ id: 5, tag: 'sync-auto' }, { id: 7, tag: 'smoke' }] };
    expect(isCaseEnriched(c)).toBe(true);
  });

  test('tag objet sans .name ni .tag (objet incomplet) → ne crash pas', () => {
    const c = { tags: [{ id: 5 }, { id: 6 }] };
    expect(() => isCaseEnriched(c)).not.toThrow();
    expect(isCaseEnriched(c)).toBe(false);
  });

  test('tags null/undefined → ne crash pas → false', () => {
    expect(isCaseEnriched({ tags: null })).toBe(false);
    expect(isCaseEnriched({ tags: undefined })).toBe(false);
  });
});

describe('globalMetrics — formules ISTQB', () => {
  test('completionRate = completed / total', () => {
    const agg = { total: 10, completed: 8, passed: 6, failed: 2 };
    expect(globalMetrics(agg).completionRate).toBe(80);
  });

  test('passRate = passed / completed (pas sur total)', () => {
    // 6 passed sur 8 exécutés (2 non-exécutés) → 75%, pas 60%
    const agg = { total: 10, completed: 8, passed: 6, failed: 2 };
    expect(globalMetrics(agg).passRate).toBe(75);
  });

  test('failureRate = failed / completed', () => {
    const agg = { total: 10, completed: 8, passed: 6, failed: 2 };
    expect(globalMetrics(agg).failureRate).toBe(25);
  });

  test('passRate + failureRate = 100% quand tout est passé ou échoué', () => {
    const agg = { total: 10, completed: 10, passed: 7, failed: 3 };
    const m = globalMetrics(agg);
    expect(m.passRate + m.failureRate).toBe(100);
  });

  test('testEfficiency = passed / (passed + failed)', () => {
    // Exclut les non-décisifs (blocked, skipped) — mesure la qualité des exécutions
    const agg = { total: 10, completed: 10, passed: 8, failed: 2 };
    expect(globalMetrics(agg).testEfficiency).toBe(80);
  });

  test('testEfficiency résiste à 0 passed et 0 failed', () => {
    const agg = { total: 5, completed: 0, passed: 0, failed: 0 };
    expect(globalMetrics(agg).testEfficiency).toBe(0);
  });

  test('cas réel : Gab + Pauline + Sophie agrégées', () => {
    // total=7, passed=3, failed=4, completed=7
    const sessions = [
      { success_count: 2, failure_count: 1 },
      { success_count: 1, failure_count: 0 },
      { success_count: 0, failure_count: 3 },
    ];
    const agg = aggregateSessions(sessions);
    const m = globalMetrics(agg);

    expect(m.completionRate).toBe(100);           // 7/7
    expect(m.passRate).toBe(42.86);               // 3/7
    expect(m.failureRate).toBe(57.14);            // 4/7
    expect(m.testEfficiency).toBe(42.86);         // 3/(3+4)
  });

  test('toutes sessions passées → passRate 100%, failureRate 0%', () => {
    const agg = { total: 5, completed: 5, passed: 5, failed: 0 };
    const m = globalMetrics(agg);
    expect(m.passRate).toBe(100);
    expect(m.failureRate).toBe(0);
    expect(m.testEfficiency).toBe(100);
  });

  test('zéro tests → toutes les métriques à 0 (pas de crash)', () => {
    const agg = { total: 0, completed: 0, passed: 0, failed: 0 };
    const m = globalMetrics(agg);
    expect(m.completionRate).toBe(0);
    expect(m.passRate).toBe(0);
    expect(m.failureRate).toBe(0);
    expect(m.testEfficiency).toBe(0);
  });
});
