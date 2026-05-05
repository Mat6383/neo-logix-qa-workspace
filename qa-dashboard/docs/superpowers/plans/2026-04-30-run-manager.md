# Run Manager — Créer/Mettre à jour un run Testmo post-sync GitLab

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Après un sync GitLab → Testmo (Dashboard6), permettre de créer un nouveau run ou d'en mettre à jour un existant sans écraser les cas déjà testés. Disponible en deux points d'entrée : Option A intégrée dans Dashboard6, Option B dans un Dashboard9 autonome.

**Architecture:** Un service backend `run-manager.service.js` encapsule la logique de préservation (isResultPristine) et de merge. Quatre nouveaux endpoints sur `/api/runs` alimentent un composant React `RunActionPanel.jsx` réutilisé dans Dashboard6 (Option A) et Dashboard9 (Option B).

**Tech Stack:** Express/Node.js, Zod, supertest, Jest, React 18, lucide-react, CSS modules existants

---

## Map des fichiers

### À créer
| Fichier | Rôle |
|---------|------|
| `backend/services/run-manager.service.js` | `isResultPristine`, `computeMergePreview`, `executeMerge` |
| `backend/tests/run-manager.service.test.js` | Tests unitaires de la logique de préservation |
| `backend/tests/routes/run-manager.routes.test.js` | Tests supertest des 5 nouveaux endpoints |
| `frontend/src/components/RunActionPanel.jsx` | Composant partagé : machine d'états + modal confirmation |
| `frontend/src/styles/RunActionPanel.css` | Styles du panneau |
| `frontend/src/components/Dashboard9.jsx` | Option B — gestionnaire de runs autonome |
| `frontend/src/styles/Dashboard9.css` | Styles Dashboard9 |

### À modifier
| Fichier | Modifications |
|---------|--------------|
| `backend/validators/index.js` | +4 schemas Zod : `folderCasesQuery`, `projectRunsQuery`, `createRunBody`, `mergeBody` |
| `backend/routes/runs.routes.js` | +5 routes (avant les routes `:runId` existantes) |
| `backend/services/testmo.service.js` | +3 méthodes : `createRun`, `getAllRunResults`, `updateRunCaseIds` |
| `frontend/src/services/api.service.js` | +5 méthodes de l'API runs manager |
| `frontend/src/components/Dashboard6.jsx` | Option A : afficher `RunActionPanel` quand `state === 'done'` |
| `frontend/src/App.jsx` | +Dashboard9 lazy import, route `/runs/manage`, option dropdown |

---

## Règle de préservation — référence

Un résultat de run est **"intouchable"** (`isResultPristine` retourne `false`) si AU MOINS UNE condition est vraie :
- `result.status_id !== null && result.status_id !== undefined`
- `result.elapsed > 0`
- `result.comment && result.comment.trim().length > 0`
- Au moins un step a `actual_result` non vide **ou** `status_id` défini

---

## Task 1 — Testmo service : 3 nouvelles méthodes

**Files:**
- Modify: `backend/services/testmo.service.js`

- [ ] **Step 1 : Écrire les tests unitaires (fichier séparé, Task 3)**

  > Les tests viendront en Task 3 via supertest. Ici on implémente directement car les méthodes s'appuient sur l'API Testmo externe.

- [ ] **Step 2 : Ajouter `getAllRunResults(runId)` avec pagination**

  Dans `testmo.service.js`, après la méthode `getRunResults` (ligne ~289), ajouter :

  ```js
  async getAllRunResults(runId) {
    try {
      const allResults = [];
      let page = 1;
      while (true) {
        const response = await this._withRetry(
          () => this.client.get(`/runs/${runId}/results`, {
            params: { per_page: 100, page, expands: 'users' },
          }),
          `getAllRunResults_p${page}`
        );
        const batch = response.data.result || [];
        allResults.push(...batch);
        if (!response.data.next_page) break;
        page++;
      }
      return allResults;
    } catch (error) {
      throw this._handleError('getAllRunResults', error);
    }
  }
  ```

- [ ] **Step 3 : Ajouter `createRun(projectId, runData)`**

  Après `getAllRunResults`, ajouter :

  ```js
  async createRun(projectId, { name, description = '', milestoneId = null, caseIds = [] }) {
    try {
      const run = { name };
      if (description) run.description = description;
      if (milestoneId) run.milestone_id = milestoneId;
      if (caseIds.length > 0) run.case_ids = caseIds;
      const response = await this.client.post(`/projects/${projectId}/runs`, { runs: [run] });
      const created = response.data.result ? response.data.result[0] : response.data;
      logger.info(`Testmo: Run créé — "${name}" (id=${created.id}, cases=${caseIds.length})`);
      return created;
    } catch (error) {
      throw this._handleError('createRun', error);
    }
  }
  ```

- [ ] **Step 4 : Ajouter `updateRunCaseIds(runId, caseIds)`**

  Après `createRun`, ajouter :

  ```js
  async updateRunCaseIds(runId, caseIds) {
    try {
      const response = await this.client.patch(`/runs/${runId}`, {
        runs: [{ case_ids: caseIds }],
      });
      logger.info(`Testmo: Run ${runId} — case_ids mis à jour (${caseIds.length} cas)`);
      return response.data;
    } catch (error) {
      throw this._handleError('updateRunCaseIds', error);
    }
  }
  ```

