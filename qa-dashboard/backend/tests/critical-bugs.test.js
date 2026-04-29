/**
 * ================================================
 * TESTS — Corrections bugs critiques
 * ================================================
 * Couvre les 3 bugs identifiés lors de l'audit 2026-04-29 :
 *   1. NaN silencieux dans parseMilestones (dashboard.controller)
 *   2. XSS via marked.parse sans sanitisation (sync.service)
 *   3. N+1 appels getIssueNotes dans status-sync (status-sync.service)
 */

// ─── Bug 1 : NaN dans parseMilestones ──────────────────────────────────────

const { parseMilestones } = require('../controllers/dashboard.controller');

describe('parseMilestones — filtrage NaN', () => {
  test('retourne null pour entrée nulle', () => {
    expect(parseMilestones(null)).toBeNull();
  });

  test('retourne null pour entrée undefined', () => {
    expect(parseMilestones(undefined)).toBeNull();
  });

  test('retourne null pour chaîne vide', () => {
    expect(parseMilestones('')).toBeNull();
  });

  test('parse des IDs entiers valides', () => {
    expect(parseMilestones('1,2,3')).toEqual([1, 2, 3]);
  });

  test('filtre silencieusement les chaînes non-numériques', () => {
    expect(parseMilestones('1,abc,3')).toEqual([1, 3]);
  });

  test('retourne null si tous les IDs sont invalides', () => {
    expect(parseMilestones('abc,xyz')).toBeNull();
  });

  test('filtre les nombres non-positifs (0, négatifs)', () => {
    expect(parseMilestones('1,-2,0,3')).toEqual([1, 3]);
  });

  test('gère les espaces autour des IDs', () => {
    expect(parseMilestones(' 1 , 2 , 3 ')).toEqual([1, 2, 3]);
  });

  test('parse un seul ID', () => {
    expect(parseMilestones('42')).toEqual([42]);
  });
});

// ─── Bug 2 : XSS via marked.parse ──────────────────────────────────────────

const syncService = require('../services/sync.service');

describe('XSS sanitisation — _extractStepsFromNotes', () => {
  test('supprime les balises <script>', () => {
    const notes = [{ body: '[TEST]\n<script>alert(1)</script>\ncontenu step' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toHaveLength(1);
    expect(steps[0].text1).not.toContain('<script>');
    expect(steps[0].text1).not.toContain('alert(1)');
  });

  test("supprime l'attribut onerror (XSS via img)", () => {
    const notes = [{ body: '[TEST]\n<img src=x onerror="alert(1)">\ncontenu' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toHaveLength(1);
    expect(steps[0].text1).not.toContain('onerror');
  });

  test('supprime les balises <iframe>', () => {
    const notes = [{ body: '[PRÉREQUIS]\n<iframe src="evil.com"></iframe>\ncontenu' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toHaveLength(1);
    expect(steps[0].text1).not.toContain('<iframe>');
    expect(steps[0].text1).not.toContain('evil.com');
  });

  test('conserve le contenu textuel légitime après sanitisation', () => {
    const notes = [{ body: '[PRÉREQUIS]\nVérifier la connexion\n[TEST]\nCliquer sur le bouton' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps.length).toBeGreaterThanOrEqual(1);
    const allText = steps.map(s => s.text1).join(' ');
    expect(allText).toMatch(/Vérifier|Cliquer/);
  });

  test('retourne tableau vide pour notes sans sections [LABEL]', () => {
    const notes = [{ body: 'Simple commentaire sans sections' }];
    const steps = syncService._extractStepsFromNotes(notes);
    expect(steps).toEqual([]);
  });
});

// ─── Bug 3 : N+1 appels getIssueNotes ──────────────────────────────────────

const { StatusSyncService } = require('../services/status-sync.service');

describe('StatusSync — pré-chargement notes (pas de N+1)', () => {
  test('getIssueNotes est appelé avant updateWorkItemStatus', async () => {
    const callOrder = [];

    // Mock des dépendances GitLab
    const gitlabMock = {
      findIterationForProject: async () => ({ id: 42 }),
      getIssuesForIteration: async () => [
        { id: 1000, iid: 1, title: 'Case A' },
        { id: 1001, iid: 2, title: 'Case B' }
      ],
      getIssueNotes: async (_pid, iid) => {
        callOrder.push(`notes:${iid}`);
        return [];
      },
      updateWorkItemStatus: async (gid) => {
        callOrder.push(`update:${gid}`);
      },
      addIssueComment: async () => {}
    };

    const service = new StatusSyncService();
    // Surcharger les méthodes internes
    service._getRunInfo    = async () => ({ name: 'Run 1' });
    service._getRunResults = async () => [
      { case_id: 1, case_name: 'Case A', status_id: 2, is_latest: true },
      { case_id: 2, case_name: 'Case B', status_id: 3, is_latest: true }
    ];
    service._getCaseNames  = async () => new Map([[1, 'Case A'], [2, 'Case B']]);

    // Injecter le mock GitLab dans le module
    const gitlabModule = require('../services/gitlab.service');
    Object.assign(gitlabModule, gitlabMock);

    await service.syncRunStatusToGitLab(99, 'R01 - run 1', '123', () => {}, false);

    // Vérifier que tous les appels notes: précèdent tous les appels update:
    const noteIndices   = callOrder.map((c, i) => c.startsWith('notes:')  ? i : -1).filter(i => i >= 0);
    const updateIndices = callOrder.map((c, i) => c.startsWith('update:') ? i : -1).filter(i => i >= 0);

    expect(noteIndices.length).toBeGreaterThan(0);
    expect(updateIndices.length).toBeGreaterThan(0);
    expect(Math.max(...noteIndices)).toBeLessThan(Math.min(...updateIndices));
  });
});
