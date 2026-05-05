# Q2 — Supertest Routes API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Couvrir tous les endpoints HTTP du backend Express avec des tests supertest — valider les 400 Zod, les 403 CSRF, et les 200 via mocks.

**Architecture:** `server.js` exporte déjà `app` (ligne 292) mais appelle `app.listen()` inconditionnellement. On ajoute un guard `require.main === module`, on installe supertest, et on crée un fichier de setup Jest pour les env vars. Chaque fichier de test correspond à un router et mocke les services/controllers dont il dépend. `jest.config.js` centralise le tout avec `forceExit: true` (pour le cron node-cron qui reste ouvert).

**Tech Stack:** Jest 29, supertest (à installer), jest.mock() avec factory, forceExit pour handles node-cron.

---

## File Map

| Fichier | Action | Rôle |
|---------|--------|------|
| `backend/server.js` | Modifier | Guard `app.listen()` avec `require.main === module` (ligne 263) |
| `backend/jest.config.js` | Créer | testMatch, setupFiles, forceExit |
| `backend/tests/helpers/setup.js` | Créer | Env vars minimaux pour charger server.js |
| `backend/tests/routes/health.routes.test.js` | Créer | `GET /api/health` + 404 générique |
| `backend/tests/routes/featureflags-cache.routes.test.js` | Créer | `GET /api/feature-flags`, `POST /api/cache/clear` |
| `backend/tests/routes/projects.routes.test.js` | Créer | 4 endpoints `/api/projects` |
| `backend/tests/routes/runs.routes.test.js` | Créer | 2 endpoints `/api/runs` |
| `backend/tests/routes/dashboard.routes.test.js` | Créer | 3 endpoints `/api/dashboard` |
| `backend/tests/routes/sync.routes.test.js` | Créer | 10 endpoints `/api/sync` |
| `backend/tests/routes/reports.routes.test.js` | Créer | `POST /api/reports/generate` |
| `backend/tests/routes/crosstest.routes.test.js` | Créer | 6 endpoints `/api/crosstest` |

---

## Task 1: Setup (supertest + jest.config.js + server.js)

**Files:**
- Modify: `backend/server.js:263`
- Create: `backend/jest.config.js`
- Create: `backend/tests/helpers/setup.js`

- [ ] **Step 1: Installer supertest**

```bash
cd backend
npm install --save-dev supertest
```

Expected: `supertest` apparaît dans `devDependencies` de `package.json`.

- [ ] **Step 2: Créer `backend/jest.config.js`**

```js
'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/setup.js'],
  forceExit: true,
};
```

- [ ] **Step 3: Créer `backend/tests/helpers/setup.js`**

```js
'use strict';

// Variables minimales pour que server.js passe son check REQUIRED_ENV
// sans .env (dotenv ne remplace pas les vars déjà définies)
process.env.TESTMO_URL = process.env.TESTMO_URL || 'http://mock-testmo.test';
process.env.TESTMO_TOKEN = process.env.TESTMO_TOKEN || 'mock-testmo-token';
process.env.GITLAB_URL = process.env.GITLAB_URL || 'http://mock-gitlab.test';
process.env.GITLAB_TOKEN = process.env.GITLAB_TOKEN || 'mock-gitlab-token';
process.env.NODE_ENV = 'test';
```

- [ ] **Step 4: Modifier `backend/server.js` — guard app.listen()**

Remplacer les lignes 263–279 :
```js
// AVANT
app.listen(PORT, () => {
  logger.info(`
╔════════════════════════════════════════════════╗
...
  `);
  logger.info('Server ready to accept connections');
});
```

Par :
```js
// APRÈS
if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`
╔════════════════════════════════════════════════╗
║   TESTMO DASHBOARD - Backend Server Started   ║
╠════════════════════════════════════════════════╣
║  Port:        ${PORT}                            
║  Environment: ${process.env.NODE_ENV || 'development'}                   
║  Testmo URL:  ${process.env.TESTMO_URL}        
║  Frontend:    ${process.env.FRONTEND_URL || 'http://localhost:3000'}    
╠════════════════════════════════════════════════╣
║  Standards: ISTQB | LEAN | ITIL | DevOps      ║
║  Author: Matou - Neo-Logix QA Lead            ║
╚════════════════════════════════════════════════╝
    `);
    logger.info('Server ready to accept connections');
  });
}
```

