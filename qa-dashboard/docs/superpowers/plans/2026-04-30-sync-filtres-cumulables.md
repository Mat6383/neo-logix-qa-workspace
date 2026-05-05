# Filtres Cumulables Dashboard6 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les 4 critères de sync (Iteration, Status Work Item, Version Prod, Version de test) optionnels et cumulables dans Dashboard6, avec des sélecteurs dynamiques alimentés par l'API GitLab.

**Architecture:** Une méthode GraphQL unifiée `getIssuesByFilters` remplace les 3 méthodes spécialisées existantes. Les filtres actifs sont combinés en AND localement après une seule requête GraphQL par batch de 50. Un champ `folderName` explicite (auto-rempli depuis l'itération) décorrèle le nom du dossier Testmo du filtre d'itération.

**Tech Stack:** Express/Node.js, Zod, Jest, supertest, React 18, lucide-react

---

## Map des fichiers

### Modifiés
| Fichier | Ce qui change |
|---------|--------------|
| `backend/services/gitlab.service.js` | +3 méthodes : `getIssuesByFilters`, `getAvailableStatuses`, `getCustomFieldValues` |
| `backend/validators/index.js` | `syncPreviewBody` et `syncExecuteBody` → nouveau `syncFiltersBody` (iterationName optionnel, +folderName +statusGid +versionProd +versionTest) |
| `backend/routes/sync.routes.js` | +2 endpoints : `GET /:projectId/statuses`, `GET /:projectId/field-values` |
| `backend/controllers/sync.controller.js` | Passe `folderName` + `filters` aux services ; +2 handlers |
| `backend/services/sync.service.js` | `syncIteration` + `previewIteration` acceptent `(folderName, filters, options, onEvent)` |
| `backend/tests/routes/sync.routes.test.js` | Mise à jour tests preview/execute (iterationName optionnel) + 4 nouveaux tests |
| `frontend/src/services/api.service.js` | +2 méthodes : `getSyncStatuses`, `getSyncFieldValues` |
| `frontend/src/components/Dashboard6.jsx` | +3 sélecteurs (Status, Version Prod, Version de test) + champ folderName |

### Créés
| Fichier | Rôle |
|---------|------|
| `backend/tests/gitlab.service.filters.test.js` | Tests unitaires de `getIssuesByFilters` avec mocks GraphQL |

---

## Règle clé : signature `syncFiltersBody`

```
{
  projectId   : string   (requis)
  folderName  : string   (requis — nom du dossier Testmo)
  iterationName?: string (optionnel)
  statusGid?  : string   (optionnel — ex: "gid://gitlab/WorkItems::Statuses::Custom::Status/15")
  versionProd?: string   (optionnel — ex: "R06 - Pilot")
  versionTest?: string   (optionnel)
}
.refine(au moins un de iterationName|statusGid|versionProd|versionTest fourni)
```

---

## Task 1 — `getIssuesByFilters` dans gitlab.service.js (TDD)

**Files:**
- Modify: `backend/services/gitlab.service.js`
- Create: `backend/tests/gitlab.service.filters.test.js`

- [ ] **Step 1 : Écrire les tests en premier**

  Créer `backend/tests/gitlab.service.filters.test.js` :

  ```js
  'use strict';

  // On mock les méthodes réseau du service sans toucher à la classe
  const gitlab = require('../services/gitlab.service');

  beforeEach(() => {
    jest.spyOn(gitlab, '_getPaginated').mockResolvedValue([]);
    jest.spyOn(gitlab, 'getIssuesForIteration').mockResolvedValue([]);
    jest.spyOn(gitlab, 'executeGraphQL').mockResolvedValue({});
    jest.spyOn(gitlab, '_delay').mockResolvedValue();
  });

  afterEach(() => jest.restoreAllMocks());

  const makeIssue = (id) => ({ id, iid: id, title: `Issue ${id}` });

  const makeGraphQLData = (issues, overrides = {}) => {
    const data = {};
    for (const iss of issues) {
      data[`wi_${iss.id}`] = {
        id: `gid://gitlab/WorkItem/${iss.id}`,
        widgets: [
          { type: 'STATUS', status: { id: overrides[iss.id]?.statusGid || null } },
          {
            customFieldValues: [
              {
                customField: { name: 'Version Prod' },
                selectedOptions: [{ value: overrides[iss.id]?.versionProd || null }],
              },
              {
                customField: { name: 'Version de test' },
                selectedOptions: [{ value: overrides[iss.id]?.versionTest || null }],
              },
            ],
          },
        ],
      };
    }
    return data;
  };

  describe('getIssuesByFilters', () => {
    test('sans filtre GraphQL — retourne issues REST brutes', async () => {
      const issues = [makeIssue(1), makeIssue(2)];
      gitlab._getPaginated.mockResolvedValue(issues);

      const result = await gitlab.getIssuesByFilters(63, {});

      expect(gitlab.executeGraphQL).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    test('avec iterationId — utilise getIssuesForIteration', async () => {
      const issues = [makeIssue(1)];
      gitlab.getIssuesForIteration.mockResolvedValue(issues);
      gitlab.executeGraphQL.mockResolvedValue(makeGraphQLData(issues, {
        1: { statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15' },
      }));

      const result = await gitlab.getIssuesByFilters(63, {
        iterationId: 42,
        statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15',
      });

      expect(gitlab.getIssuesForIteration).toHaveBeenCalledWith(63, 42);
      expect(result).toHaveLength(1);
    });

    test('filtre statusGid — exclut les issues sans le bon statut', async () => {
      const issues = [makeIssue(1), makeIssue(2)];
      gitlab._getPaginated.mockResolvedValue(issues);
      gitlab.executeGraphQL.mockResolvedValue(makeGraphQLData(issues, {
        1: { statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15' },
        2: { statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/99' },
      }));

      const result = await gitlab.getIssuesByFilters(63, {
        statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    test('filtre versionProd — exclut les issues sans la bonne version', async () => {
      const issues = [makeIssue(10), makeIssue(11)];
      gitlab._getPaginated.mockResolvedValue(issues);
      gitlab.executeGraphQL.mockResolvedValue(makeGraphQLData(issues, {
        10: { versionProd: 'R06 - Pilot' },
        11: { versionProd: 'R07 - Prod' },
      }));

      const result = await gitlab.getIssuesByFilters(63, { versionProd: 'R06 - Pilot' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
    });

    test('filtre versionTest — exclut les issues sans la bonne version de test', async () => {
      const issues = [makeIssue(20), makeIssue(21)];
      gitlab._getPaginated.mockResolvedValue(issues);
      gitlab.executeGraphQL.mockResolvedValue(makeGraphQLData(issues, {
        20: { versionTest: 'Sprint-A' },
        21: { versionTest: null },
      }));

      const result = await gitlab.getIssuesByFilters(63, { versionTest: 'Sprint-A' });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(20);
    });

    test('3 filtres cumulés en AND — garde seulement les issues qui matchent tout', async () => {
      const issues = [makeIssue(30), makeIssue(31), makeIssue(32)];
      gitlab._getPaginated.mockResolvedValue(issues);
      const STATUS = 'gid://gitlab/WorkItems::Statuses::Custom::Status/15';
      gitlab.executeGraphQL.mockResolvedValue(makeGraphQLData(issues, {
        30: { statusGid: STATUS, versionProd: 'R06 - Pilot', versionTest: 'Sprint-A' },
        31: { statusGid: STATUS, versionProd: 'R06 - Pilot', versionTest: null },
        32: { statusGid: STATUS, versionProd: 'R07 - Prod',  versionTest: 'Sprint-A' },
      }));

      const result = await gitlab.getIssuesByFilters(63, {
        statusGid: STATUS,
        versionProd: 'R06 - Pilot',
        versionTest: 'Sprint-A',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(30);
    });

    test('aucune issue REST — pas d'appel GraphQL', async () => {
      gitlab._getPaginated.mockResolvedValue([]);

      const result = await gitlab.getIssuesByFilters(63, { statusGid: 'anything' });

      expect(gitlab.executeGraphQL).not.toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 2 : Vérifier que les tests échouent**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend
  npx jest tests/gitlab.service.filters.test.js --no-coverage 2>&1 | tail -5
  ```
  Attendu : FAIL — `TypeError: gitlab.getIssuesByFilters is not a function`

- [ ] **Step 3 : Implémenter `getIssuesByFilters` dans gitlab.service.js**

  Dans `backend/services/gitlab.service.js`, après la méthode `getIssuesByVersionOnly` (ligne ~709), avant `formatEstimate`, ajouter :

  ```js
  /**
   * Récupère les issues d'un projet en appliquant jusqu'à 4 filtres optionnels en AND.
   * Remplace les méthodes spécialisées (getIssuesByStatusAndIteration, etc.).
   *
   * @param {number|string} projectId
   * @param {Object} filters
   * @param {number}  [filters.iterationId]  - REST numeric ID (pré-résolu)
   * @param {string}  [filters.statusGid]    - GID du Work Item status
   * @param {string}  [filters.versionProd]  - Valeur "Version Prod"
   * @param {string}  [filters.versionTest]  - Valeur "Version de test"
   * @returns {Array} Issues correspondant à tous les filtres actifs
   */
  async getIssuesByFilters(projectId, filters = {}) {
    const { iterationId, statusGid, versionProd, versionTest } = filters;

    // 1. Récupération REST (filtrée par itération si fournie)
    let allIssues;
    if (iterationId) {
      allIssues = await this.getIssuesForIteration(projectId, iterationId);
    } else {
      allIssues = await this._getPaginated(`/projects/${projectId}/issues`, {
        state: 'all',
        scope: 'all',
      });
    }
    if (!allIssues.length) return [];

    // 2. Si aucun filtre GraphQL actif, on retourne les issues REST brutes
    const needsGraphQL = statusGid || versionProd || versionTest;
    if (!needsGraphQL) return allIssues;

    // 3. Une requête GraphQL par batch de 50 (alias approach — compatible GitLab self-hosted)
    const CHUNK_SIZE = 50;
    const infoByGid = new Map();

    for (let i = 0; i < allIssues.length; i += CHUNK_SIZE) {
      const chunk = allIssues.slice(i, i + CHUNK_SIZE);
      const fields = `{
        id
        widgets {
          type
          ... on WorkItemWidgetStatus { status { id } }
          ... on WorkItemWidgetCustomFields {
            customFieldValues {
              customField { name }
              ... on WorkItemSelectFieldValue { selectedOptions { value } }
            }
          }
        }
      }`;
      const query = `query {\n${chunk
        .map((iss) => `  wi_${iss.id}: workItem(id: "gid://gitlab/WorkItem/${iss.id}") ${fields}`)
        .join('\n')}\n}`;

      const data = await this.executeGraphQL(query, {});

      for (const issue of chunk) {
        const node = data[`wi_${issue.id}`];
        if (!node) continue;
        const statusWidget = node.widgets?.find((w) => w.type === 'STATUS');
        const cfWidget = node.widgets?.find((w) => Array.isArray(w.customFieldValues));
        const cfValues = cfWidget?.customFieldValues || [];
        const getField = (name) =>
          cfValues.find((cf) => cf.customField?.name === name)?.selectedOptions?.[0]?.value || null;

        infoByGid.set(`gid://gitlab/WorkItem/${issue.id}`, {
          statusGid: statusWidget?.status?.id || null,
          versionProd: getField('Version Prod'),
          versionTest: getField('Version de test'),
        });
      }

      if (i + CHUNK_SIZE < allIssues.length) await this._delay();
    }

    // 4. Filtre local AND
    const filtered = allIssues.filter((issue) => {
      const gid = `gid://gitlab/WorkItem/${issue.id}`;
      const info = infoByGid.get(gid);
      if (!info) return false;
      if (statusGid && info.statusGid !== statusGid) return false;
      if (versionProd && info.versionProd !== versionProd) return false;
      if (versionTest && info.versionTest !== versionTest) return false;
      return true;
    });

    logger.info(
      `GitLab: getIssuesByFilters — ${filtered.length}/${allIssues.length} issues ` +
        `(project=${projectId}, iter=${!!iterationId}, status=${!!statusGid}, ` +
        `vProd=${versionProd || '-'}, vTest=${versionTest || '-'})`
    );
    return filtered;
  }
  ```

- [ ] **Step 4 : Vérifier que les tests passent**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend
  npx jest tests/gitlab.service.filters.test.js --no-coverage 2>&1 | tail -10
  ```
  Attendu : PASS — 6 tests verts

- [ ] **Step 5 : Suite complète verte**

  ```bash
  npx jest --no-coverage 2>&1 | tail -5
  ```
  Attendu : toutes suites vertes (473+ tests)

- [ ] **Step 6 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add backend/services/gitlab.service.js backend/tests/gitlab.service.filters.test.js
  git commit -m "feat(gitlab): getIssuesByFilters — 4 filtres optionnels cumulables en AND"
  ```

---

## Task 2 — `getAvailableStatuses` + `getCustomFieldValues` dans gitlab.service.js

**Files:**
- Modify: `backend/services/gitlab.service.js`

Ces méthodes alimentent les sélecteurs de Dashboard6. Elles échantillonnent les issues du projet pour découvrir les valeurs disponibles.

- [ ] **Step 1 : Ajouter `getAvailableStatuses(projectId)` après `getIssuesByFilters`**

  ```js
  /**
   * Découvre les statuts Work Item disponibles pour un projet
   * via un échantillon de 100 issues.
   *
   * @param {number|string} projectId
   * @returns {Array<{id: string, name: string}>}
   */
  async getAvailableStatuses(projectId) {
    try {
      const issues = await this._getPaginated(`/projects/${projectId}/issues`, {
        state: 'all',
        scope: 'all',
        per_page: 100,
      });
      if (!issues.length) return [];

      const CHUNK_SIZE = 50;
      const statusMap = new Map();
      const sample = issues.slice(0, 100);

      for (let i = 0; i < sample.length; i += CHUNK_SIZE) {
        const chunk = sample.slice(i, i + CHUNK_SIZE);
        const fields = `{ id widgets { type ... on WorkItemWidgetStatus { status { id name } } } }`;
        const query = `query {\n${chunk
          .map((iss) => `  wi_${iss.id}: workItem(id: "gid://gitlab/WorkItem/${iss.id}") ${fields}`)
          .join('\n')}\n}`;

        const data = await this.executeGraphQL(query, {});
        for (const issue of chunk) {
          const node = data[`wi_${issue.id}`];
          const sw = node?.widgets?.find((w) => w.type === 'STATUS');
          if (sw?.status?.id && sw?.status?.name) {
            statusMap.set(sw.status.id, sw.status.name);
          }
        }
        if (i + CHUNK_SIZE < sample.length) await this._delay();
      }

      const result = Array.from(statusMap.entries()).map(([id, name]) => ({ id, name }));
      logger.info(`GitLab: ${result.length} statut(s) Work Item pour project=${projectId}`);
      return result;
    } catch (error) {
      logger.error(`GitLab: Erreur getAvailableStatuses project=${projectId}:`, error.message);
      throw error;
    }
  }
  ```

- [ ] **Step 2 : Ajouter `getCustomFieldValues(projectId, fieldName)` après `getAvailableStatuses`**

  ```js
  /**
   * Découvre les valeurs distinctes d'un champ custom GitLab ("Version Prod", "Version de test")
   * via les work items du projet.
   *
   * @param {number|string} projectId
   * @param {string} fieldName - Ex: "Version Prod" ou "Version de test"
   * @returns {string[]} Valeurs distinctes triées alphabétiquement
   */
  async getCustomFieldValues(projectId, fieldName) {
    try {
      const issues = await this._getPaginated(`/projects/${projectId}/issues`, {
        state: 'all',
        scope: 'all',
      });
      if (!issues.length) return [];

      const CHUNK_SIZE = 50;
      const values = new Set();

      for (let i = 0; i < issues.length; i += CHUNK_SIZE) {
        const chunk = issues.slice(i, i + CHUNK_SIZE);
        const fields = `{ id widgets { ... on WorkItemWidgetCustomFields { customFieldValues { customField { name } ... on WorkItemSelectFieldValue { selectedOptions { value } } } } } }`;
        const query = `query {\n${chunk
          .map((iss) => `  wi_${iss.id}: workItem(id: "gid://gitlab/WorkItem/${iss.id}") ${fields}`)
          .join('\n')}\n}`;

        const data = await this.executeGraphQL(query, {});
        for (const issue of chunk) {
          const node = data[`wi_${issue.id}`];
          const cfWidget = node?.widgets?.find((w) => Array.isArray(w.customFieldValues));
          const field = cfWidget?.customFieldValues?.find(
            (cf) => cf.customField?.name === fieldName
          );
          const val = field?.selectedOptions?.[0]?.value;
          if (val) values.add(val);
        }
        if (i + CHUNK_SIZE < issues.length) await this._delay();
      }

      const result = Array.from(values).sort();
      logger.info(
        `GitLab: ${result.length} valeur(s) pour "${fieldName}" (project=${projectId})`
      );
      return result;
    } catch (error) {
      logger.error(
        `GitLab: Erreur getCustomFieldValues "${fieldName}" project=${projectId}:`,
        error.message
      );
      throw error;
    }
  }
  ```

- [ ] **Step 3 : Vérifier suite complète**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend && npx jest --no-coverage 2>&1 | tail -5
  ```
  Attendu : toutes suites vertes

- [ ] **Step 4 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add backend/services/gitlab.service.js
  git commit -m "feat(gitlab): getAvailableStatuses + getCustomFieldValues pour sélecteurs D6"
  ```

---

## Task 3 — Validators : nouveau `syncFiltersBody`

**Files:**
- Modify: `backend/validators/index.js`

- [ ] **Step 1 : Remplacer `syncPreviewBody` et `syncExecuteBody`**

  Dans `backend/validators/index.js`, **remplacer** les lignes :
  ```js
  const syncPreviewBody = z.object({
    projectId: z.string().min(1, '"projectId" requis'),
    iterationName: z.string().min(1, '"iterationName" requis'),
  });

  const syncExecuteBody = syncPreviewBody;
  ```

  Par :
  ```js
  const syncFiltersBody = z
    .object({
      projectId: z.string().min(1, '"projectId" requis'),
      folderName: z.string().min(1, '"folderName" requis (nom du dossier Testmo)'),
      iterationName: z.string().optional(),
      statusGid: z.string().optional(),
      versionProd: z.string().optional(),
      versionTest: z.string().optional(),
    })
    .refine(
      (data) => data.iterationName || data.statusGid || data.versionProd || data.versionTest,
      { message: 'Au moins un filtre requis : iterationName, statusGid, versionProd ou versionTest' }
    );

  const syncPreviewBody = syncFiltersBody;
  const syncExecuteBody = syncFiltersBody;
  ```

- [ ] **Step 2 : Ajouter `syncFiltersBody` dans `module.exports`**

  Dans `module.exports = { ... }`, ajouter `syncFiltersBody,` après `syncExecuteBody,`.

- [ ] **Step 3 : Vérifier les tests**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend && npx jest --no-coverage 2>&1 | tail -10
  ```
  Attendu : certains tests sync.routes vont échouer — c'est attendu, on les met à jour en Task 4.

- [ ] **Step 4 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add backend/validators/index.js
  git commit -m "feat(validators): syncFiltersBody — 4 filtres optionnels cumulables"
  ```

---

## Task 4 — sync.routes.js + sync.controller.js + sync.routes.test.js

**Files:**
- Modify: `backend/routes/sync.routes.js`
- Modify: `backend/controllers/sync.controller.js`
- Modify: `backend/tests/routes/sync.routes.test.js`

### 4a — 2 nouveaux endpoints dans sync.routes.js

- [ ] **Step 1 : Ajouter les imports dans sync.routes.js**

  Lire d'abord `backend/routes/sync.routes.js`. Ajouter dans la destructuration `require('../validators')` :
  ```js
  syncFiltersBody,
  ```

- [ ] **Step 2 : Ajouter les 2 routes dans sync.routes.js**

  Après `router.get('/:projectId/iterations', ...)`, ajouter :

  ```js
  router.get(
    '/:projectId/statuses',
    validateParams(syncProjectIdParam),
    getStatuses
  );
  router.get(
    '/:projectId/field-values',
    validateParams(syncProjectIdParam),
    validateQuery(z.object({ field: z.string().min(1, '"field" requis') })),
    getFieldValues
  );
  ```

  > `z` est déjà importé via `require('../validators')` qui exporte `z`.

- [ ] **Step 3 : Mettre à jour les imports dans le routeur**

  Dans la destructuration `require('../controllers/sync.controller')`, ajouter :
  ```js
  getStatuses,
  getFieldValues,
  ```

### 4b — 2 handlers dans sync.controller.js

- [ ] **Step 4 : Ajouter `getStatuses` dans sync.controller.js**

  Dans `backend/controllers/sync.controller.js`, avant `module.exports`, ajouter :

  ```js
  async function getStatuses(req, res) {
    try {
      const { projectId } = req.params;
      const project = PROJECTS.find((p) => p.id === projectId);
      if (!project)
        return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });

      const statuses = await gitlabServiceInstance.getAvailableStatuses(project.gitlab.projectId);
      res.json({ success: true, data: statuses, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur GET /api/sync/${req.params.projectId}/statuses:`, error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  }

  async function getFieldValues(req, res) {
    try {
      const { projectId } = req.params;
      const { field } = req.query;
      const project = PROJECTS.find((p) => p.id === projectId);
      if (!project)
        return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });

      const values = await gitlabServiceInstance.getCustomFieldValues(project.gitlab.projectId, field);
      res.json({ success: true, data: values, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error(`Erreur GET /api/sync/${req.params.projectId}/field-values:`, error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  }
  ```

- [ ] **Step 5 : Exporter `getStatuses` et `getFieldValues` dans `module.exports`**

  Dans `sync.controller.js`, ajouter dans `module.exports = { ... }` :
  ```js
  getStatuses,
  getFieldValues,
  ```

### 4c — Mettre à jour `previewSync` et `executeSync` dans sync.controller.js

- [ ] **Step 6 : Mettre à jour `previewSync`**

  Remplacer le corps de `previewSync` pour passer les filtres :

  ```js
  async function previewSync(req, res) {
    try {
      const { projectId, folderName, iterationName, statusGid, versionProd, versionTest } = req.body;
      const project = PROJECTS.find((p) => p.id === projectId);
      if (!project)
        return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
      if (!project.configured)
        return res.status(400).json({ success: false, error: `Projet "${project.label}" non configuré` });

      logger.info(`Preview: ${project.label} / folder="${folderName}"`);
      const filters = { iterationName, statusGid, versionProd, versionTest };
      const preview = await syncService.previewIteration(folderName, filters, project);
      syncHistoryService.addRun(project.label, folderName, 'preview', {
        created: preview.summary.toCreate,
        updated: preview.summary.toUpdate,
        skipped: preview.summary.toSkip,
        total: preview.summary.total,
      });
      res.json({ success: true, data: preview, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Erreur POST /api/sync/preview:', error);
      res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
    }
  }
  ```

- [ ] **Step 7 : Mettre à jour `executeSync`**

  Remplacer les lignes de récupération du body et l'appel à `syncService.syncIteration` :

  ```js
  async function executeSync(req, res) {
    const { projectId, folderName, iterationName, statusGid, versionProd, versionTest } = req.body;
    const project = PROJECTS.find((p) => p.id === projectId);
    if (!project)
      return res.status(404).json({ success: false, error: `Projet "${projectId}" inconnu` });
    if (!project.configured)
      return res.status(400).json({ success: false, error: `Projet "${project.label}" non configuré` });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (type, data = {}) => {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      if (typeof res.flush === 'function') res.flush();
    };

    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);

    try {
      logger.info(`Execute: ${project.label} / folder="${folderName}"`);
      const filters = { iterationName, statusGid, versionProd, versionTest };
      const stats = await syncService.syncIteration(
        folderName,
        filters,
        { projectConfig: project },
        (type, data) => send(type, data)
      );
      syncHistoryService.addRun(project.label, folderName, 'execute', stats);
    } catch (error) {
      logger.error('Execute SSE error:', error);
      send('error', { message: error.message });
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  }
  ```

### 4d — Mettre à jour les tests sync.routes

- [ ] **Step 8 : Mettre à jour `backend/tests/routes/sync.routes.test.js`**

  Remplacer les tests POST `/api/sync/preview` et POST `/api/sync/execute` par :

  ```js
  describe('POST /api/sync/preview', () => {
    test('403 — sans X-Requested-With', async () => {
      const res = await request(app)
        .post('/api/sync/preview')
        .send({ projectId: 'neo-pilot', folderName: 'R01', iterationName: 'R01' });
      expect(res.status).toBe(403);
    });

    test('400 — body vide', async () => {
      const res = await request(app).post('/api/sync/preview').set(CSRF).send({});
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
    });

    test('400 — aucun filtre fourni (folderName seul ne suffit pas)', async () => {
      const res = await request(app)
        .post('/api/sync/preview')
        .set(CSRF)
        .send({ projectId: 'neo-pilot', folderName: 'R01' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
    });

    test('400 — folderName manquant', async () => {
      const res = await request(app)
        .post('/api/sync/preview')
        .set(CSRF)
        .send({ projectId: 'neo-pilot', iterationName: 'R01' });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ success: false });
    });

    test('200 — body valide avec iterationName', async () => {
      const res = await request(app)
        .post('/api/sync/preview')
        .set(CSRF)
        .send({ projectId: 'neo-pilot', folderName: 'R01', iterationName: 'R01' });
      expect(res.status).toBe(200);
    });

    test('200 — body valide avec versionProd seul (sans iterationName)', async () => {
      const res = await request(app)
        .post('/api/sync/preview')
        .set(CSRF)
        .send({ projectId: 'neo-pilot', folderName: 'R06 - Pilot', versionProd: 'R06 - Pilot' });
      expect(res.status).toBe(200);
    });

    test('200 — 4 filtres cumulés', async () => {
      const res = await request(app)
        .post('/api/sync/preview')
        .set(CSRF)
        .send({
          projectId: 'neo-pilot',
          folderName: 'R14 - run 2',
          iterationName: 'R14 - run 2',
          statusGid: 'gid://gitlab/WorkItems::Statuses::Custom::Status/15',
          versionProd: 'R06 - Pilot',
          versionTest: 'Sprint-A',
        });
      expect(res.status).toBe(200);
    });
  });
  ```

  Ajouter aussi les tests pour les 2 nouveaux endpoints :

  ```js
  describe('GET /api/sync/:projectId/statuses', () => {
    test('200 — project valide', async () => {
      const res = await request(app).get('/api/sync/neo-pilot/statuses');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
    });

    test('400 — projectId vide', async () => {
      const res = await request(app).get('/api/sync//statuses');
      expect(res.status).toBe(404); // route non matchée
    });
  });

  describe('GET /api/sync/:projectId/field-values', () => {
    test('400 — field manquant', async () => {
      const res = await request(app).get('/api/sync/neo-pilot/field-values');
      expect(res.status).toBe(400);
    });

    test('200 — field valide', async () => {
      const res = await request(app)
        .get('/api/sync/neo-pilot/field-values?field=Version%20Prod');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
    });
  });
  ```

  > Le mock du controller dans sync.routes.test.js couvre déjà `getStatuses` et `getFieldValues` — ajouter ces deux entrées dans le mock en haut du fichier :
  > ```js
  > getStatuses: (_req, res) => res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  > getFieldValues: (_req, res) => res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  > ```

- [ ] **Step 9 : Vérifier tous les tests**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend && npx jest --no-coverage 2>&1 | tail -10
  ```
  Attendu : toutes suites vertes

- [ ] **Step 10 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add backend/routes/sync.routes.js backend/controllers/sync.controller.js backend/tests/routes/sync.routes.test.js
  git commit -m "feat(sync): 2 nouveaux endpoints statuses/field-values + filtres cumulables preview/execute"
  ```

---

## Task 5 — sync.service.js : signature mise à jour

**Files:**
- Modify: `backend/services/sync.service.js`

- [ ] **Step 1 : Lire sync.service.js pour localiser `syncIteration` et `previewIteration`**

  Localiser :
  - `async syncIteration(iterationName, options = {}, onEvent = null)` — signature actuelle
  - `async previewIteration(iterationName, project)` — signature actuelle

- [ ] **Step 2 : Mettre à jour `syncIteration`**

  Changer la signature et la logique de récupération des issues :

  **Ancienne signature :**
  ```js
  async syncIteration(iterationName, options = {}, onEvent = null) {
    const { isTest = false, dryRun = false, projectConfig = null } = options;
  ```

  **Nouvelle signature :**
  ```js
  async syncIteration(folderName, filters = {}, options = {}, onEvent = null) {
    const { iterationName, statusGid, versionProd, versionTest } = filters;
    const { isTest = false, dryRun = false, projectConfig = null } = options;
  ```

  **Remplacer le bloc de récupération des issues (étape 2 du sync) :**

  Ancienne version (chercher `// 2. Récupérer les tickets`) :
  ```js
  // 1. Rechercher l'itération dans GitLab
  let iteration;
  if (cfg.gitlabProjectId) {
    iteration = await gitlabService.findIterationForProject(cfg.gitlabProjectId, iterationName);
  } else {
    iteration = await gitlabService.findIteration(iterationName);
  }
  if (!iteration) { ... }
  await this._delay();

  // 2. Récupérer les tickets (filtre par status Work Item = Test::TODO)
  const gitlabPid = cfg.gitlabProjectId || gitlabService.projectId;
  const issues = await gitlabService.getIssuesByStatusAndIteration(gitlabPid, iteration.id);
  ```

  Nouvelle version :
  ```js
  // 1. Résoudre l'itération GitLab si fournie
  const gitlabPid = cfg.gitlabProjectId || gitlabService.projectId;
  let iterationId;
  if (iterationName) {
    const iteration = cfg.gitlabProjectId
      ? await gitlabService.findIterationForProject(cfg.gitlabProjectId, iterationName)
      : await gitlabService.findIteration(iterationName);

    if (!iteration) {
      const errMsg = `Itération "${iterationName}" non trouvée dans GitLab`;
      emit('error', { message: errMsg });
      return { ...stats, error: errMsg };
    }
    iterationId = iteration.id;
    await this._delay();
  }

  // 2. Récupérer les tickets avec les filtres actifs
  const issues = await gitlabService.getIssuesByFilters(gitlabPid, {
    iterationId,
    statusGid,
    versionProd,
    versionTest,
  });
  ```

  **Remplacer aussi le log initial :**
  ```js
  logger.info(
    `Sync: Itération="${iterationName || '-'}" | Folder="${folderName}" | ` +
    `statusGid=${statusGid || '-'} | vProd=${versionProd || '-'} | vTest=${versionTest || '-'} | ` +
    `Test=${isTest} | DryRun=${dryRun}`
  );
  ```

  **Remplacer `_ensureFolderHierarchyWith(iterationName, ...)` par `_ensureFolderHierarchyWith(folderName, ...)`** (le nom du dossier est maintenant `folderName`).

  **Remplacer `emit('start', { iterationName, dryRun })` par :**
  ```js
  emit('start', { folderName, filters, dryRun });
  ```

- [ ] **Step 3 : Mettre à jour `previewIteration`**

  Chercher `async previewIteration(iterationName, project)` et mettre à jour :

  **Ancienne signature :**
  ```js
  async previewIteration(iterationName, project) {
    const cfg = this._withProjectConfig(project);
    // ...
    const iteration = await gitlabService.findIterationForProject(cfg.gitlabProjectId, iterationName);
    // ...
    const existingChildFolder = await testmoService.findFolder(cfg.projectId, child, null);
    // ...
  }
  ```

  **Nouvelle signature et implémentation :**
  ```js
  async previewIteration(folderName, filters = {}, project) {
    const { iterationName, statusGid, versionProd, versionTest } = filters;
    const cfg = this._withProjectConfig(project);

    // 1. Récupérer les issues (même logique que syncIteration)
    const gitlabPid = cfg.gitlabProjectId || gitlabService.projectId;
    let iterationId;
    let issues = [];

    if (iterationName) {
      const iteration = await gitlabService.findIterationForProject(gitlabPid, iterationName);
      if (!iteration) throw new Error(`Itération "${iterationName}" non trouvée dans GitLab`);
      iterationId = iteration.id;
      await this._delay();
    }

    issues = await gitlabService.getIssuesByFilters(gitlabPid, {
      iterationId,
      statusGid,
      versionProd,
      versionTest,
    });

    // 2. Vérifier l'arborescence Testmo (existence seulement)
    const { parent, child } = this.parseIterationName(folderName);
    let existingChildFolder = null;
    try {
      existingChildFolder = await testmoService.findFolder(cfg.projectId, child, null);
    } catch (_) {}
    await this._delay();

    // 3. Analyser chaque ticket
    let toCreate = 0, toUpdate = 0, toSkip = 0;
    const issueAnalysis = [];

    for (const issue of issues) {
      let status = 'create';
      try {
        const existingCase = existingChildFolder
          ? await testmoService.findCaseByName(cfg.projectId, issue.title, existingChildFolder.id)
          : null;
        await this._delay();
        if (existingCase) {
          status = testmoService.isCaseEnriched(existingCase) ? 'skip_enriched' : 'update';
        }
      } catch (_) { status = 'create'; }

      if (status === 'create') toCreate++;
      else if (status === 'update') toUpdate++;
      else toSkip++;

      issueAnalysis.push({ iid: issue.iid, title: issue.title, url: issue.web_url, status });
    }

    return {
      folder: { parent, child, exists: !!existingChildFolder },
      filters: { iterationName, statusGid, versionProd, versionTest },
      issues: issueAnalysis,
      summary: { toCreate, toUpdate, toSkip, total: issues.length },
    };
  }
  ```

- [ ] **Step 4 : Vérifier suite complète**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend && npx jest --no-coverage 2>&1 | tail -10
  ```
  Attendu : toutes suites vertes

- [ ] **Step 5 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add backend/services/sync.service.js
  git commit -m "feat(sync-service): syncIteration + previewIteration acceptent folderName + 4 filtres optionnels"
  ```

---

## Task 6 — api.service.js : 2 nouvelles méthodes

**Files:**
- Modify: `frontend/src/services/api.service.js`

- [ ] **Step 1 : Ajouter après la section Dashboard 6 (avant la section Dashboard 7)**

  ```js
  async getSyncStatuses(projectId) {
    try {
      const response = await apiClient.get(`/sync/${projectId}/statuses`);
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Sync Statuses', error);
    }
  },

  async getSyncFieldValues(projectId, fieldName) {
    try {
      const response = await apiClient.get(`/sync/${projectId}/field-values`, {
        params: { field: fieldName },
      });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Sync Field Values', error);
    }
  },
  ```

- [ ] **Step 2 : Mettre à jour `previewSync` et son appel dans api.service.js**

  Mettre à jour la méthode `previewSync` pour passer les nouveaux champs :

  ```js
  async previewSync(projectId, folderName, filters = {}) {
    try {
      const body = { projectId, folderName, ...filters };
      const response = await apiClient.post('/sync/preview', body, { timeout: 60000 });
      return response.data.data;
    } catch (error) {
      throw this._handleError('Preview Sync', error);
    }
  },
  ```

- [ ] **Step 3 : Vérifier suite backend toujours verte**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend && npx jest --no-coverage 2>&1 | tail -5
  ```

- [ ] **Step 4 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add frontend/src/services/api.service.js
  git commit -m "feat(api-service): getSyncStatuses + getSyncFieldValues + previewSync étendu"
  ```

---

## Task 7 — Dashboard6.jsx : 3 sélecteurs optionnels + folderName

**Files:**
- Modify: `frontend/src/components/Dashboard6.jsx`

- [ ] **Step 1 : Ajouter les nouveaux états dans Dashboard6**

  Après les états existants (`selectedIter`, `iterations`, etc.), ajouter :

  ```js
  const [folderName, setFolderName]         = useState('');
  const [statuses, setStatuses]             = useState([]);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [versionsProd, setVersionsProd]     = useState([]);
  const [selectedVersionProd, setSelectedVersionProd] = useState('');
  const [versionsTest, setVersionsTest]     = useState([]);
  const [selectedVersionTest, setSelectedVersionTest] = useState('');
  const [loadingFilters, setLoadingFilters] = useState(false);
  ```

- [ ] **Step 2 : Charger les valeurs de filtres quand le projet change**

  Ajouter une fonction `loadFilters` et l'appeler quand `selectedProject` change :

  ```js
  const loadFilters = useCallback(async (projectId) => {
    if (!projectId) return;
    setLoadingFilters(true);
    try {
      const [statusList, prodList, testList] = await Promise.all([
        apiService.getSyncStatuses(projectId),
        apiService.getSyncFieldValues(projectId, 'Version Prod'),
        apiService.getSyncFieldValues(projectId, 'Version de test'),
      ]);
      setStatuses(statusList || []);
      setVersionsProd(prodList || []);
      setVersionsTest(testList || []);
    } catch (err) {
      console.warn('Impossible de charger les filtres:', err.message);
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) loadFilters(selectedProject);
  }, [selectedProject, loadFilters]);
  ```

- [ ] **Step 3 : Auto-remplir folderName depuis l'itération sélectionnée**

  Dans le handler de sélection d'itération (`handleIterSearchChange` ou équivalent), après `setSelectedIter(val)`, ajouter :
  ```js
  if (!folderName) setFolderName(val);
  ```

  Et dans le sélecteur d'itération `onChange`, ajouter :
  ```js
  onChange={e => {
    setSelectedIter(e.target.value);
    if (!folderName) setFolderName(e.target.value);
  }}
  ```

- [ ] **Step 4 : Ajouter les 4 sélecteurs dans le JSX**

  Lire `Dashboard6.jsx` pour trouver la zone de sélection du projet/itération (state `idle`). Après le bloc d'itération, ajouter les filtres additionnels et le champ folderName :

  ```jsx
  {/* ── Filtres additionnels (optionnels) ── */}
  {selectedProject && (
    <div className="d6-filters-section">
      <div className="d6-filter-label">
        Filtres optionnels{loadingFilters && ' (chargement…)'}
      </div>

      <div className="d6-filter-row">
        <label>Status Work Item</label>
        <select
          className="d6-select"
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          disabled={loadingFilters}
        >
          <option value="">— Tous les statuts —</option>
          {statuses.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      <div className="d6-filter-row">
        <label>Version Prod</label>
        <select
          className="d6-select"
          value={selectedVersionProd}
          onChange={e => setSelectedVersionProd(e.target.value)}
          disabled={loadingFilters}
        >
          <option value="">— Toutes les versions —</option>
          {versionsProd.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      <div className="d6-filter-row">
        <label>Version de test</label>
        <select
          className="d6-select"
          value={selectedVersionTest}
          onChange={e => setSelectedVersionTest(e.target.value)}
          disabled={loadingFilters}
        >
          <option value="">— Toutes —</option>
          {versionsTest.map(v => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      <div className="d6-filter-row">
        <label>Nom du dossier Testmo <span className="d6-required">*</span></label>
        <input
          type="text"
          className="d6-input"
          value={folderName}
          onChange={e => setFolderName(e.target.value)}
          placeholder="Ex : R14 - run 2"
        />
      </div>
    </div>
  )}
  ```

- [ ] **Step 5 : Mettre à jour `handleAnalyze` pour passer les filtres**

  Remplacer l'appel `apiService.previewSync(selectedProject, selectedIter)` par :

  ```js
  const filters = {};
  if (selectedIter)        filters.iterationName = selectedIter;
  if (selectedStatus)      filters.statusGid     = selectedStatus;
  if (selectedVersionProd) filters.versionProd   = selectedVersionProd;
  if (selectedVersionTest) filters.versionTest   = selectedVersionTest;

  const data = await apiService.previewSync(selectedProject, folderName, filters);
  ```

- [ ] **Step 6 : Mettre à jour `handleExecute` (SSE)**

  Dans le fetch SSE, remplacer le body JSON :

  ```js
  body: JSON.stringify({
    projectId: selectedProject,
    folderName,
    ...(selectedIter        && { iterationName:  selectedIter }),
    ...(selectedStatus      && { statusGid:       selectedStatus }),
    ...(selectedVersionProd && { versionProd:     selectedVersionProd }),
    ...(selectedVersionTest && { versionTest:     selectedVersionTest }),
  }),
  ```

- [ ] **Step 7 : Mettre à jour `canAnalyze`**

  Remplacer la condition existante :

  ```js
  const hasAtLeastOneFilter = selectedIter || selectedStatus || selectedVersionProd || selectedVersionTest;
  const canAnalyze = isConfigured && hasAtLeastOneFilter && folderName.trim() && state === 'idle';
  const canExecute = isConfigured && hasAtLeastOneFilter && folderName.trim() && state === 'preview';
  ```

- [ ] **Step 8 : Reset les filtres dans `handleReset`**

  Dans `handleReset()`, ajouter :
  ```js
  setSelectedStatus('');
  setSelectedVersionProd('');
  setSelectedVersionTest('');
  setFolderName('');
  ```

- [ ] **Step 9 : Vérifier suite backend**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard/backend && npx jest --no-coverage 2>&1 | tail -5
  ```
  473+ tests verts.

- [ ] **Step 10 : Commit**

  ```bash
  cd /Users/matou/claude-workspace/qa-dashboard
  git add frontend/src/components/Dashboard6.jsx
  git commit -m "feat(d6): 4 filtres cumulables — Status, Version Prod, Version de test, Iteration"
  ```

---

## Self-Review

### Couverture spec
| Exigence | Tâche |
|----------|-------|
| Filtre Iteration (existant, rendu optionnel) | T5 sync.service + T7 Dashboard6 |
| Filtre Status Work Item | T1 getIssuesByFilters + T4 routes + T7 |
| Filtre Version Prod | T1 getIssuesByFilters + T2 getCustomFieldValues + T7 |
| Filtre Version de test (nouveau) | T1 + T2 + T7 |
| Combinaison 1, 2, 3 ou 4 filtres en AND | T1 (logique locale) + T3 (Zod refine) |
| Sélecteurs dynamiques (valeurs chargées depuis GitLab) | T2 + T4 endpoints + T6 api.service + T7 |
| `folderName` décorrélé de l'itération | T3 validators + T5 service + T7 UI |
| Non-régression tests existants | T4 sync.routes.test mis à jour |

### Placeholder scan — aucun

### Cohérence des types
- `filters` = `{ iterationName?, statusGid?, versionProd?, versionTest? }` — cohérent T1→T5→T7
- `folderName` = string requis dans validators T3, controller T4, service T5, UI T7
- `getIssuesByFilters(projectId, filters)` — même signature T1, T5
- `previewIteration(folderName, filters, project)` — même ordre T5, T4 controller
- `syncIteration(folderName, filters, options, onEvent)` — même ordre T5, T4 controller

---

**Plan sauvegardé dans `docs/superpowers/plans/2026-04-30-sync-filtres-cumulables.md`.**

**Deux options d'exécution :**

**1. Subagent-Driven (recommandé)** — sous-agent dédié par tâche, review entre chaque

**2. Inline Execution** — dans cette session avec checkpoints

**Quelle approche ?**
