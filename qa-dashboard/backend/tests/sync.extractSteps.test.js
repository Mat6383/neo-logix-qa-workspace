'use strict';
/**
 * Tests — SyncService._extractStepsFromNotes
 * Méthode privée testée via l'instance singleton exportée.
 */
const syncService = require('../services/sync.service');

describe('_extractStepsFromNotes', () => {
  test('tableau vide → []', () => {
    expect(syncService._extractStepsFromNotes([])).toEqual([]);
  });

  test('notes sans section [LABEL] → []', () => {
    const notes = [{ body: 'simple commentaire sans crochets' }];
    expect(syncService._extractStepsFromNotes(notes)).toEqual([]);
  });

  test('lien markdown [texte](url) ignoré — ne crée pas de section', () => {
    const notes = [{ body: '[voir doc](https://example.com)' }];
    expect(syncService._extractStepsFromNotes(notes)).toEqual([]);
  });

  test('une section [PRÉREQUIS] → 1 step avec display_order=1', () => {
    const notes = [{ body: '[PRÉREQUIS]\nAccès admin requis' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toHaveLength(1);
    expect(steps[0].display_order).toBe(1);
    expect(steps[0].text3).toBeDefined();
  });

  test('section [TEST] placée en dernier même si elle apparaît en premier dans la note', () => {
    const notes = [{
      body: '[TEST]\nVérifier le résultat\n[CONTEXTE]\nEnvironnement de test'
    }];
    const steps = syncService._extractStepsFromNotes(notes);
    const testIdx = steps.findIndex(s => s.text1.includes('TEST'));
    const ctxIdx  = steps.findIndex(s => s.text1.includes('CONTEXTE'));
    expect(ctxIdx).toBeLessThan(testIdx);
  });

  test('[TESTS] (pluriel) traité comme [TEST]', () => {
    const notes = [{ body: '[PRÉREQUIS]\nStep 1\n[TESTS]\nStep test' }];
    const steps = syncService._extractStepsFromNotes(notes);
    const last = steps[steps.length - 1];
    expect(last.text1).toContain('TESTS');
  });

  test('plusieurs notes : sections [TEST] collectées depuis toutes les notes, reste depuis la plus longue', () => {
    const notes = [
      { body: '[CONTEXTE]\nContexte court' },
      { body: '[PRÉREQUIS]\nPrérequis détaillés\n[CONTEXTE]\nContexte plus long ici' },
      { body: '[TEST]\nTest note 1' },
      { body: '[TEST]\nTest note 2' },
    ];
    const steps = syncService._extractStepsFromNotes(notes);
    // Les 2 [TEST] doivent être présents
    const testSteps = steps.filter(s => s.text1.includes('TEST'));
    expect(testSteps).toHaveLength(2);
    // La section [PRÉREQUIS] doit venir de la note la plus longue
    const prereqStep = steps.find(s => s.text1.includes('PRÉREQUIS'));
    expect(prereqStep).toBeDefined();
    expect(prereqStep.text1).toContain('détaillés');
  });

  test('display_order est séquentiel à partir de 1', () => {
    const notes = [{ body: '[PRÉREQUIS]\nStep 1\n[CONTEXTE]\nStep 2\n[TEST]\nStep 3' }];
    const steps = syncService._extractStepsFromNotes(notes);
    steps.forEach((s, i) => expect(s.display_order).toBe(i + 1));
  });

  test('text3 est la valeur expected constante (conforme aux specs)', () => {
    const notes = [{ body: '[TEST]\nVérification' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps[0].text3).toContain('Conforme');
  });
});