- [ ] **Step 5: Vérifier que les tests existants passent toujours**

```bash
cd backend
npm test
```

Expected: `367 tests passed` (ou plus si des tests étaient en attente), 0 failed.

- [ ] **Step 6: Commit**

```bash
git add backend/jest.config.js backend/tests/helpers/setup.js backend/server.js backend/package.json backend/package-lock.json
git commit -m "test(setup): install supertest, jest.config.js, guard app.listen()"
```

---

## Task 2: Tests health + featureFlags + cache

**Files:**
- Create: `backend/tests/routes/health.routes.test.js`
- Create: `backend/tests/routes/featureflags-cache.routes.test.js`

- [ ] **Step 1: Écrire les tests health (failing)**

Créer `backend/tests/routes/health.routes.test.js` :
```js
'use strict';

const request = require('supertest');
const app = require('../../server');

describe('GET /api/health', () => {
  test('200 avec status OK, timestamp, uptime, environment, version', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'OK',
      environment: 'test',
      version: '1.0.0',
    });
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('404 — route inexistante', () => {
  test('GET /api/nonexistent → 404 avec success: false', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });
});
```

- [ ] **Step 2: Écrire les tests featureFlags + cache (failing)**

Créer `backend/tests/routes/featureflags-cache.routes.test.js` :
```js
'use strict';

const request = require('supertest');

jest.mock('../../services/testmo.service', () => ({
  clearCache: jest.fn(),
  getProjects: jest.fn(),
  getProjectRuns: jest.fn(),
  getProjectMilestones: jest.fn(),
  getAutomationRuns: jest.fn(),
  getRunDetails: jest.fn(),
  getRunResults: jest.fn(),
  getDashboardMetrics: jest.fn(),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('GET /api/feature-flags', () => {
  test('200 avec objet flags', async () => {
    const res = await request(app).get('/api/feature-flags');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('flags');
    expect(res.body.flags).toHaveProperty('syncEnabled');
    expect(res.body.flags).toHaveProperty('tvModeEnabled');
    expect(res.body.flags).toHaveProperty('crossTestEnabled');
    expect(res.body.flags).toHaveProperty('reportEnabled');
  });
});

describe('POST /api/cache/clear', () => {
  test('403 sans X-Requested-With', async () => {
    const res = await request(app).post('/api/cache/clear');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 avec X-Requested-With', async () => {
    const res = await request(app).post('/api/cache/clear').set(CSRF);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils passent**

```bash
cd backend
npx jest tests/routes/health.routes.test.js tests/routes/featureflags-cache.routes.test.js --verbose
```

Expected: `5 tests passed`, 0 failed.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/routes/health.routes.test.js backend/tests/routes/featureflags-cache.routes.test.js
git commit -m "test(routes): health, featureFlags, cache — 200/403 supertest"
```

---

## Task 3: Tests projects routes

**Files:**
- Create: `backend/tests/routes/projects.routes.test.js`

- [ ] **Step 1: Écrire les tests projects (failing)**

