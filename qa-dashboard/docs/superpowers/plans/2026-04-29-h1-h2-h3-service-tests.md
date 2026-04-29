# H1/H2/H3 — Tests Services Backend

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couvrir les 3 services backend sans aucun test — `sync.service.js`, `status-sync.service.js`, `gitlab.service.js` — avec des tests unitaires qui documentent les contrats et bloquent les régressions.

**Architecture:** Chaque service reçoit son propre fichier de test. Les fonctions pures sont testées sans mock. Les méthodes qui appellent des APIs externes utilisent soit `jest.fn()` injecté sur l'instance (`service.client.get = jest.fn()`), soit `jest.spyOn(axios, 'post')` pour GraphQL. Le pattern `resilience.test.js` (extraction inline des helpers purs) est suivi pour les fonctions exportées standalone.

**Tech Stack:** Jest (déjà installé), pattern `Object.assign` sur les instances pour les mocks de dépendances inter-services (pattern `critical-bugs.test.js`).

---

## Fichiers créés

| Fichier | Contenu |
|---------|---------|
| `backend/tests/sync.service.test.js` | parseIterationName (5 cas), syncIteration dryRun + iteration-not-found |
| `backend/tests/status-sync.service.test.js` | buildCommentText, isCommentDuplicate, computeLabelChanges, computeStatusChange (16 cas purs) |
| `backend/tests/gitlab.service.test.js` | formatEstimate (7 cas), getIssueNotes (2 cas), findIterationForProject (3 cas), searchIterations (2 cas) |

---

## Task 1 — sync.service : parseIterationName + syncIteration

**Files:**
- Create: `backend/tests/sync.service.test.js`
- Read-only ref: `backend/services/sync.service.js`

### Contexte

`parseIterationName` est une fonction pure sur le singleton exporté. Elle gère deux formats :
- Standard `"R06 - run 1"` → `{ parent: "R06", child: "R06 - run 1" }`
- Cadence auto GitLab `"Itération #3 (01/01 → 31/01)"` → `{ parent: "Iteration-3", child: "Iteration-3" }`

`syncIteration` appelle `gitlabService` et `testmoService` — ces dépendances sont des singletons importés au niveau module. On les mock via `Object.assign` sur les modules requis, comme dans `critical-bugs.test.js`.

- [ ] **Step 1 : Écrire le fichier de test**