- [ ] **Step 5 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add backend/services/testmo.service.js
  git commit -m "feat(testmo): getAllRunResults, createRun, updateRunCaseIds"
  ```

---

## Task 2 — run-manager.service.js

**Files:**
- Create: `backend/services/run-manager.service.js`
- Create: `backend/tests/run-manager.service.test.js`

- [ ] **Step 1 : Écrire les tests unitaires d'abord**

  Créer `backend/tests/run-manager.service.test.js` :

  ```js
  'use strict';

  const {
    isResultPristine,
    computeMergePreview,
  } = require('../../services/run-manager.service');

  describe('isResultPristine', () => {
    test('true — résultat vierge (tous champs null/vides)', () => {
      expect(isResultPristine({ status_id: null, elapsed: 0, comment: '', custom_steps_results: [] })).toBe(true);
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
      expect(isResultPristine({
        status_id: null, elapsed: 0, comment: '',
        custom_steps_results: [{ actual_result: 'L\'écran affiche une erreur', status_id: null }],
      })).toBe(false);
    });

    test('false — step avec status_id', () => {
      expect(isResultPristine({
        status_id: null, elapsed: 0, comment: '',
        custom_steps_results: [{ actual_result: '', status_id: 3 }],
      })).toBe(false);
    });

    test('true — steps présents mais vides', () => {
      expect(isResultPristine({
        status_id: null, elapsed: 0, comment: '',
        custom_steps_results: [{ actual_result: '', status_id: null }],
      })).toBe(true);
    });

    test('true — champs absents (cas minimum)', () => {
      expect(isResultPristine({})).toBe(true);
    });
  });

  describe('computeMergePreview', () => {
    const existingResults = [
      { case_id: 1, status_id: 2,    elapsed: 60,  comment: 'OK',  custom_steps_results: [] },
      { case_id: 2, status_id: null, elapsed: 0,   comment: '',    custom_steps_results: [] },
      { case_id: 3, status_id: 3,    elapsed: 120, comment: '',    custom_steps_results: [] },
    ];

    test('identifie les cas à ajouter, préservés, testés, absents du sync', () => {
      const syncCaseIds = [2, 4, 5]; // 2 déjà dans run, 4+5 à ajouter, 1+3 dans run mais absents du sync
      const result = computeMergePreview(existingResults, syncCaseIds);
      expect(result.toAdd).toEqual([4, 5]);
      expect(result.pristineInRun).toEqual([2]);
      expect(result.testedInRun).toEqual([1, 3]);
      expect(result.inRunNotInSync).toEqual([1, 3]);
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
  ```

- [ ] **Step 2 : Vérifier que les tests échouent**

  ```bash
  cd backend && npx jest tests/run-manager.service.test.js --no-coverage 2>&1 | tail -5
  ```
  Attendu : `FAIL` avec `Cannot find module '../../services/run-manager.service'`

- [ ] **Step 3 : Implémenter `run-manager.service.js`**

  Créer `backend/services/run-manager.service.js` :

  ```js
  'use strict';

  const testmoService = require('./testmo.service');
  const logger = require('./logger.service');
  const PROJECTS = require('../config/projects.config');

  /**
   * Retourne true si le résultat de run est 100% vierge (aucune donnée saisie).
   * @param {Object} result - Résultat Testmo d'un cas de test dans un run
   */
  function isResultPristine(result) {
    if (result.status_id !== null && result.status_id !== undefined) return false;
    if (result.elapsed && result.elapsed > 0) return false;
    if (result.comment && result.comment.trim().length > 0) return false;
    const steps = result.custom_steps_results || [];
    const hasStepData = steps.some(
      (s) =>
        (s.actual_result && s.actual_result.trim().length > 0) ||
        (s.status_id !== null && s.status_id !== undefined)
    );
    if (hasStepData) return false;
    return true;
  }

  /**
   * Calcule le preview du merge : quels cas ajouter, lesquels sont préservés.
   * @param {Array} existingResults - Résultats actuels du run (depuis getAllRunResults)
   * @param {number[]} syncCaseIds - IDs des cas issus du sync (à intégrer dans le run)
   * @returns {{ toAdd, pristineInRun, testedInRun, inRunNotInSync, allFinalCaseIds }}
   */
  function computeMergePreview(existingResults, syncCaseIds) {
    const existingMap = new Map(existingResults.map((r) => [r.case_id, r]));
    const syncSet = new Set(syncCaseIds);

    const toAdd = syncCaseIds.filter((id) => !existingMap.has(id));
    const pristineInRun = [];
    const testedInRun = [];
    const inRunNotInSync = [];

    for (const [caseId, result] of existingMap) {
      if (syncSet.has(caseId)) {
        isResultPristine(result) ? pristineInRun.push(caseId) : testedInRun.push(caseId);
      } else {
        inRunNotInSync.push(caseId);
      }
    }

    const allFinalCaseIds = [
      ...existingResults.map((r) => r.case_id),
      ...toAdd,
    ];

    return { toAdd, pristineInRun, testedInRun, inRunNotInSync, allFinalCaseIds };
  }

  /**
   * Résout le projet Testmo depuis un syncProjectId (ex: 'neo-pilot').
   * @param {string} syncProjectId
   * @returns {{ testmoProjectId, rootFolderId }}
   */
  function resolveProject(syncProjectId) {
    const project = PROJECTS.find((p) => p.id === syncProjectId);
    if (!project) throw new Error(`Projet inconnu : "${syncProjectId}"`);
    return {
      testmoProjectId: project.testmo.projectId,
      rootFolderId: project.testmo.rootFolderId,
    };
  }

  /**
   * Récupère les IDs de tous les cas dans le dossier d'une itération.
   * @param {string} syncProjectId - ex: 'neo-pilot'
   * @param {string} iterationName - ex: 'R14 - run 1'
   * @returns {{ folderId, folderName, caseIds }}
   */
  async function getFolderCases(syncProjectId, iterationName) {
    const { testmoProjectId } = resolveProject(syncProjectId);
    const folder = await testmoService.findFolder(testmoProjectId, iterationName, null);
    if (!folder) {
      throw new Error(`Dossier Testmo introuvable pour l'itération "${iterationName}"`);
    }
    const cases = await testmoService.getCases(testmoProjectId, folder.id, null);
    return {
      folderId: folder.id,
      folderName: folder.name,
      caseIds: cases.map((c) => c.id),
    };
  }

  /**
   * Liste les runs actifs d'un projet (pour sélecteur UI).
   * @param {string} syncProjectId
   * @param {boolean} activeOnly
   */
  async function getProjectRunsList(syncProjectId, activeOnly = true) {
    const { testmoProjectId } = resolveProject(syncProjectId);
    const data = await testmoService.getProjectRuns(testmoProjectId, activeOnly);
    const runs = data.result || [];
    return runs.map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      isClosed: r.is_closed,
    }));
  }

  /**
   * Crée un nouveau run Testmo à partir des cas du dossier d'itération.
   * @param {string} syncProjectId
   * @param {string} name - Nom du run
   * @param {number[]} caseIds
   * @param {number|null} milestoneId
   */
  async function createRunFromCases(syncProjectId, name, caseIds, milestoneId = null) {
    const { testmoProjectId } = resolveProject(syncProjectId);
    const created = await testmoService.createRun(testmoProjectId, { name, caseIds, milestoneId });
    logger.info(`RunManager: Run créé — id=${created.id} name="${name}" cases=${caseIds.length}`);
    return created;
  }

  /**
   * Merge les cas dans un run existant en préservant les cas déjà testés.
   * @param {number} runId
   * @param {number[]} syncCaseIds - IDs à intégrer dans le run
   * @returns {{ added, preserved, preview }}
   */
  async function mergeRunCases(runId, syncCaseIds) {
    const existingResults = await testmoService.getAllRunResults(runId);
    const preview = computeMergePreview(existingResults, syncCaseIds);

    if (preview.toAdd.length === 0) {
      logger.info(`RunManager: Merge run=${runId} — aucun cas à ajouter`);
      return { added: 0, preserved: preview.testedInRun.length, preview };
    }

    await testmoService.updateRunCaseIds(runId, preview.allFinalCaseIds);
    logger.info(
      `RunManager: Merge run=${runId} — ${preview.toAdd.length} ajoutés, ${preview.testedInRun.length} préservés`
    );
    return { added: preview.toAdd.length, preserved: preview.testedInRun.length, preview };
  }

  module.exports = {
    isResultPristine,
    computeMergePreview,
    resolveProject,
    getFolderCases,
    getProjectRunsList,
    createRunFromCases,
    mergeRunCases,
  };
  ```

- [ ] **Step 4 : Vérifier que les tests passent**

  ```bash
  cd backend && npx jest tests/run-manager.service.test.js --no-coverage 2>&1 | tail -10
  ```
  Attendu : `PASS` — 11 tests verts

- [ ] **Step 5 : Commit**

  ```bash
  git add backend/services/run-manager.service.js backend/tests/run-manager.service.test.js
  git commit -m "feat(run-manager): service + tests isResultPristine et computeMergePreview"
  ```

---

## Task 3 — Validators Zod : 4 nouveaux schemas

**Files:**
- Modify: `backend/validators/index.js`

- [ ] **Step 1 : Ajouter les schemas après `autoConfigBody`**

  Dans `backend/validators/index.js`, avant `// ─── Middleware`, ajouter :

  ```js
  const folderCasesQuery = z.object({
    syncProjectId: z.string().min(1, '"syncProjectId" requis'),
    iterationName: z.string().min(1, '"iterationName" requis'),
  });

  const projectRunsQuery = z.object({
    syncProjectId: z.string().min(1, '"syncProjectId" requis'),
    activeOnly: z.enum(['true', 'false']).optional(),
  });

  const createRunBody = z.object({
    syncProjectId: z.string().min(1, '"syncProjectId" requis'),
    name: z.string().min(1, '"name" requis'),
    caseIds: z.array(z.number().int().positive()).min(1, 'Au moins un cas requis'),
    milestoneId: z.number().int().positive().optional(),
  });

  const mergeBody = z.object({
    caseIds: z.array(z.number().int().positive()).min(1, 'Au moins un cas requis'),
  });
  ```

- [ ] **Step 2 : Exporter les nouveaux schemas**

  Dans `module.exports = { ... }`, ajouter :

  ```js
  folderCasesQuery,
  projectRunsQuery,
  createRunBody,
  mergeBody,
  ```

- [ ] **Step 3 : Vérifier que les tests existants passent toujours**

  ```bash
  cd backend && npx jest --no-coverage 2>&1 | tail -5
  ```
  Attendu : suite complète verte, aucun test cassé

- [ ] **Step 4 : Commit**

  ```bash
  git add backend/validators/index.js
  git commit -m "feat(validators): folderCasesQuery, projectRunsQuery, createRunBody, mergeBody"
  ```

---

## Task 4 — Runs routes : 5 nouveaux endpoints

**Files:**
- Modify: `backend/routes/runs.routes.js`

**Important :** Les routes statiques (`/folder-cases`, `/project-runs`, `/`) doivent être déclarées **avant** `/:runId` sinon Express les matchera comme des runIds.

- [ ] **Step 1 : Écrire les tests routes d'abord**

  Créer `backend/tests/routes/run-manager.routes.test.js` :

  ```js
  'use strict';

  const request = require('supertest');

  const mockTestmo = {
    getRunDetails: jest.fn(),
    getRunResults: jest.fn(),
    getProjects: jest.fn(),
    getProjectRuns: jest.fn(),
    getProjectMilestones: jest.fn(),
    getAutomationRuns: jest.fn(),
    clearCache: jest.fn(),
    getAllRunResults: jest.fn(),
    createRun: jest.fn(),
    updateRunCaseIds: jest.fn(),
    findFolder: jest.fn(),
    getCases: jest.fn(),
  };

  const mockRunManager = {
    getFolderCases: jest.fn(),
    getProjectRunsList: jest.fn(),
    createRunFromCases: jest.fn(),
    computeMergePreview: jest.fn(),
    mergeRunCases: jest.fn(),
  };

  jest.mock('../../services/testmo.service', () => mockTestmo);
  jest.mock('../../services/run-manager.service', () => mockRunManager);

  const app = require('../../server');

  beforeEach(() => jest.clearAllMocks());

  describe('GET /api/runs/folder-cases', () => {
    test('400 — syncProjectId manquant', async () => {
      const res = await request(app).get('/api/runs/folder-cases?iterationName=R14');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
    });

    test('400 — iterationName manquant', async () => {
      const res = await request(app).get('/api/runs/folder-cases?syncProjectId=neo-pilot');
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
    });

    test('200 — paramètres valides', async () => {
      mockRunManager.getFolderCases.mockResolvedValue({ folderId: 10, folderName: 'R14', caseIds: [1, 2] });
      const res = await request(app).get('/api/runs/folder-cases?syncProjectId=neo-pilot&iterationName=R14');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { caseIds: [1, 2] } });
    });

    test('500 — dossier introuvable', async () => {
      mockRunManager.getFolderCases.mockRejectedValue(new Error('Dossier introuvable'));
      const res = await request(app).get('/api/runs/folder-cases?syncProjectId=neo-pilot&iterationName=R14');
      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ success: false });
    });
  });

  describe('GET /api/runs/project-runs', () => {
    test('400 — syncProjectId manquant', async () => {
      const res = await request(app).get('/api/runs/project-runs');
      expect(res.status).toBe(400);
    });

    test('200 — liste retournée', async () => {
      mockRunManager.getProjectRunsList.mockResolvedValue([{ id: 42, name: 'Run R14' }]);
      const res = await request(app).get('/api/runs/project-runs?syncProjectId=neo-pilot');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/runs', () => {
    test('400 — body vide', async () => {
      const res = await request(app).post('/api/runs').send({});
      expect(res.status).toBe(400);
    });

    test('400 — caseIds vide', async () => {
      const res = await request(app).post('/api/runs').send({
        syncProjectId: 'neo-pilot', name: 'Run R14', caseIds: [],
      });
      expect(res.status).toBe(400);
    });

    test('200 — run créé', async () => {
      mockRunManager.createRunFromCases.mockResolvedValue({ id: 99, name: 'Run R14' });
      const res = await request(app).post('/api/runs').send({
        syncProjectId: 'neo-pilot', name: 'Run R14', caseIds: [1, 2, 3],
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { id: 99 } });
    });
  });

  describe('POST /api/runs/:runId/merge-preview', () => {
    test('400 — runId invalide', async () => {
      const res = await request(app).post('/api/runs/abc/merge-preview').send({ caseIds: [1] });
      expect(res.status).toBe(400);
    });

    test('400 — caseIds manquant', async () => {
      const res = await request(app).post('/api/runs/42/merge-preview').send({});
      expect(res.status).toBe(400);
    });

    test('200 — preview calculé', async () => {
      mockTestmo.getAllRunResults.mockResolvedValue([
        { case_id: 1, status_id: 2, elapsed: 60, comment: '', custom_steps_results: [] },
      ]);
      mockRunManager.computeMergePreview.mockReturnValue({
        toAdd: [2, 3], pristineInRun: [], testedInRun: [1], inRunNotInSync: [],
      });
      const res = await request(app).post('/api/runs/42/merge-preview').send({ caseIds: [1, 2, 3] });
      expect(res.status).toBe(200);
      expect(res.body.data.toAdd).toHaveLength(2);
    });
  });

  describe('POST /api/runs/:runId/merge', () => {
    test('400 — runId invalide', async () => {
      const res = await request(app).post('/api/runs/0/merge').send({ caseIds: [1] });
      expect(res.status).toBe(400);
    });

    test('200 — merge exécuté', async () => {
      mockRunManager.mergeRunCases.mockResolvedValue({ added: 2, preserved: 1 });
      const res = await request(app).post('/api/runs/42/merge').send({ caseIds: [1, 2, 3] });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true, data: { added: 2 } });
    });
  });
  ```

- [ ] **Step 2 : Vérifier que les tests échouent**

  ```bash
  cd backend && npx jest tests/routes/run-manager.routes.test.js --no-coverage 2>&1 | tail -8
  ```
  Attendu : `FAIL` — routes 404

- [ ] **Step 3 : Implémenter les 5 nouveaux endpoints**

  Remplacer le contenu de `backend/routes/runs.routes.js` :

  ```js
  const express = require('express');
  const router = express.Router();
  const testmoService = require('../services/testmo.service');
  const runManager = require('../services/run-manager.service');
  const logger = require('../services/logger.service');
  const {
    validateParams,
    validateBody,
    validateQuery,
    runIdParam,
    folderCasesQuery,
    projectRunsQuery,
    createRunBody,
    mergeBody,
  } = require('../validators');

  // ── Routes statiques (AVANT /:runId) ──────────────────────────────────────

  router.get('/folder-cases', validateQuery(folderCasesQuery), async (req, res) => {
    try {
      const { syncProjectId, iterationName } = req.query;
      const data = await runManager.getFolderCases(syncProjectId, iterationName);
      res.json({ success: true, data, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Erreur GET /api/runs/folder-cases:', error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  router.get('/project-runs', validateQuery(projectRunsQuery), async (req, res) => {
    try {
      const { syncProjectId, activeOnly = 'true' } = req.query;
      const runs = await runManager.getProjectRunsList(syncProjectId, activeOnly === 'true');
      res.json({ success: true, data: runs, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Erreur GET /api/runs/project-runs:', error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  router.post('/', validateBody(createRunBody), async (req, res) => {
    try {
      const { syncProjectId, name, caseIds, milestoneId } = req.body;
      const run = await runManager.createRunFromCases(syncProjectId, name, caseIds, milestoneId);
      res.json({ success: true, data: run, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Erreur POST /api/runs:', error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  // ── Routes paramétrées ────────────────────────────────────────────────────

  router.get('/:runId', validateParams(runIdParam), async (req, res) => {
    try {
      const runId = parseInt(req.params.runId);
      const runDetails = await testmoService.getRunDetails(runId);
      res.json({ success: true, data: runDetails, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur GET /api/runs/${req.params.runId}:`, error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  router.get('/:runId/results', validateParams(runIdParam), async (req, res) => {
    try {
      const runId = parseInt(req.params.runId);
      const statusFilter = req.query.status;
      const results = await testmoService.getRunResults(runId, statusFilter);
      res.json({ success: true, data: results, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur GET /api/runs/${req.params.runId}/results:`, error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  router.post('/:runId/merge-preview', validateParams(runIdParam), validateBody(mergeBody), async (req, res) => {
    try {
      const runId = parseInt(req.params.runId);
      const { caseIds } = req.body;
      const existingResults = await testmoService.getAllRunResults(runId);
      const preview = runManager.computeMergePreview(existingResults, caseIds);
      res.json({ success: true, data: preview, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur POST /api/runs/${req.params.runId}/merge-preview:`, error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  router.post('/:runId/merge', validateParams(runIdParam), validateBody(mergeBody), async (req, res) => {
    try {
      const runId = parseInt(req.params.runId);
      const { caseIds } = req.body;
      const result = await runManager.mergeRunCases(runId, caseIds);
      res.json({ success: true, data: result, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur POST /api/runs/${req.params.runId}/merge:`, error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  });

  module.exports = router;
  ```

- [ ] **Step 4 : Vérifier que tous les tests runs passent**

  ```bash
  cd backend && npx jest tests/routes/runs.routes.test.js tests/routes/run-manager.routes.test.js --no-coverage 2>&1 | tail -10
  ```
  Attendu : `PASS` — tous les tests verts

- [ ] **Step 5 : Suite complète verte**

  ```bash
  cd backend && npx jest --no-coverage 2>&1 | tail -5
  ```
  Attendu : toutes les suites vertes, aucune régression

- [ ] **Step 6 : Commit**

  ```bash
  git add backend/routes/runs.routes.js backend/tests/routes/run-manager.routes.test.js
  git commit -m "feat(routes/runs): 5 nouveaux endpoints run manager avec tests"
  ```

---

## Task 5 — API service frontend : 5 nouvelles méthodes

**Files:**
- Modify: `frontend/src/services/api.service.js`

- [ ] **Step 1 : Ajouter les méthodes après la section Dashboard 8**

  Dans `api.service.js`, avant `_handleError`, insérer la section :

  ```js
  // ---- Run Manager -------------------------------------------------------

  async getFolderCases(syncProjectId, iterationName) {
    try {
      const response = await apiClient.get('/runs/folder-cases', {
        params: { syncProjectId, iterationName },
      });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Folder Cases', error);
    }
  },

  async getProjectRunsList(syncProjectId, activeOnly = true) {
    try {
      const response = await apiClient.get('/runs/project-runs', {
        params: { syncProjectId, activeOnly: String(activeOnly) },
      });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Project Runs List', error);
    }
  },

  async createTestRun(syncProjectId, name, caseIds, milestoneId = null) {
    try {
      const body = { syncProjectId, name, caseIds };
      if (milestoneId) body.milestoneId = milestoneId;
      const response = await apiClient.post('/runs', body);
      return response.data.data;
    } catch (error) {
      throw this._handleError('Create Test Run', error);
    }
  },

  async getRunMergePreview(runId, caseIds) {
    try {
      const response = await apiClient.post(`/runs/${runId}/merge-preview`, { caseIds });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Run Merge Preview', error);
    }
  },

  async mergeRunCases(runId, caseIds) {
    try {
      const response = await apiClient.post(`/runs/${runId}/merge`, { caseIds });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Merge Run Cases', error);
    }
  },

  // ---- Fin Run Manager ---------------------------------------------------
  ```

- [ ] **Step 2 : Commit**

  ```bash
  git add frontend/src/services/api.service.js
  git commit -m "feat(api): 5 méthodes run manager côté frontend"
  ```

---

## Task 6 — RunActionPanel.jsx : composant partagé

**Files:**
- Create: `frontend/src/components/RunActionPanel.jsx`
- Create: `frontend/src/styles/RunActionPanel.css`

Ce composant est utilisé par Dashboard6 (Option A) et Dashboard9 (Option B).

**Props :**
- `syncProjectId` (string) — ex: `'neo-pilot'`
- `iterationName` (string) — ex: `'R14 - run 1'`
- `isDark` (bool)
- `onDone` (function, optionnel) — callback après create/merge réussi

**Machine d'états interne :**
```
idle → loading_cases → cases_loaded → checking_runs
                                           ↓
                              no_run_found   run_found (runId sélectionné)
                                   ↓              ↓
                           confirm_create    confirm_merge (preview chargé)
                                   ↓              ↓
                              creating          merging
                                   ↓              ↓
                                done            done
```

- [ ] **Step 1 : Créer `RunActionPanel.css`**

  Créer `frontend/src/styles/RunActionPanel.css` :

  ```css
  .rap-root { margin-top: 24px; padding: 20px; border-radius: 10px; background: var(--card-bg); border: 1px solid var(--border-color); }
  .rap-root.dark { --card-bg: #1e2736; --border-color: #2d3748; --text-color: #e2e8f0; --text-secondary: #94a3b8; }
  .rap-title { display: flex; align-items: center; gap: 8px; font-size: 1rem; font-weight: 600; color: var(--text-color); margin-bottom: 16px; }
  .rap-hint { font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 12px; }
  .rap-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .rap-btn-primary { padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; background: #3b82f6; color: white; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
  .rap-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .rap-btn-secondary { padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border-color); cursor: pointer; background: transparent; color: var(--text-color); font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
  .rap-btn-ghost { background: none; border: none; cursor: pointer; color: var(--text-secondary); font-size: 0.85rem; padding: 4px 8px; }
  .rap-error { color: #ef4444; font-size: 0.85rem; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
  .rap-success { color: #10b981; font-size: 0.9rem; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
  .rap-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .rap-modal { background: var(--card-bg, #fff); border-radius: 12px; padding: 24px; max-width: 480px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
  .rap-modal h3 { margin: 0 0 16px; font-size: 1.1rem; color: var(--text-color, #111); }
  .rap-modal-stats { display: grid; gap: 8px; margin-bottom: 20px; }
  .rap-stat-row { display: flex; justify-content: space-between; font-size: 0.9rem; padding: 6px 10px; border-radius: 6px; }
  .rap-stat-add { background: #dcfce7; color: #166534; }
  .rap-stat-preserve { background: #dbeafe; color: #1e40af; }
  .rap-stat-tested { background: #fef3c7; color: #92400e; }
  .rap-stat-extra { background: #f1f5f9; color: #475569; }
  .rap-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .rap-run-select { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-color); font-size: 0.9rem; margin-bottom: 12px; }
  .rap-run-name-input { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-color); font-size: 0.9rem; margin-bottom: 12px; box-sizing: border-box; }
  ```

- [ ] **Step 2 : Créer `RunActionPanel.jsx`**

  Créer `frontend/src/components/RunActionPanel.jsx` :

  ```jsx
  import React, { useState, useEffect, useCallback } from 'react';
  import { PlayCircle, RefreshCw, CheckCircle2, XCircle, AlertCircle, GitMerge, Plus } from 'lucide-react';
  import apiService from '../services/api.service';
  import '../styles/RunActionPanel.css';

  export default function RunActionPanel({ syncProjectId, iterationName, isDark, onDone }) {
    const [phase, setPhase]             = useState('idle');
    // idle | loading_cases | cases_loaded | checking_runs | no_run | run_found
    // | confirm_create | confirm_merge | creating | merging | done | error
    const [caseIds, setCaseIds]         = useState([]);
    const [runs, setRuns]               = useState([]);
    const [selectedRunId, setSelectedRunId] = useState('');
    const [runName, setRunName]         = useState('');
    const [preview, setPreview]         = useState(null);
    const [result, setResult]           = useState(null);
    const [errorMsg, setErrorMsg]       = useState('');

    const defaultRunName = iterationName
      ? `Run — ${iterationName} — ${new Date().toLocaleDateString('fr-FR')}`
      : '';

    const reset = () => {
      setPhase('idle');
      setCaseIds([]);
      setRuns([]);
      setSelectedRunId('');
      setRunName('');
      setPreview(null);
      setResult(null);
      setErrorMsg('');
    };

    const handleStart = useCallback(async () => {
      setErrorMsg('');
      setPhase('loading_cases');
      try {
        const data = await apiService.getFolderCases(syncProjectId, iterationName);
        setCaseIds(data.caseIds);
        setPhase('checking_runs');
        const runsList = await apiService.getProjectRunsList(syncProjectId, true);
        setRuns(runsList);
        setPhase(runsList.length > 0 ? 'run_found' : 'no_run');
        setRunName(defaultRunName);
      } catch (err) {
        setErrorMsg(err.message);
        setPhase('error');
      }
    }, [syncProjectId, iterationName, defaultRunName]);

    const handleConfirmCreate = async () => {
      setPhase('confirm_create');
    };

    const handleCreate = async () => {
      setPhase('creating');
      try {
        const created = await apiService.createTestRun(syncProjectId, runName, caseIds);
        setResult({ type: 'created', run: created });
        setPhase('done');
        onDone?.({ type: 'created', run: created });
      } catch (err) {
        setErrorMsg(err.message);
        setPhase('error');
      }
    };

    const handleLoadMergePreview = async () => {
      if (!selectedRunId) return;
      setPhase('loading_preview');
      try {
        const p = await apiService.getRunMergePreview(parseInt(selectedRunId), caseIds);
        setPreview(p);
        setPhase('confirm_merge');
      } catch (err) {
        setErrorMsg(err.message);
        setPhase('error');
      }
    };

    const handleMerge = async () => {
      setPhase('merging');
      try {
        const res = await apiService.mergeRunCases(parseInt(selectedRunId), caseIds);
        setResult({ type: 'merged', ...res });
        setPhase('done');
        onDone?.({ type: 'merged', ...res });
      } catch (err) {
        setErrorMsg(err.message);
        setPhase('error');
      }
    };

    if (!syncProjectId || !iterationName) return null;

    return (
      <div className={`rap-root${isDark ? ' dark' : ''}`}>
        <div className="rap-title">
          <GitMerge size={18} />
          Étape suivante — Gestion du run de test
        </div>

        {phase === 'idle' && (
          <>
            <p className="rap-hint">
              Sync terminée pour <strong>{iterationName}</strong>. Créez ou mettez à jour un run Testmo avec les cas synchronisés.
            </p>
            <div className="rap-actions">
              <button className="rap-btn-primary" onClick={handleStart}>
                <PlayCircle size={15} /> Préparer le run
              </button>
            </div>
          </>
        )}

        {(phase === 'loading_cases' || phase === 'checking_runs' || phase === 'loading_preview') && (
          <p className="rap-hint"><RefreshCw size={14} className="spinning" style={{ display:'inline' }} /> {
            phase === 'loading_cases' ? 'Récupération des cas Testmo…' :
            phase === 'checking_runs' ? 'Vérification des runs existants…' :
            'Calcul du preview de merge…'
          }</p>
        )}

        {phase === 'no_run' && (
          <>
            <p className="rap-hint">Aucun run actif trouvé. <strong>{caseIds.length} cas</strong> prêts à inclure.</p>
            <div className="rap-actions">
              <button className="rap-btn-primary" onClick={handleConfirmCreate}>
                <Plus size={15} /> Créer le run de test
              </button>
              <button className="rap-btn-ghost" onClick={reset}>Annuler</button>
            </div>
          </>
        )}

        {phase === 'run_found' && (
          <>
            <p className="rap-hint"><strong>{caseIds.length} cas</strong> récupérés. Choisissez un run à mettre à jour ou créez-en un nouveau.</p>
            <select
              className="rap-run-select"
              value={selectedRunId}
              onChange={e => setSelectedRunId(e.target.value)}
            >
              <option value="">— Sélectionner un run existant —</option>
              {runs.map(r => (
                <option key={r.id} value={r.id}>#{r.id} — {r.name}</option>
              ))}
            </select>
            <div className="rap-actions">
              {selectedRunId && (
                <button className="rap-btn-primary" onClick={handleLoadMergePreview}>
                  <GitMerge size={15} /> Mettre à jour ce run
                </button>
              )}
              <button className="rap-btn-secondary" onClick={handleConfirmCreate}>
                <Plus size={15} /> Créer un nouveau run
              </button>
              <button className="rap-btn-ghost" onClick={reset}>Annuler</button>
            </div>
          </>
        )}

        {phase === 'confirm_create' && (
          <div className="rap-modal-overlay">
            <div className="rap-modal">
              <h3>Créer le run de test</h3>
              <input
                className="rap-run-name-input"
                type="text"
                value={runName}
                onChange={e => setRunName(e.target.value)}
                placeholder="Nom du run…"
              />
              <div className="rap-modal-stats">
                <div className="rap-stat-row rap-stat-add">
                  <span>Cas à inclure</span><strong>{caseIds.length}</strong>
                </div>
              </div>
              <div className="rap-modal-actions">
                <button className="rap-btn-ghost" onClick={() => setPhase(runs.length > 0 ? 'run_found' : 'no_run')}>Annuler</button>
                <button className="rap-btn-primary" onClick={handleCreate} disabled={!runName.trim()}>
                  <Plus size={14} /> Créer
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'confirm_merge' && preview && (
          <div className="rap-modal-overlay">
            <div className="rap-modal">
              <h3>Mise à jour du run #{selectedRunId}</h3>
              <div className="rap-modal-stats">
                <div className="rap-stat-row rap-stat-add">
                  <span>Nouveaux cas à ajouter</span><strong>{preview.toAdd.length}</strong>
                </div>
                <div className="rap-stat-row rap-stat-tested">
                  <span>Cas déjà testés (préservés)</span><strong>{preview.testedInRun.length}</strong>
                </div>
                <div className="rap-stat-row rap-stat-preserve">
                  <span>Cas dans le run, vierges</span><strong>{preview.pristineInRun.length}</strong>
                </div>
                {preview.inRunNotInSync.length > 0 && (
                  <div className="rap-stat-row rap-stat-extra">
                    <span>Cas dans le run absents du sync</span><strong>{preview.inRunNotInSync.length}</strong>
                  </div>
                )}
              </div>
              <div className="rap-modal-actions">
                <button className="rap-btn-ghost" onClick={() => setPhase('run_found')}>Annuler</button>
                <button
                  className="rap-btn-primary"
                  onClick={handleMerge}
                  disabled={preview.toAdd.length === 0}
                >
                  <GitMerge size={14} />
                  {preview.toAdd.length === 0 ? 'Rien à ajouter' : 'Mettre à jour'}
                </button>
              </div>
            </div>
          </div>
        )}

        {(phase === 'creating' || phase === 'merging') && (
          <p className="rap-hint"><RefreshCw size={14} className="spinning" style={{ display:'inline' }} /> {phase === 'creating' ? 'Création du run…' : 'Mise à jour du run…'}</p>
        )}

        {phase === 'done' && result && (
          <div className="rap-success">
            <CheckCircle2 size={16} />
            {result.type === 'created'
              ? `Run #${result.run?.id} créé avec ${caseIds.length} cas.`
              : `Run mis à jour — ${result.added} cas ajoutés, ${result.preserved} préservés.`}
            <button className="rap-btn-ghost" onClick={reset}>Recommencer</button>
          </div>
        )}

        {phase === 'error' && (
          <div className="rap-error">
            <AlertCircle size={16} /> {errorMsg}
            <button className="rap-btn-ghost" onClick={reset}>Réessayer</button>
          </div>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3 : Commit**

  ```bash
  git add frontend/src/components/RunActionPanel.jsx frontend/src/styles/RunActionPanel.css
  git commit -m "feat(ui): RunActionPanel — machine d'états create/merge avec modal preview"
  ```

---

## Task 7 — Dashboard6 : Option A (intégration post-sync)

**Files:**
- Modify: `frontend/src/components/Dashboard6.jsx`

Dashboard6 passe à `state === 'done'` après la sync. Il faut afficher `RunActionPanel` sous les stats de résultat.

- [ ] **Step 1 : Ajouter l'import de RunActionPanel**

  En haut de `Dashboard6.jsx`, après les autres imports :

  ```js
  import RunActionPanel from './RunActionPanel';
  ```

- [ ] **Step 2 : Localiser le bloc `state === 'done'` dans le JSX de Dashboard6**

  Dans le rendu (chercher `finalStats` ou `state === 'done'`), trouver la zone où le résultat final est affiché. Sous les stats de résultat (après le bloc `finalStats`), ajouter :

  ```jsx
  {state === 'done' && selectedProject && selectedIter && (
    <RunActionPanel
      syncProjectId={selectedProject}
      iterationName={selectedIter}
      isDark={isDark}
      onDone={(res) => {
        // Optionnel : afficher un toast ou rien
      }}
    />
  )}
  ```

  > `selectedProject` est le state de Dashboard6 contenant l'ID du projet sync (ex: `'neo-pilot'`).
  > `selectedIter` est le state contenant le nom de l'itération (ex: `'R14 - run 1'`).

- [ ] **Step 3 : Vérifier visuellement**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/frontend && npm run dev 2>&1 &
  ```
  Naviguer vers `http://localhost:3000` → Dashboard "Sync GitLab → Testmo" → effectuer une sync → vérifier que le panneau apparaît sous les stats.

- [ ] **Step 4 : Commit**

  ```bash
  git add frontend/src/components/Dashboard6.jsx
  git commit -m "feat(d6): Option A — RunActionPanel post-sync intégré"
  ```

---

## Task 8 — Dashboard9 : Option B (gestionnaire autonome)

**Files:**
- Create: `frontend/src/components/Dashboard9.jsx`
- Create: `frontend/src/styles/Dashboard9.css`

- [ ] **Step 1 : Créer `Dashboard9.css`**

  Créer `frontend/src/styles/Dashboard9.css` :

  ```css
  .d9-root { padding: 24px; max-width: 900px; margin: 0 auto; }
  .d9-root.dark { color: #e2e8f0; }
  .d9-header { margin-bottom: 24px; }
  .d9-header h2 { font-size: 1.4rem; font-weight: 700; display: flex; align-items: center; gap: 10px; }
  .d9-header p { font-size: 0.9rem; color: var(--text-secondary, #64748b); margin-top: 4px; }
  .d9-card { background: var(--card-bg, #fff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .d9-card.dark { background: #1e2736; border-color: #2d3748; }
  .d9-card-title { font-size: 0.9rem; font-weight: 600; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; color: var(--text-color); }
  .d9-form-group { margin-bottom: 12px; }
  .d9-form-group label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 4px; color: var(--text-secondary, #64748b); }
  .d9-select, .d9-input { width: 100%; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color, #e2e8f0); background: var(--card-bg, #fff); color: var(--text-color); font-size: 0.9rem; box-sizing: border-box; }
  .d9-btn-primary { padding: 9px 18px; border-radius: 6px; border: none; cursor: pointer; background: #3b82f6; color: white; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
  .d9-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  ```

- [ ] **Step 2 : Créer `Dashboard9.jsx`**

  Créer `frontend/src/components/Dashboard9.jsx` :

  ```jsx
  import React, { useState, useEffect } from 'react';
  import { Layers, Settings2 } from 'lucide-react';
  import apiService from '../services/api.service';
  import RunActionPanel from './RunActionPanel';
  import '../styles/Dashboard9.css';

  const PROJECTS = [
    { id: 'neo-pilot',    label: 'Neo-Pilot' },
    { id: 'workshop-web', label: 'Workshop Web' },
    { id: 'workshop',     label: 'Workshop' },
    { id: 'link',         label: 'Link' },
  ];

  export default function Dashboard9({ isDark }) {
    const [syncProjectId, setSyncProjectId] = useState('neo-pilot');
    const [iterationName, setIterationName] = useState('');
    const [showPanel, setShowPanel]         = useState(false);
    const [panelKey, setPanelKey]           = useState(0); // force remount on new search

    const handleSearch = () => {
      if (!iterationName.trim()) return;
      setShowPanel(false);
      setTimeout(() => {
        setShowPanel(true);
        setPanelKey(k => k + 1);
      }, 0);
    };

    return (
      <div className={`d9-root${isDark ? ' dark' : ''}`}>
        <div className="d9-header">
          <h2><Layers size={22} /> Gestionnaire de Runs</h2>
          <p>Créez ou mettez à jour un run Testmo à partir d'un dossier d'itération existant</p>
        </div>

        <div className={`d9-card${isDark ? ' dark' : ''}`}>
          <div className="d9-card-title"><Settings2 size={16} /> Paramètres</div>

          <div className="d9-form-group">
            <label>Projet</label>
            <select
              className="d9-select"
              value={syncProjectId}
              onChange={e => { setSyncProjectId(e.target.value); setShowPanel(false); }}
            >
              {PROJECTS.map(p => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div className="d9-form-group">
            <label>Nom de l'itération (= nom du dossier Testmo)</label>
            <input
              className="d9-input"
              type="text"
              value={iterationName}
              placeholder="ex : R14 - run 1"
              onChange={e => { setIterationName(e.target.value); setShowPanel(false); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>

          <button
            className="d9-btn-primary"
            onClick={handleSearch}
            disabled={!iterationName.trim()}
          >
            Charger les cas
          </button>
        </div>

        {showPanel && (
          <RunActionPanel
            key={panelKey}
            syncProjectId={syncProjectId}
            iterationName={iterationName.trim()}
            isDark={isDark}
            onDone={() => {
              setShowPanel(false);
              setIterationName('');
            }}
          />
        )}
      </div>
    );
  }
  ```

- [ ] **Step 3 : Commit**

  ```bash
  git add frontend/src/components/Dashboard9.jsx frontend/src/styles/Dashboard9.css
  git commit -m "feat(d9): Option B — Dashboard9 gestionnaire de runs autonome"
  ```

---

## Task 9 — App.jsx : route Dashboard9

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1 : Ajouter le lazy import**

  Après la ligne `const Dashboard8 = lazy(...)` (ligne 19), ajouter :

  ```js
  const Dashboard9 = lazy(() => import('./components/Dashboard9'));
  ```

- [ ] **Step 2 : Ajouter l'entrée dans VIEW_TO_ROUTE**

  Dans `VIEW_TO_ROUTE`, après `'9': '/autosync'`, ajouter :

  ```js
  '10': '/runs/manage',
  ```

- [ ] **Step 3 : Ajouter l'option dans le select de navigation**

  Dans le `<select>` de navigation (après l'option value="9"), ajouter :

  ```jsx
  <option value="10">🧪 Gestionnaire de Runs</option>
  ```

- [ ] **Step 4 : Ajouter la route**

  Dans le bloc `<Routes>`, après la route `/autosync`, ajouter :

  ```jsx
  <Route path="/runs/manage" element={
    <Dashboard9 isDark={darkMode} />
  } />
  ```

- [ ] **Step 5 : Vérifier la navigation**

  Ouvrir `http://localhost:3000`, sélectionner "Gestionnaire de Runs" dans le dropdown → page chargée. Entrer un nom d'itération → panneau RunActionPanel affiché.

- [ ] **Step 6 : Commit final**

  ```bash
  git add frontend/src/App.jsx
  git commit -m "feat(app): route /runs/manage → Dashboard9 (Option B Run Manager)"
  ```

---

## Self-Review

### Couverture spec
| Exigence | Tâche |
|----------|-------|
| Créer un run post-sync | T4 POST /api/runs + T7 Option A + T8 Option B |
| Mettre à jour run existant | T4 POST /:runId/merge |
| Préserver cas testés (status, elapsed, comment, steps) | T2 isResultPristine + T3 computeMergePreview |
| Preview avant action | T4 POST /:runId/merge-preview + T6 modal |
| Machine d'états UI (idle→done) | T6 RunActionPanel |
| Option A : intégré dans sync flow | T7 Dashboard6 |
| Option B : page autonome | T8 Dashboard9 + T9 App.jsx |

### Aucun placeholder — vérification
- Tout le code est complet dans chaque step
- Les noms de méthodes sont cohérents entre tasks : `mergeRunCases` (T2 service, T4 route, T5 apiService, T6 panel)
- `computeMergePreview` exporté de run-manager.service.js, utilisé dans T4 route ET T6 via api + testé en T2
- `isResultPristine` exporté et testé unitairement en T2

### Types cohérents
- `caseIds` toujours `number[]` (validé Zod en T3)
- `syncProjectId` toujours `string` (ex: `'neo-pilot'`)
- `runId` toujours `number` (parseInt dans routes)
- `getAllRunResults` retourne `result.case_id` — **à vérifier** : le champ exact peut être `case_id` ou `testcase_id` selon la version Testmo. Adapter si besoin dans `computeMergePreview`.

---

**Plan sauvegardé dans `docs/superpowers/plans/2026-04-30-run-manager.md`.**

**Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — Sous-agent dédié par tâche, review entre chaque tâche.

**2. Inline Execution** — Exécution dans cette session avec points de contrôle.

**Quelle approche ?**