Créer `backend/tests/routes/projects.routes.test.js` :
```js
'use strict';

const request = require('supertest');

const mockTestmo = {
  getProjects: jest.fn(),
  getProjectRuns: jest.fn(),
  getProjectMilestones: jest.fn(),
  getAutomationRuns: jest.fn(),
  clearCache: jest.fn(),
  getRunDetails: jest.fn(),
  getRunResults: jest.fn(),
};

jest.mock('../../services/testmo.service', () => mockTestmo);

const app = require('../../server');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/projects', () => {
  test('200 avec liste de projets', async () => {
    mockTestmo.getProjects.mockResolvedValue([{ id: 1, name: 'Neo Pilot' }]);
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('500 quand le service lève une erreur', async () => {
    mockTestmo.getProjects.mockRejectedValue(new Error('Testmo down'));
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('GET /api/projects/:projectId/runs', () => {
  test('400 — projectId non numérique (abc)', async () => {
    const res = await request(app).get('/api/projects/abc/runs');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — projectId négatif (-1)', async () => {
    const res = await request(app).get('/api/projects/-1/runs');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — projectId zéro', async () => {
    const res = await request(app).get('/api/projects/0/runs');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — query active invalide', async () => {
    const res = await request(app).get('/api/projects/1/runs?active=maybe');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    mockTestmo.getProjectRuns.mockResolvedValue([]);
    const res = await request(app).get('/api/projects/1/runs');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/projects/:projectId/milestones', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/projects/abc/milestones');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    mockTestmo.getProjectMilestones.mockResolvedValue([]);
    const res = await request(app).get('/api/projects/1/milestones');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/projects/:projectId/automation', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/projects/abc/automation');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    mockTestmo.getAutomationRuns.mockResolvedValue([]);
    const res = await request(app).get('/api/projects/1/automation');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
```

- [ ] **Step 2: Lancer et vérifier**

```bash
cd backend
npx jest tests/routes/projects.routes.test.js --verbose
```

Expected: `11 tests passed`, 0 failed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/projects.routes.test.js
git commit -m "test(routes): projects — 400 Zod, 500 erreur service, 200 mock"
```

---

## Task 4: Tests runs routes

**Files:**
- Create: `backend/tests/routes/runs.routes.test.js`

- [ ] **Step 1: Écrire les tests (failing)**

Créer `backend/tests/routes/runs.routes.test.js` :
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
};

jest.mock('../../services/testmo.service', () => mockTestmo);

const app = require('../../server');

beforeEach(() => jest.clearAllMocks());

describe('GET /api/runs/:runId', () => {
  test('400 — runId non numérique', async () => {
    const res = await request(app).get('/api/runs/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — runId zéro', async () => {
    const res = await request(app).get('/api/runs/0');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — runId valide', async () => {
    mockTestmo.getRunDetails.mockResolvedValue({ id: 42, name: 'Run 42' });
    const res = await request(app).get('/api/runs/42');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('500 — service lève une erreur', async () => {
    mockTestmo.getRunDetails.mockRejectedValue(new Error('timeout'));
    const res = await request(app).get('/api/runs/1');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false });
  });
});

describe('GET /api/runs/:runId/results', () => {
  test('400 — runId invalide', async () => {
    const res = await request(app).get('/api/runs/abc/results');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — runId valide sans filtre status', async () => {
    mockTestmo.getRunResults.mockResolvedValue([]);
    const res = await request(app).get('/api/runs/42/results');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('200 — runId valide avec filtre status', async () => {
    mockTestmo.getRunResults.mockResolvedValue([]);
    const res = await request(app).get('/api/runs/42/results?status=3,5');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
```

- [ ] **Step 2: Lancer et vérifier**

```bash
cd backend
npx jest tests/routes/runs.routes.test.js --verbose
```

Expected: `7 tests passed`, 0 failed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/runs.routes.test.js
git commit -m "test(routes): runs — 400 Zod, 500 erreur service, 200 mock"
```

---

## Task 5: Tests dashboard routes

**Files:**
- Create: `backend/tests/routes/dashboard.routes.test.js`

- [ ] **Step 1: Écrire les tests (failing)**

Créer `backend/tests/routes/dashboard.routes.test.js` :
```js
'use strict';

const request = require('supertest');

jest.mock('../../controllers/dashboard.controller', () => ({
  getMetrics: jest.fn((_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() })
  ),
  getQualityRates: jest.fn((_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() })
  ),
  getAnnualTrends: jest.fn((_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() })
  ),
}));

const app = require('../../server');