```js
// backend/tests/sync.service.test.js
/**
 * Tests — sync.service.js (GitLab → Testmo pipeline)
 * Couvre : parseIterationName (pur), syncIteration (mocké)
 */

const syncService = require('../services/sync.service');

// ─── parseIterationName — fonction pure ─────────────────────────────────────

describe('parseIterationName', () => {
  test('format standard "R06 - run 1" → parent=R06, child=R06 - run 1', () => {
    const result = syncService.parseIterationName('R06 - run 1');
    expect(result.parent).toBe('R06');
    expect(result.child).toBe('R06 - run 1');
  });

  test('format sans espaces "R06-run1" → normalise les tirets', () => {
    const result = syncService.parseIterationName('R06-run1');
    expect(result.parent).toBe('R06');
    // Le child contient la forme normalisée
    expect(result.child).toContain('R06');
  });

  test('cadence auto "Itération #3 (...)" → parent=Iteration-3, child=Iteration-3', () => {
    const result = syncService.parseIterationName('Itération #3 (01/01 → 31/01)');
    expect(result.parent).toBe('Iteration-3');
    expect(result.child).toBe('Iteration-3');
  });

  test('cadence auto variante ASCII "Iteration #7" → parent=Iteration-7', () => {
    const result = syncService.parseIterationName('Iteration #7 (15/03 → 28/03)');
    expect(result.parent).toBe('Iteration-7');
    expect(result.child).toBe('Iteration-7');
  });

  test('format simple "R14" (pas de tiret) → parent=R14, child=R14', () => {
    const result = syncService.parseIterationName('R14');
    expect(result.parent).toBe('R14');
    expect(result.child).toBe('R14');
  });
});

// ─── syncIteration — dryRun ──────────────────────────────────────────────────

describe('syncIteration — dryRun=true', () => {
  let gitlabModule, testmoModule;

  beforeEach(() => {
    gitlabModule = require('../services/gitlab.service');
    testmoModule = require('../services/testmo.service');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retourne les stats correctes sans créer de cases', async () => {
    // Mock des dépendances
    Object.assign(gitlabModule, {
      findIteration: jest.fn().mockResolvedValue({ id: 42, title: 'R06 - run 1' }),
      getIssuesByStatusAndIteration: jest.fn().mockResolvedValue([
        { id: 100, iid: 1, title: 'Cas de test A', web_url: 'https://gitlab.test/issues/1', project_id: '5' },
        { id: 101, iid: 2, title: 'Cas de test B', web_url: 'https://gitlab.test/issues/2', project_id: '5' }
      ])
    });
    Object.assign(testmoModule, {
      getOrCreateFolder: jest.fn()
        .mockResolvedValueOnce({ id: 10, name: '[TEST-API] R06' })
        .mockResolvedValueOnce({ id: 11, name: 'R06 - run 1' }),
      findCaseByName: jest.fn().mockResolvedValue(null) // aucun case existant
    });

    const events = [];
    const stats = await syncService.syncIteration(
      'R06 - run 1',
      { dryRun: true },
      (type, data) => events.push({ type, data })
    );

    // dryRun : stats.created comptabilise les cases qui SERAIENT créés
    expect(stats.created).toBe(2);
    expect(stats.errors).toBe(0);
    // Aucun appel à createCase en dryRun
    expect(testmoModule.createCase).toBeUndefined();
  });

  test('retourne une erreur si itération non trouvée', async () => {
    Object.assign(gitlabModule, {
      findIteration: jest.fn().mockResolvedValue(null)
    });

    const stats = await syncService.syncIteration('R99 - inexistant', { dryRun: true });

    expect(stats.error).toBeDefined();
    expect(stats.error).toContain('R99 - inexistant');
    expect(stats.created).toBe(0);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent (rouge)**

```bash
cd /Users/matou/claude-workspace/qa-dashboard/backend
npx jest tests/sync.service.test.js 2>&1 | tail -20
```

Attendu : les tests `parseIterationName` passent (fonctions pures déjà implémentées), les tests `syncIteration` échouent ou passent selon l'implémentation. Si tous passent déjà, c'est OK — les tests documentent le comportement existant.

- [ ] **Step 3 : Vérifier que les tests passent (vert)**

```bash
cd /Users/matou/claude-workspace/qa-dashboard/backend
npx jest tests/sync.service.test.js --verbose 2>&1 | tail -20
```

Attendu : 7/7 PASS

- [ ] **Step 4 : Commit**

```bash
cd /Users/matou/claude-workspace/qa-dashboard
git add backend/tests/sync.service.test.js
git commit -m "test(sync): add unit tests for parseIterationName and syncIteration"
```

---

## Task 2 — status-sync.service : fonctions pures exportées

**Files:**
- Create: `backend/tests/status-sync.service.test.js`
- Read-only ref: `backend/services/status-sync.service.js`

### Contexte

Ces fonctions sont exportées comme helpers standalone depuis `status-sync.service.js` :
- `buildCommentText(runName, statusId)` — construit le texte du commentaire automatique
- `isCommentDuplicate(existingNotes, commentText)` — vérifie si un commentaire identique existe
- `computeLabelChanges(currentLabels, newLabel)` — calcule les labels à ajouter/retirer
- `computeStatusChange(currentStatus, newStatus)` — calcule si un changement de status est nécessaire

Mapping de référence :
```
STATUS_ID_TO_NAME = { 2: 'Passed', 3: 'Failed', 4: 'Retest', 8: 'WIP' }
ALL_TEST_LABELS = ['Test::OK','Test::KO','Test::WIP','Test::SKIPPED','Test::BLOCKED','DoubleTestNécessaire','Test::TODO']
```

- [ ] **Step 1 : Écrire le fichier de test**

```js
// backend/tests/status-sync.service.test.js
/**
 * Tests — status-sync.service.js (Testmo → GitLab)
 * Couvre : buildCommentText, isCommentDuplicate, computeLabelChanges, computeStatusChange
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

  test('issue avec un autre label Test:: → retire l'ancien, ajoute le nouveau', () => {
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

// ─── Mapping de cohérence ─────────────────────────────────────────────────────

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
```

- [ ] **Step 2 : Vérifier que les tests passent**

```bash
cd /Users/matou/claude-workspace/qa-dashboard/backend
npx jest tests/status-sync.service.test.js --verbose 2>&1 | tail -30
```

Attendu : 16/16 PASS (toutes des fonctions pures déjà implémentées).

- [ ] **Step 3 : Commit**

```bash
cd /Users/matou/claude-workspace/qa-dashboard
git add backend/tests/status-sync.service.test.js
git commit -m "test(status-sync): add unit tests for pure helper functions"
```

---

## Task 3 — gitlab.service : formatEstimate + méthodes REST/GraphQL

**Files:**
- Create: `backend/tests/gitlab.service.test.js`
- Read-only ref: `backend/services/gitlab.service.js`

### Contexte

`GitLabService` est instancié comme singleton, mais la classe est aussi exportée (`module.exports.GitLabService`). On instancie `new GitLabService()` dans les tests en configurant les env vars, puis on remplace `service.client.get` par un `jest.fn()` pour mocker les appels REST sans toucher axios globalement. Pour GraphQL (`executeGraphQL` qui utilise `axios.post` directement), on spie sur `axios.post`.

Pattern de mock REST :
```js
service.client.get = jest.fn().mockResolvedValue({
  data: [...],
  headers: { 'x-next-page': '' }   // chaîne vide = dernière page
});
```

Pattern de mock GraphQL :
```js
const axios = require('axios');
jest.spyOn(axios, 'post').mockResolvedValue({
  data: { data: { workItemUpdate: { workItem: {...}, errors: [] } } }
});
```

`_withRetry` est appelé par `_getPaginated` — avec un mock immédiatement résolu il ne retentera jamais.

- [ ] **Step 1 : Écrire le fichier de test**

```js
// backend/tests/gitlab.service.test.js
/**
 * Tests — gitlab.service.js (client API GitLab)
 * Couvre : formatEstimate (pur), getIssueNotes, findIterationForProject, searchIterations
 */

