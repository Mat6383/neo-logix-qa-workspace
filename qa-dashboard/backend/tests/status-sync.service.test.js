/**
 * Tests — status-sync.service.js (Testmo → GitLab)
 * Couvre : buildCommentText, isCommentDuplicate, computeLabelChanges,
 *           computeStatusChange, cohérence du mapping STATUS_TO_LABEL
 */

const {
  buildCommentText,
  isCommentDuplicate,
  computeLabelChanges,
  computeStatusChange,
  STATUS_TO_LABEL,
  ALL_TEST_LABELS
} = require('../services/status-sync.service');

// ─── buildCommentText ────────────────────────────────────────────────────────

describe('buildCommentText', () => {
  test('status 2 (Passed) → contient "Passed" et le nom du run', () => {
    const text = buildCommentText('R10 - run 1', 2);
    expect(text).toContain('R10 - run 1');
    expect(text).toContain('Passed');
  });

  test('status 3 (Failed) → contient "Failed"', () => {
    const text = buildCommentText('R10 - run 1', 3);
    expect(text).toContain('Failed');
  });

  test('status inconnu → utilise le numéro brut comme fallback', () => {
    const text = buildCommentText('Run Test', 99);
    expect(text).toContain('99');
  });
});

// ─── isCommentDuplicate ──────────────────────────────────────────────────────

describe('isCommentDuplicate', () => {
  test('commentaire identique présent → true', () => {
    const notes = [
      { body: 'commentaire existant', system: false },
      { body: 'texte cible', system: false }
    ];
    expect(isCommentDuplicate(notes, 'texte cible')).toBe(true);
  });

  test('commentaire absent → false', () => {
    const notes = [{ body: 'autre commentaire', system: false }];
    expect(isCommentDuplicate(notes, 'texte introuvable')).toBe(false);
  });

  test('tableau vide → false', () => {
    expect(isCommentDuplicate([], 'texte quelconque')).toBe(false);
  });
});

// ─── computeLabelChanges ─────────────────────────────────────────────────────

describe('computeLabelChanges', () => {
  test('newLabel null → action skip', () => {
    const result = computeLabelChanges(['Test::OK'], null);
    expect(result.action).toBe('skip');
    expect(result.addLabel).toBeNull();
  });

  test('issue sans label Test:: + nouveau label → action update', () => {
    const result = computeLabelChanges(['Bug', 'Feature'], 'Test::OK');
    expect(result.action).toBe('update');
    expect(result.addLabel).toBe('Test::OK');
    expect(result.removeLabels).toEqual([]);
  });

  test('issue avec le même label déjà présent → action noop', () => {
    const result = computeLabelChanges(['Test::OK', 'Bug'], 'Test::OK');
    expect(result.action).toBe('noop');
    expect(result.removeLabels).toHaveLength(0);
  });

  test("issue avec un autre label Test:: → retire l'ancien, ajoute le nouveau", () => {
    const result = computeLabelChanges(['Test::KO', 'Bug'], 'Test::OK');
    expect(result.action).toBe('update');
    expect(result.addLabel).toBe('Test::OK');
    expect(result.removeLabels).toContain('Test::KO');
    expect(result.removeLabels).not.toContain('Bug');
  });

  test('plusieurs labels Test:: présents → tous retirés sauf le nouveau', () => {
    const result = computeLabelChanges(['Test::KO', 'Test::WIP', 'Bug'], 'Test::OK');
    expect(result.removeLabels).toContain('Test::KO');
    expect(result.removeLabels).toContain('Test::WIP');
    expect(result.removeLabels).not.toContain('Bug');
    expect(result.addLabel).toBe('Test::OK');
  });
});

// ─── computeStatusChange ─────────────────────────────────────────────────────

describe('computeStatusChange', () => {
  test('newStatus null → action skip', () => {
    const result = computeStatusChange('gid://status/18', null);
    expect(result.action).toBe('skip');
    expect(result.newStatus).toBeNull();
  });

  test('statuts identiques → action noop', () => {
    const gid = 'gid://gitlab/WorkItems::Statuses::Custom::Status/18';
    const result = computeStatusChange(gid, gid);
    expect(result.action).toBe('noop');
  });

  test('statut différent → action update', () => {
    const current = 'gid://gitlab/WorkItems::Statuses::Custom::Status/17';
    const next    = 'gid://gitlab/WorkItems::Statuses::Custom::Status/18';
    const result  = computeStatusChange(current, next);
    expect(result.action).toBe('update');
    expect(result.newStatus).toBe(next);
  });
});

// ─── Cohérence du mapping ─────────────────────────────────────────────────────

describe('STATUS_TO_LABEL — cohérence du mapping', () => {
  test('les labels du mapping sont tous dans ALL_TEST_LABELS', () => {
    for (const label of Object.values(STATUS_TO_LABEL)) {
      expect(ALL_TEST_LABELS).toContain(label);
    }
  });

  test('les 4 statuts principaux sont mappés (2, 3, 4, 8)', () => {
    expect(STATUS_TO_LABEL[2]).toBeDefined(); // Passed
    expect(STATUS_TO_LABEL[3]).toBeDefined(); // Failed
    expect(STATUS_TO_LABEL[4]).toBeDefined(); // Retest
    expect(STATUS_TO_LABEL[8]).toBeDefined(); // WIP
  });
});