describe('GET /api/dashboard/:projectId', () => {
  test('400 — projectId non numérique', async () => {
    const res = await request(app).get('/api/dashboard/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — projectId zéro', async () => {
    const res = await request(app).get('/api/dashboard/0');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/dashboard/1');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('Cache-Control header présent', async () => {
    const res = await request(app).get('/api/dashboard/1');
    expect(res.headers['cache-control']).toBe('private, max-age=120');
  });
});

describe('GET /api/dashboard/:projectId/quality-rates', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/dashboard/abc/quality-rates');
    expect(res.status).toBe(400);
  });

  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/dashboard/1/quality-rates');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/dashboard/:projectId/annual-trends', () => {
  test('400 — projectId invalide', async () => {
    const res = await request(app).get('/api/dashboard/abc/annual-trends');
    expect(res.status).toBe(400);
  });

  test('200 — projectId valide avec Cache-Control 5min', async () => {
    const res = await request(app).get('/api/dashboard/1/annual-trends');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, max-age=300');
  });
});
```

- [ ] **Step 2: Lancer et vérifier**

```bash
cd backend
npx jest tests/routes/dashboard.routes.test.js --verbose
```

Expected: `8 tests passed`, 0 failed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/dashboard.routes.test.js
git commit -m "test(routes): dashboard — 400 Zod, 200 mock controller, Cache-Control"
```

---

## Task 6: Tests sync routes

**Files:**
- Create: `backend/tests/routes/sync.routes.test.js`

- [ ] **Step 1: Écrire les tests (failing)**

Créer `backend/tests/routes/sync.routes.test.js` :
```js
'use strict';

const request = require('supertest');

jest.mock('../../controllers/sync.controller', () => ({
  getProjects: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  getIterations: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  previewSync: (_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() }),
  executeSync: (_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() }),
  getHistory: (_req, res) =>
    res.json({ success: true, data: [], timestamp: new Date().toISOString() }),
  testApi: (_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() }),
  syncIteration: (_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() }),
  statusToGitlab: (_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() }),
  testCleanup: (_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() }),
  getAutoConfig: (_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() }),
  updateAutoConfig: (_req, res) =>
    res.json({ success: true, data: {}, timestamp: new Date().toISOString() }),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('GET /api/sync/projects', () => {
  test('200 — liste des projets configurés', async () => {
    const res = await request(app).get('/api/sync/projects');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('GET /api/sync/:projectId/iterations', () => {
  test('400 — projectId vide (string min 1)', async () => {
    // Un espace est encodé %20 — mais la route est /:projectId
    // On teste via query invalide plutôt (search trop long)
    const longSearch = 'a'.repeat(101);
    const res = await request(app).get(`/api/sync/neo-pilot/iterations?search=${longSearch}`);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — projectId valide', async () => {
    const res = await request(app).get('/api/sync/neo-pilot/iterations');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('POST /api/sync/preview', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/preview')
      .send({ projectId: 'neo-pilot', iterationName: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — body vide', async () => {
    const res = await request(app).post('/api/sync/preview').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationName manquant', async () => {
    const res = await request(app)
      .post('/api/sync/preview')
      .set(CSRF)
      .send({ projectId: 'neo-pilot' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/sync/preview')
      .set(CSRF)
      .send({ projectId: 'neo-pilot', iterationName: 'R01' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/sync/execute', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/execute')
      .send({ projectId: 'neo-pilot', iterationName: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — projectId manquant', async () => {
    const res = await request(app)
      .post('/api/sync/execute')
      .set(CSRF)
      .send({ iterationName: 'R01' });
    expect(res.status).toBe(400);
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/sync/execute')
      .set(CSRF)
      .send({ projectId: 'neo-pilot', iterationName: 'R01' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/sync/history', () => {
  test('200 — liste historique', async () => {
    const res = await request(app).get('/api/sync/history');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('POST /api/sync/iteration', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/iteration')
      .send({ iteration: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — iteration manquant', async () => {
    const res = await request(app).post('/api/sync/iteration').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/sync/iteration')
      .set(CSRF)
      .send({ iteration: 'R01' });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/sync/status-to-gitlab', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .send({ runId: 1, gitlabProjectId: '123', iterationName: 'R01' });
    expect(res.status).toBe(403);
  });

  test('400 — runId manquant', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ gitlabProjectId: '123', iterationName: 'R01' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationName ET version absents', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ runId: 1, gitlabProjectId: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('iterationName ou version requis');
  });

  test('200 — body valide avec iterationName', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ runId: 1, gitlabProjectId: '123', iterationName: 'R01' });
    expect(res.status).toBe(200);
  });

  test('200 — body valide avec version à la place d\'iterationName', async () => {
    const res = await request(app)
      .post('/api/sync/status-to-gitlab')
      .set(CSRF)
      .send({ runId: 1, gitlabProjectId: '123', version: '1.2.3' });
    expect(res.status).toBe(200);
  });
});

describe('GET /api/sync/auto-config', () => {
  test('200 — retourne la config courante', async () => {
    const res = await request(app).get('/api/sync/auto-config');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('PUT /api/sync/auto-config', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .put('/api/sync/auto-config')
      .send({ enabled: true });
    expect(res.status).toBe(403);
  });

  test('400 — body vide (aucun champ valide)', async () => {
    const res = await request(app).put('/api/sync/auto-config').set(CSRF).send({});
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — au moins un champ valide', async () => {
    const res = await request(app)
      .put('/api/sync/auto-config')
      .set(CSRF)
      .send({ enabled: false });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Lancer et vérifier**

```bash
cd backend
npx jest tests/routes/sync.routes.test.js --verbose
```

Expected: `21 tests passed`, 0 failed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/sync.routes.test.js
git commit -m "test(routes): sync — 403 CSRF, 400 Zod, 200 mock controller (21 tests)"
```

