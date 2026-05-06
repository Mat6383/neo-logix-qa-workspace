# Backend Test Coverage — Services Critiques

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter des tests Jest couvrant les 4 services backend critiques (sync, status-sync, alerts, istqb-metrics) sur les gaps réels identifiés.

**Architecture:** Niveau 1 = tests unitaires sur méthodes privées accessibles via l'instance singleton. Niveau 2 = tests d'intégration avec `nock` (HTTP Testmo) + `jest.spyOn` (méthodes GitLab) pour tester les flows complets sans appels réseau réels.

**Tech Stack:** Jest 29, nock (nouveau), better-sqlite3 `:memory:`, jest.spyOn

---

## File Structure

| Fichier | Action | Contenu |
|---|---|---|
| `backend/tests/sync.extractSteps.test.js` | Créer | Tests unitaires `_extractStepsFromNotes` |
| `backend/tests/status-sync.integration.test.js` | Créer | Flow complet `syncRunStatusToGitLab` avec nock + spyOn |
| `backend/tests/alerts.integration.test.js` | Créer | `checkAndNotify` avec nock Slack webhook |

---

## Task 1 : Installer nock

**Files:**
- Modify: `backend/package.json` (devDependencies)

- [ ] **Step 1 : Installer nock**

```bash
cd backend
npm install --save-dev nock
```

- [ ] **Step 2 : Vérifier l'installation**

```bash
node -e "require('nock'); console.log('nock OK')"
```

Expected output : `nock OK`

- [ ] **Step 3 : Vérifier que les tests existants passent toujours**

```bash
npm test
```