const axios = require('axios');
const { GitLabService } = require('../services/gitlab.service');

// Utilitaire : instancie un service avec env vars minimaux
function makeService() {
  process.env.GITLAB_URL   = 'https://gitlab.test';
  process.env.GITLAB_TOKEN = 'test-token';
  process.env.GITLAB_WRITE_TOKEN = 'test-write-token';
  process.env.GITLAB_PROJECT_ID  = '5';
  const svc = new GitLabService();
  svc.apiDelay = 0; // désactive les délais dans les tests
  return svc;
}

// ─── formatEstimate (méthode statique pure) ──────────────────────────────────

describe('GitLabService.formatEstimate', () => {
  test('0 secondes → chaîne vide', () => {
    expect(GitLabService.formatEstimate(0)).toBe('');
  });

  test('valeur négative → chaîne vide', () => {
    expect(GitLabService.formatEstimate(-300)).toBe('');
  });

  test('null/undefined → chaîne vide', () => {
    expect(GitLabService.formatEstimate(null)).toBe('');
    expect(GitLabService.formatEstimate(undefined)).toBe('');
  });

  test('1800 secondes → "30m"', () => {
    expect(GitLabService.formatEstimate(1800)).toBe('30m');
  });

  test('3600 secondes → "1h"', () => {
    expect(GitLabService.formatEstimate(3600)).toBe('1h');
  });

  test('5400 secondes → "1h 30m"', () => {
    expect(GitLabService.formatEstimate(5400)).toBe('1h 30m');
  });

  test('45 secondes → "45s" (moins d\'une minute)', () => {
    expect(GitLabService.formatEstimate(45)).toBe('45s');
  });
});

// ─── getIssueNotes ───────────────────────────────────────────────────────────

describe('getIssueNotes', () => {
  test('filtre les notes système, retourne les notes utilisateur triées', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, body: 'Commentaire manuel', system: false, created_at: '2024-01-01' },
        { id: 2, body: 'assigned to @user', system: true,  created_at: '2024-01-02' },
        { id: 3, body: 'Autre commentaire', system: false, created_at: '2024-01-03' }
      ],
      headers: { 'x-next-page': '' }
    });

    const notes = await service.getIssueNotes('5', 42);

    expect(notes).toHaveLength(2);
    expect(notes.every(n => !n.system)).toBe(true);
  });

  test('erreur API → retourne [] sans throw', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockRejectedValue(
      Object.assign(new Error('Network Error'), { response: { status: 500 } })
    );

    const notes = await service.getIssueNotes('5', 99);
    expect(notes).toEqual([]);
  });
});

// ─── findIterationForProject ─────────────────────────────────────────────────