---

## Task 7: Tests reports routes

**Files:**
- Create: `backend/tests/routes/reports.routes.test.js`

- [ ] **Step 1: Écrire les tests (failing)**

Créer `backend/tests/routes/reports.routes.test.js` :
```js
'use strict';

const request = require('supertest');

jest.mock('../../controllers/reports.controller', () => ({
  generateReport: jest.fn((_req, res) =>
    res.json({ success: true, timestamp: new Date().toISOString() })
  ),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('POST /api/reports/generate', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .send({ projectId: 1, milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(403);
  });

  test('400 — projectId manquant', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — milestoneId manquant', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: 1, formats: { html: true } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — formats vide (aucun format sélectionné)', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: 1, milestoneId: 2, formats: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Au moins un format (html/pptx) requis');
  });

  test('400 — projectId négatif', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: -1, milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide avec format html', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({ projectId: 1, milestoneId: 2, formats: { html: true } });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });

  test('200 — body valide avec format pptx et recommendations', async () => {
    const res = await request(app)
      .post('/api/reports/generate')
      .set(CSRF)
      .send({
        projectId: 1,
        milestoneId: 2,
        formats: { pptx: true },
        recommendations: 'Améliorer la couverture',
      });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Lancer et vérifier**

```bash
cd backend
npx jest tests/routes/reports.routes.test.js --verbose
```

Expected: `7 tests passed`, 0 failed.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/routes/reports.routes.test.js
git commit -m "test(routes): reports — 403 CSRF, 400 Zod formats/ids, 200 mock"
```

---

## Task 8: Tests crosstest routes

**Files:**
- Create: `backend/tests/routes/crosstest.routes.test.js`

- [ ] **Step 1: Écrire les tests (failing)**