Expected : toutes les suites passent (même nombre qu'avant).

- [ ] **Step 4 : Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add nock for HTTP interception in integration tests"
```

---

## Task 2 : Tests unitaires `_extractStepsFromNotes`

La méthode `_extractStepsFromNotes` est privée mais accessible via le singleton exporté (`syncService._extractStepsFromNotes(notes)`). Elle transforme des commentaires GitLab (tableau `{ body: string }`) en steps Testmo (`{ text1, text3, display_order }`).

Règles métier critiques à couvrir :
- Notes sans section `[LABEL]` → `[]`
- Sections `[TEST]` / `[TESTS]` toujours placées **en dernier**
- Liens markdown `[texte](url)` ignorés (ne sont pas des sections)
- Note la plus longue utilisée pour les sections non-TEST

**Files:**
- Create: `backend/tests/sync.extractSteps.test.js`

- [ ] **Step 1 : Écrire les tests**

```javascript
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
```

- [ ] **Step 2 : Lancer les tests pour vérifier qu'ils passent**

```bash
cd backend
npx jest tests/sync.extractSteps.test.js --verbose
```

Expected : 9 tests PASS

- [ ] **Step 3 : Commit**

```bash
git add tests/sync.extractSteps.test.js
git commit -m "test(sync): unit tests for _extractStepsFromNotes (ordering, edge cases)"
```

---

## Task 3 : Tests d'intégration `syncRunStatusToGitLab`

On teste `statusSyncService.syncRunStatusToGitLab()` avec :
- **nock** interceptant les appels HTTP Testmo (axios `http://mock-testmo.test/api/v1/...`)
- **jest.spyOn** sur les méthodes de `gitlabService` (GraphQL + REST complexe)

`statusSyncService` a son propre client axios (`this.client`) configuré sur `TESTMO_URL` défini par `tests/helpers/setup.js` → `http://mock-testmo.test`.

**Files:**
- Create: `backend/tests/status-sync.integration.test.js`

- [ ] **Step 1 : Écrire les tests**

```javascript
'use strict';
/**
 * Tests d'intégration — statusSyncService.syncRunStatusToGitLab
 *
 * nock intercepte les appels axios Testmo (http://mock-testmo.test)
 * jest.spyOn mocke les méthodes gitlabService (GraphQL/REST complexe)
 */
const nock = require('nock');
const statusSyncService = require('../services/status-sync.service');
const gitlabService = require('../services/gitlab.service');

const TESTMO_BASE = 'http://mock-testmo.test';
const GL_PROJECT = 63;
const RUN_ID = 42;

const MOCK_RUN_INFO = { result: { id: RUN_ID, name: 'R14 - run 1' } };
const MOCK_RESULTS = {
  result: [
    { case_id: 101, case_name: 'Connexion admin', status_id: 2, is_latest: true },  // Passed → Test::OK
    { case_id: 102, case_name: 'Export PDF',     status_id: 3, is_latest: true },  // Failed → Test::KO
    { case_id: 103, case_name: 'Recherche',      status_id: 99, is_latest: true }, // Inconnu → skip
  ],
};
const MOCK_ISSUES = [
  { id: 1001, iid: 1, title: 'Connexion admin', labels: ['Test::WIP'] },
  { id: 1002, iid: 2, title: 'Export PDF',      labels: ['Test::OK'] },
];
const MOCK_ITERATION = { id: 'gid://gitlab/Iteration/7', title: 'R14 - run 1' };

function setupNockTestmo() {
  nock(TESTMO_BASE)
    .get(`/api/v1/runs/${RUN_ID}`)
    .reply(200, MOCK_RUN_INFO);
  nock(TESTMO_BASE)
    .get(`/api/v1/runs/${RUN_ID}/results`)
    .reply(200, MOCK_RESULTS);
}

afterEach(() => {
  nock.cleanAll();
  jest.restoreAllMocks();
});

describe('syncRunStatusToGitLab — flow nominal', () => {
  test('2 résultats mappés → 2 updated, 1 skipped (status inconnu)', async () => {
    setupNockTestmo();

    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue(MOCK_ISSUES);
    jest.spyOn(gitlabService, 'updateWorkItemStatus').mockResolvedValue({});
    jest.spyOn(gitlabService, 'getIssueNotes').mockResolvedValue([]);
    jest.spyOn(gitlabService, 'addIssueComment').mockResolvedValue({});

    const events = [];
    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT,
      (type, data) => events.push({ type, data })
    );

    expect(stats.updated).toBe(2);
    expect(stats.skipped).toBe(1);
    expect(stats.errors).toBe(0);
    expect(gitlabService.updateWorkItemStatus).toHaveBeenCalledTimes(2);
  });

  test('les appels Testmo passent bien par nock (pas de requête réseau réelle)', async () => {
    setupNockTestmo();
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue([]);
    jest.spyOn(gitlabService, 'getIssueNotes').mockResolvedValue([]);

    await statusSyncService.syncRunStatusToGitLab(RUN_ID, 'R14 - run 1', GL_PROJECT);

    expect(nock.isDone()).toBe(true); // tous les intercepteurs nock ont été consommés
  });
});

describe('syncRunStatusToGitLab — mode dryRun', () => {
  test('dryRun=true → updated incrémenté mais updateWorkItemStatus jamais appelé', async () => {
    setupNockTestmo();
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue(MOCK_ISSUES);
    jest.spyOn(gitlabService, 'updateWorkItemStatus').mockResolvedValue({});

    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT, () => {}, true
    );

    expect(stats.dryRun).toBe(true);
    expect(stats.updated).toBe(2);
    expect(gitlabService.updateWorkItemStatus).not.toHaveBeenCalled();
  });
});

describe('syncRunStatusToGitLab — erreurs', () => {
  test('aucun résultat Testmo → stats vides, aucun appel GitLab', async () => {
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}`).reply(200, MOCK_RUN_INFO);
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}/results`).reply(200, { result: [] });
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'updateWorkItemStatus').mockResolvedValue({});

    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT
    );

    expect(stats.updated).toBe(0);
    expect(gitlabService.updateWorkItemStatus).not.toHaveBeenCalled();
  });

  test('Testmo renvoie 429 → lance une erreur', async () => {
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}`).reply(200, MOCK_RUN_INFO);
    nock(TESTMO_BASE).get(`/api/v1/runs/${RUN_ID}/results`).reply(429, 'Too Many Requests');
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);

    await expect(
      statusSyncService.syncRunStatusToGitLab(RUN_ID, 'R14 - run 1', GL_PROJECT)
    ).rejects.toThrow();
  });

  test("updateWorkItemStatus échoue sur une issue → error incrémenté, sync continue", async () => {
    setupNockTestmo();
    jest.spyOn(gitlabService, 'findIterationForProject').mockResolvedValue(MOCK_ITERATION);
    jest.spyOn(gitlabService, 'getIssuesForIteration').mockResolvedValue(MOCK_ISSUES);
    jest.spyOn(gitlabService, 'getIssueNotes').mockResolvedValue([]);
    jest.spyOn(gitlabService, 'addIssueComment').mockResolvedValue({});
    jest.spyOn(gitlabService, 'updateWorkItemStatus')
      .mockRejectedValueOnce(new Error('GitLab 500'))
      .mockResolvedValue({});

    const stats = await statusSyncService.syncRunStatusToGitLab(
      RUN_ID, 'R14 - run 1', GL_PROJECT
    );

    expect(stats.errors).toBe(1);
    expect(stats.updated).toBe(1); // la 2ème issue passe quand même
  });
});
```

- [ ] **Step 2 : Lancer les tests**

```bash
cd backend
npx jest tests/status-sync.integration.test.js --verbose
```

Expected : 6 tests PASS

- [ ] **Step 3 : Commit**

```bash
git add tests/status-sync.integration.test.js
git commit -m "test(status-sync): integration tests with nock + spyOn for syncRunStatusToGitLab"
```

---

## Task 4 : Tests d'intégration Slack (`checkAndNotify`)

On teste `checkAndNotify` avec un vrai appel `node-fetch` intercepté par nock — sans mocker `_postWebhook`. Cela teste la couche HTTP réelle que l'existant (`alerts.service.test.js`) bypasse via `jest.fn()`.

`_postWebhook` utilise `node-fetch` pour POSTer sur `slack_webhook_url`. Nock intercepte les appels HTTP de node-fetch.

**Files:**
- Create: `backend/tests/alerts.integration.test.js`

- [ ] **Step 1 : Écrire les tests**

```javascript
'use strict';
/**
 * Tests d'intégration — AlertsService.checkAndNotify
 *
 * nock intercepte l'appel HTTP node-fetch vers le webhook Slack.
 * Pas de mock sur _postWebhook → teste le vrai chemin HTTP.
 */
