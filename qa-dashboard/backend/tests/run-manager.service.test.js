'use strict';

const { isResultPristine, computeMergePreview } = require('../services/run-manager.service');

describe('isResultPristine', () => {
  test('true — résultat vierge (tous champs null/vides)', () => {
    expect(
      isResultPristine({ status_id: null, elapsed: 0, comment: '', custom_steps_results: [] })
    ).toBe(true);
  });

  test('false — status_id défini', () => {
    expect(isResultPristine({ status_id: 2, elapsed: 0, comment: '' })).toBe(false);
  });

  test('false — status_id zéro (cas limite)', () => {
    expect(isResultPristine({ status_id: 0, elapsed: 0, comment: '' })).toBe(false);
  });

  test('false — elapsed > 0', () => {
    expect(isResultPristine({ status_id: null, elapsed: 300, comment: '' })).toBe(false);
  });

  test('false — comment non vide', () => {
    expect(isResultPristine({ status_id: null, elapsed: 0, comment: 'Bug reproduit' })).toBe(false);
  });

  test('false — step avec actual_result', () => {
    expect(
      isResultPristine({
        status_id: null,
        elapsed: 0,
        comment: '',
        custom_steps_results: [{ actual_result: "L'écran affiche une erreur", status_id: null }],
      })
    ).toBe(false);
  });

  test('false — step avec status_id', () => {
    expect(
      isResultPristine({
        status_id: null,
        elapsed: 0,
        comment: '',
        custom_steps_results: [{ actual_result: '', status_id: 3 }],
      })
    ).toBe(false);
  });

  test('true — steps présents mais vides', () => {
    expect(
      isResultPristine({
        status_id: null,
        elapsed: 0,
        comment: '',
        custom_steps_results: [{ actual_result: '', status_id: null }],
      })
    ).toBe(true);
  });

  test('true — champs absents (cas minimum)', () => {
    expect(isResultPristine({})).toBe(true);
  });
});

describe('computeMergePreview', () => {
  const existingResults = [
    { case_id: 1, status_id: 2, elapsed: 60, comment: 'OK', custom_steps_results: [] },
    { case_id: 2, status_id: null, elapsed: 0, comment: '', custom_steps_results: [] },
    { case_id: 3, status_id: 3, elapsed: 120, comment: '', custom_steps_results: [] },
  ];

  test('identifie les cas à ajouter, préservés, testés, absents du sync', () => {
    const syncCaseIds = [2, 4, 5];
    const result = computeMergePreview(existingResults, syncCaseIds);
    expect(result.toAdd).toEqual([4, 5]);
    expect(result.pristineInRun).toEqual([2]);
    expect(result.testedInRun).toEqual(expect.arrayContaining([1, 3]));
    expect(result.inRunNotInSync).toEqual(expect.arrayContaining([1, 3]));
  });

  test('aucun ajout si tous les cas sync sont déjà dans le run', () => {
    const syncCaseIds = [1, 2, 3];
    const result = computeMergePreview(existingResults, syncCaseIds);
    expect(result.toAdd).toEqual([]);
  });

  test('tous les cas à ajouter si run vide', () => {
    const result = computeMergePreview([], [10, 20, 30]);
    expect(result.toAdd).toEqual([10, 20, 30]);
    expect(result.pristineInRun).toEqual([]);
    expect(result.testedInRun).toEqual([]);
  });
});