Créer `backend/tests/routes/crosstest.routes.test.js` :
```js
'use strict';

const request = require('supertest');

jest.mock('../../services/gitlab.service', () => ({
  searchIterations: jest.fn().mockResolvedValue([]),
  getIssuesByLabelAndIterationForProject: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../services/comments.service', () => ({
  getAll: jest.fn().mockReturnValue({}),
  upsert: jest.fn().mockReturnValue({ id: 1, issue_iid: 1, comment: 'test', milestone_context: null }),
  delete: jest.fn().mockReturnValue(true),
}));

const app = require('../../server');

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };

describe('GET /api/crosstest/iterations', () => {
  test('200 — liste des itérations', async () => {
    const res = await request(app).get('/api/crosstest/iterations');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/crosstest/issues/:iterationId', () => {
  test('400 — iterationId non numérique', async () => {
    const res = await request(app).get('/api/crosstest/issues/abc');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — iterationId zéro', async () => {
    const res = await request(app).get('/api/crosstest/issues/0');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — iterationId valide', async () => {
    const res = await request(app).get('/api/crosstest/issues/42');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/crosstest/comments', () => {
  test('200 — retourne tous les commentaires', async () => {
    const res = await request(app).get('/api/crosstest/comments');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('POST /api/crosstest/comments', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .send({ issue_iid: 1, comment: 'test' });
    expect(res.status).toBe(403);
  });

  test('400 — issue_iid manquant', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .set(CSRF)
      .send({ comment: 'test' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — comment vide', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .set(CSRF)
      .send({ issue_iid: 1, comment: '' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .post('/api/crosstest/comments')
      .set(CSRF)
      .send({ issue_iid: 1, comment: 'Tout bon' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('PUT /api/crosstest/comments/:iid', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app)
      .put('/api/crosstest/comments/1')
      .send({ comment: 'updated' });
    expect(res.status).toBe(403);
  });

  test('400 — iid non numérique', async () => {
    const res = await request(app)
      .put('/api/crosstest/comments/abc')
      .set(CSRF)
      .send({ comment: 'updated' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('400 — comment vide', async () => {
    const res = await request(app)
      .put('/api/crosstest/comments/1')
      .set(CSRF)
      .send({ comment: '' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — body valide', async () => {
    const res = await request(app)
      .put('/api/crosstest/comments/1')
      .set(CSRF)
      .send({ comment: 'updated comment' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe('DELETE /api/crosstest/comments/:iid', () => {
  test('403 — sans X-Requested-With', async () => {
    const res = await request(app).delete('/api/crosstest/comments/1');
    expect(res.status).toBe(403);
  });

  test('400 — iid non numérique', async () => {
    const res = await request(app)
      .delete('/api/crosstest/comments/abc')
      .set(CSRF);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false });
  });

  test('200 — iid valide', async () => {
    const res = await request(app)
      .delete('/api/crosstest/comments/1')
      .set(CSRF);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});
```

- [ ] **Step 2: Lancer et vérifier**

```bash
cd backend
npx jest tests/routes/crosstest.routes.test.js --verbose
```

Expected: `15 tests passed`, 0 failed.

- [ ] **Step 3: Lancer la suite complète**

```bash
cd backend
npm test
```

Expected: tous les tests existants + nouveaux tests supertest passent. Le total de tests augmente d'environ +74 tests.

- [ ] **Step 4: Commit final**

```bash
git add backend/tests/routes/crosstest.routes.test.js
git commit -m "test(routes): crosstest — 403 CSRF, 400 Zod params/body, 200 mock services"
```

---

## Self-Review

**Spec coverage:**
- ✅ 400 Zod: params (projectId, runId, iterationId, iid), query (active, search), body (tous les schémas)
- ✅ 403 CSRF: tous les endpoints POST/PUT/DELETE couverts
- ✅ 200 success: mock service ou controller pour chaque endpoint
- ✅ 500 error: GET /api/projects et GET /api/runs/:runId
- ✅ Refinements Zod testés: `syncStatusToGitlabBody` (iterationName|version), `reportsGenerateBody` (format), `autoConfigBody` (empty body)
- ✅ Cache-Control headers: dashboard (2min, 5min)

**Placeholders:** aucun — chaque step contient le code complet.

**Type consistency:** `mockTestmo` défini en Task 3 est un objet ordinaire (pas de class), réutilisé tel quel. Les mocks de controllers en Task 5/6/7 sont cohérents dans leurs signatures `(_req, res) => res.json(...)`.