const nock = require('nock');
const AlertsService = require('../services/alerts.service');
const os = require('os');
const path = require('path');

const SLACK_HOST = 'https://hooks.slack.com';
const SLACK_PATH = '/services/TEST/HOOK/abc123';
const SLACK_URL  = `${SLACK_HOST}${SLACK_PATH}`;

function makeSvc(cfgOverride = {}) {
  const configPath = path.join(os.tmpdir(), `alerts-int-${Date.now()}.json`);
  const svc = new AlertsService({ configPath, dbPath: ':memory:' });
  svc._initDb();
  svc.saveConfig({
    ...svc.getConfig(),
    enabled: true,
    slack_webhook_url: SLACK_URL,
    cooldown_hours: 4,
    ...cfgOverride,
  });
  return svc;
}

const CRITICAL_SLA = {
  ok: false,
  alerts: [{ severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85, message: 'Pass rate critique: 80% < 85%' }],
};

afterEach(() => nock.cleanAll());

describe('checkAndNotify — POST Slack réel (nock)', () => {
  test('SLA breach → POST Slack avec le bon payload', async () => {
    let capturedBody;
    nock(SLACK_HOST).post(SLACK_PATH, (body) => { capturedBody = body; return true; }).reply(200, 'ok');

    const svc = makeSvc();
    await svc.checkAndNotify('proj-1', 'neo-pilot', CRITICAL_SLA);

    expect(nock.isDone()).toBe(true); // le POST a bien eu lieu
    expect(capturedBody.text).toContain('neo-pilot');
    expect(capturedBody.text).toContain('CRITICAL');
  });

  test('SLA breach → cooldown enregistré dans SQLite après envoi', async () => {
    nock(SLACK_HOST).post(SLACK_PATH).reply(200, 'ok');

    const svc = makeSvc();
    await svc.checkAndNotify('proj-2', 'neo-pilot', CRITICAL_SLA);

    const row = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('proj-2');
    expect(row).toBeTruthy();
    expect(new Date(row.last_sent_at).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  test('2 appels rapprochés → 1 seul POST (cooldown bloque le 2ème)', async () => {
    nock(SLACK_HOST).post(SLACK_PATH).reply(200, 'ok');

    const svc = makeSvc();
    await svc.checkAndNotify('proj-3', 'neo-pilot', CRITICAL_SLA); // 1er → POST
    await svc.checkAndNotify('proj-3', 'neo-pilot', CRITICAL_SLA); // 2ème → bloqué

    expect(nock.pendingMocks()).toHaveLength(0); // nock a un seul intercepteur, utilisé une seule fois
  });

  test('cooldown expiré → 2ème POST envoyé', async () => {
    // Simule un cooldown expiré (last_sent_at = il y a 5h, cooldown = 4h)
    nock(SLACK_HOST).post(SLACK_PATH).reply(200, 'ok').persist(); // 2 appels autorisés

    const svc = makeSvc({ cooldown_hours: 4 });
    const expired = new Date(Date.now() - 5 * 3600 * 1000).toISOString();
    svc._db.prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)').run('proj-4', expired);

    await svc.checkAndNotify('proj-4', 'neo-pilot', CRITICAL_SLA);

    expect(nock.isDone()).toBe(true);
  });

  test('webhook Slack renvoie 500 → pas de crash, cooldown non enregistré', async () => {
    nock(SLACK_HOST).post(SLACK_PATH).reply(500, 'Internal Server Error');

    const svc = makeSvc();
    await expect(svc.checkAndNotify('proj-5', 'neo-pilot', CRITICAL_SLA)).resolves.toBeUndefined();

    const row = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('proj-5');
    expect(row).toBeFalsy(); // cooldown non posé si envoi raté
  });

  test('URL webhook invalide → pas de crash (log erreur silencieux)', async () => {
    const svc = makeSvc({ slack_webhook_url: 'https://invalid.host.test/webhook' });
    nock('https://invalid.host.test').post('/webhook').replyWithError('ECONNREFUSED');

    await expect(svc.checkAndNotify('proj-6', 'neo-pilot', CRITICAL_SLA)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2 : Lancer les tests**

```bash
cd backend
npx jest tests/alerts.integration.test.js --verbose
```

Expected : 6 tests PASS

- [ ] **Step 3 : Vérifier que la suite complète passe**

```bash
npm test
```

Expected : toutes les suites passent.

- [ ] **Step 4 : Commit final**

```bash
git add tests/alerts.integration.test.js
git commit -m "test(alerts): integration tests with nock — real Slack HTTP path covered"
```

---

## Critères de succès

- `npm test` passe sans erreur sur les 3 nouveaux fichiers
- Aucun test ne fait d'appel réseau réel (`nock.disableNetConnect()` peut être activé globalement si souhaité)
- `_extractStepsFromNotes` : 9 cas couverts dont ordering [TEST]-last
- `syncRunStatusToGitLab` : 6 cas couverts dont 429, erreur partielle
- `checkAndNotify` : 6 cas couverts dont cooldown boundary, Slack 500, ECONNREFUSED