describe('findIterationForProject', () => {
  test('trouve par titre normalisé (insensible à la casse et aux tirets)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 10, iid: 1, title: 'R06 - run 1' },
        { id: 11, iid: 2, title: 'R07 - run 2' }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.findIterationForProject('5', 'R06-run1');
    expect(result).not.toBeNull();
    expect(result.id).toBe(10);
  });

  test('trouve par iid pour les cadences auto "Itération #3"', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 30, iid: 3, title: null },
        { id: 40, iid: 4, title: null }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.findIterationForProject('5', 'Itération #3 (01/01 → 31/01)');
    expect(result).not.toBeNull();
    expect(result.iid).toBe(3);
  });

  test('retourne null si l\'itération est introuvable', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [{ id: 10, iid: 1, title: 'R06 - run 1' }],
      headers: { 'x-next-page': '' }
    });

    const result = await service.findIterationForProject('5', 'R99 - inexistant');
    expect(result).toBeNull();
  });
});

// ─── searchIterations ────────────────────────────────────────────────────────

describe('searchIterations', () => {
  test('génère un titre de fallback pour les cadences auto (title=null)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, iid: 1, title: null, start_date: '2024-01-01', due_date: '2024-01-14' },
        { id: 2, iid: 2, title: 'R06 - run 1', start_date: null, due_date: null }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.searchIterations('5');

    const cadenceAuto = result.find(it => it.id === 1);
    expect(cadenceAuto.title).toMatch(/Itération #1/);
  });

  test('filtre localement par search (case-insensitive)', async () => {
    const service = makeService();
    service.client.get = jest.fn().mockResolvedValue({
      data: [
        { id: 1, iid: 1, title: 'R06 - run 1' },
        { id: 2, iid: 2, title: 'R07 - run 2' },
        { id: 3, iid: 3, title: 'R08 - run 3' }
      ],
      headers: { 'x-next-page': '' }
    });

    const result = await service.searchIterations('5', 'R07');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });
});

// ─── executeGraphQL — gestion d'erreurs ──────────────────────────────────────

describe('executeGraphQL', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retourne data.data si pas d\'erreurs', async () => {
    const service = makeService();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { data: { workItemUpdate: { workItem: { id: 'gid://1' }, errors: [] } } }
    });

    const result = await service.executeGraphQL('query { test }', {});
    expect(result).toHaveProperty('workItemUpdate');
  });

  test('throw si la réponse contient des erreurs GraphQL', async () => {
    const service = makeService();
    jest.spyOn(axios, 'post').mockResolvedValue({
      data: { errors: [{ message: 'Field does not exist' }] }
    });

    await expect(service.executeGraphQL('query { bad }', {}))
      .rejects.toThrow('Field does not exist');
  });
});
```

- [ ] **Step 2 : Vérifier que les tests passent**

```bash
cd /Users/matou/claude-workspace/qa-dashboard/backend
npx jest tests/gitlab.service.test.js --verbose 2>&1 | tail -35
```

Attendu : 18/18 PASS

- [ ] **Step 3 : Commit**

```bash
cd /Users/matou/claude-workspace/qa-dashboard
git add backend/tests/gitlab.service.test.js
git commit -m "test(gitlab): add unit tests for formatEstimate, getIssueNotes, findIterationForProject, searchIterations, executeGraphQL"
```

---

## Task 4 — Suite globale + IMPROVEMENTS.md

- [ ] **Step 1 : Vérifier la suite complète**

```bash
cd /Users/matou/claude-workspace/qa-dashboard/backend
npx jest 2>&1 | tail -10
```

Attendu : 340+ tests, 0 échec.

- [ ] **Step 2 : Mettre à jour IMPROVEMENTS.md**

Passer H1, H2, H3 de `⬜ todo` à `✅ done` dans `IMPROVEMENTS.md`.

- [ ] **Step 3 : Commit final**

```bash
cd /Users/matou/claude-workspace/qa-dashboard
git add IMPROVEMENTS.md
git commit -m "chore: mark H1/H2/H3 as done in IMPROVEMENTS.md"
```

---

## Self-Review

1. **Couverture spec** : H1 (sync.service) ✓ — H2 (status-sync) ✓ — H3 (gitlab.service) ✓
2. **Placeholders** : aucun — chaque test contient le code complet
3. **Cohérence des types** : `computeLabelChanges` retourne `{ addLabel, removeLabels, action }` — cohérent avec les exports de `status-sync.service.js:86-94`; `findIterationForProject` retourne `Object|null` — testé avec `result.id` et `result.iid`
4. **Cas non couverts** : `getIssuesByVersionAndIteration`, `getIssuesByVersionOnly`, `updateWorkItemStatus`, `syncIteration` en mode non-dryRun complet — hors scope (complexité de mocking > valeur ajoutée pour cette session)
