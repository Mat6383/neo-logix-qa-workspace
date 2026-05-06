# N2 — Alertes Slack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Envoyer une notification Slack quand les métriques ISTQB franchissent un seuil SLA, avec cooldown par projet et config runtime via API + Dashboard8.

**Architecture:** `alerts.service.js` (config JSON + cooldown SQLite) intégré en fire-and-forget dans `saveSnapshot()` de `metrics-history.service.js`. Routes dédiées `alerts.routes.js`. Section UI dans Dashboard8.

**Tech Stack:** Node.js, better-sqlite3 (db existante), node-fetch (HTTP webhook), React + Lucide, Jest, Vitest

---

## File Map

| Action | Fichier | Rôle |
|--------|---------|------|
| CREATE | `backend/services/alerts.service.js` | Config JSON + cooldown SQLite + POST webhook Slack |
| CREATE | `backend/routes/alerts.routes.js` | GET/PUT /api/alerts/config + POST /api/alerts/test |
| CREATE | `backend/controllers/alerts.controller.js` | Handlers HTTP |
| MODIFY | `backend/validators/index.js` | Zod schema `alertsConfigBody` |
| MODIFY | `backend/services/metrics-history.service.js` | Appel fire-and-forget après INSERT |
| MODIFY | `backend/server.js` | Mount `/api/alerts` router |
| MODIFY | `frontend/src/services/api.service.js` | 3 méthodes : getAlertsConfig, updateAlertsConfig, testSlackAlert |
| MODIFY | `frontend/src/components/Dashboard8.jsx` | Section collapsible "Alertes Slack" |
| MODIFY | `frontend/src/styles/Dashboard8.css` | Styles section alertes |
| CREATE | `backend/tests/alerts.service.test.js` | Tests unitaires service |
| CREATE | `backend/tests/routes/alerts.routes.test.js` | Tests supertest routes |

---

## Task 1: alerts.service.js — squelette + config JSON

**Files:**
- Create: `backend/services/alerts.service.js`

- [ ] **Step 1: Écrire le test qui vérifie la config par défaut**

```js
// backend/tests/alerts.service.test.js
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');

function makeTmpConfigPath() {
  return path.join(os.tmpdir(), `alerts-cfg-${Date.now()}.json`);
}

// On importe la classe directement pour pouvoir injecter le configPath
const AlertsService = require('../services/alerts.service');

describe('AlertsService — config', () => {
  test('getConfig retourne la config par défaut si aucun fichier', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    const cfg = svc.getConfig();
    expect(cfg.enabled).toBe(false);
    expect(cfg.slack_webhook_url).toBe('');
    expect(cfg.cooldown_hours).toBe(4);
    expect(cfg.metrics.passRate_critical).toBe(true);
    expect(cfg.metrics.passRate_warning).toBe(false);
    expect(cfg.metrics.completionRate_warning).toBe(true);
    expect(cfg.metrics.blockedRate_warning).toBe(true);
  });

  test('saveConfig persiste et getConfig relit depuis fichier', () => {
    const cfgPath = makeTmpConfigPath();
    const svc = new AlertsService({ configPath: cfgPath, dbPath: ':memory:' });
    svc.saveConfig({ ...svc.getConfig(), enabled: true, slack_webhook_url: 'https://hooks.slack.com/test', cooldown_hours: 2 });
    // Nouvelle instance lit le même fichier
    const svc2 = new AlertsService({ configPath: cfgPath, dbPath: ':memory:' });
    const cfg = svc2.getConfig();
    expect(cfg.enabled).toBe(true);
    expect(cfg.slack_webhook_url).toBe('https://hooks.slack.com/test');
    expect(cfg.cooldown_hours).toBe(2);
    fs.unlinkSync(cfgPath);
  });
});
```

- [ ] **Step 2: Lancer le test — vérifier qu'il échoue**

```bash
cd backend && npx jest tests/alerts.service.test.js --no-coverage
```
Attendu : `Cannot find module '../services/alerts.service'`

- [ ] **Step 3: Créer `backend/services/alerts.service.js`**

```js
'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger.service');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'data', 'alerts-config.json');
const DEFAULT_DB_PATH = path.join(__dirname, '..', 'db', 'metrics-history.db');

function _defaultConfig() {
  return {
    enabled: false,
    slack_webhook_url: '',
    cooldown_hours: 4,
    metrics: {
      passRate_critical: true,
      passRate_warning: false,
      completionRate_warning: true,
      blockedRate_warning: true,
    },
  };
}

class AlertsService {
  constructor({ configPath, dbPath } = {}) {
    this._configPath = configPath || DEFAULT_CONFIG_PATH;
    this._dbPath = dbPath || DEFAULT_DB_PATH;
    this._config = this._loadConfig();
    this._db = null;
  }

  _loadConfig() {
    try {
      if (fs.existsSync(this._configPath)) {
        return JSON.parse(fs.readFileSync(this._configPath, 'utf-8'));
      }
    } catch (err) {
      logger.warn(`[Alerts] Impossible de lire config: ${err.message}`);
    }
    return _defaultConfig();
  }

  getConfig() {
    return { ...this._config, metrics: { ...this._config.metrics } };
  }

  saveConfig(config) {
    this._config = config;
    try {
      const dir = path.dirname(this._configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._configPath, JSON.stringify(config, null, 2), 'utf-8');
      logger.info('[Alerts] Config sauvegardée');
    } catch (err) {
      logger.error(`[Alerts] Impossible de sauvegarder config: ${err.message}`);
    }
  }
}

let _instance = null;
function getAlertsService() {
  if (!_instance) _instance = new AlertsService();
  return _instance;
}

module.exports = AlertsService;
module.exports.getAlertsService = getAlertsService;
```

- [ ] **Step 4: Lancer les tests — vérifier qu'ils passent**

```bash
cd backend && npx jest tests/alerts.service.test.js --no-coverage
```
Attendu : `PASS tests/alerts.service.test.js` — 2 tests verts

---

## Task 2: alerts.service.js — cooldown SQLite

**Files:**
- Modify: `backend/services/alerts.service.js`
- Modify: `backend/tests/alerts.service.test.js`

- [ ] **Step 1: Ajouter les tests cooldown**

Ajouter dans `backend/tests/alerts.service.test.js` :

```js
describe('AlertsService — cooldown', () => {
  test('_isCoolingDown retourne false si aucune entrée', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    expect(svc._isCoolingDown('proj-1', 4)).toBe(false);
  });

  test('_isCoolingDown retourne true si last_sent_at < cooldown_hours', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 min ago
    svc._db.prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)').run('proj-1', recent);
    expect(svc._isCoolingDown('proj-1', 4)).toBe(true);
  });

  test('_isCoolingDown retourne false si last_sent_at > cooldown_hours', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    const old = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(); // 5h ago
    svc._db.prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)').run('proj-1', old);
    expect(svc._isCoolingDown('proj-1', 4)).toBe(false);
  });

  test('_updateCooldown upsert last_sent_at', () => {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    svc._updateCooldown('proj-1');
    const row = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('proj-1');
    expect(row).toBeTruthy();
    expect(row.last_sent_at).toBeTruthy();
  });
});
```

- [ ] **Step 2: Lancer — vérifier échec**

```bash
cd backend && npx jest tests/alerts.service.test.js --no-coverage
```
Attendu : `_initDb is not a function` ou `_isCoolingDown is not a function`

- [ ] **Step 3: Ajouter `_initDb`, `_isCoolingDown`, `_updateCooldown` dans la classe**

Dans `AlertsService`, après le constructeur, ajouter :

```js
  _initDb() {
    if (this._db) return;
    try {
      const Database = require('better-sqlite3');
      this._db = new Database(this._dbPath);
      this._db.pragma('journal_mode = WAL');
      this._db.exec(`
        CREATE TABLE IF NOT EXISTS alert_cooldowns (
          project_id   TEXT PRIMARY KEY,
          last_sent_at TEXT NOT NULL
        )
      `);
    } catch (err) {
      logger.error(`[Alerts] Impossible d'initialiser SQLite: ${err.message}`);
    }
  }

  _isCoolingDown(projectId, cooldownHours) {
    if (!this._db) return false;
    const row = this._db
      .prepare('SELECT last_sent_at FROM alert_cooldowns WHERE project_id = ?')
      .get(String(projectId));
    if (!row) return false;
    const elapsed = (Date.now() - new Date(row.last_sent_at).getTime()) / 3600000;
    return elapsed < cooldownHours;
  }

  _updateCooldown(projectId) {
    if (!this._db) return;
    this._db
      .prepare('INSERT OR REPLACE INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)')
      .run(String(projectId), new Date().toISOString());
  }
```

Modifier le constructeur pour appeler `_initDb()` uniquement si le dbPath n'est pas `:memory:`. Pour les tests, on appelle `_initDb()` manuellement :

```js
  constructor({ configPath, dbPath } = {}) {
    this._configPath = configPath || DEFAULT_CONFIG_PATH;
    this._dbPath = dbPath || DEFAULT_DB_PATH;
    this._config = this._loadConfig();
    this._db = null;
    if (this._dbPath !== ':memory:') this._initDb();
  }
```

- [ ] **Step 4: Tests verts**

```bash
cd backend && npx jest tests/alerts.service.test.js --no-coverage
```
Attendu : `PASS` — 6 tests verts

---

## Task 3: alerts.service.js — checkAndNotify + sendSlack

**Files:**
- Modify: `backend/services/alerts.service.js`
- Modify: `backend/tests/alerts.service.test.js`

- [ ] **Step 1: Ajouter les tests checkAndNotify**

Ajouter dans `backend/tests/alerts.service.test.js` :

```js
describe('AlertsService — checkAndNotify', () => {
  function makeSvc(cfgOverride = {}) {
    const svc = new AlertsService({ configPath: makeTmpConfigPath(), dbPath: ':memory:' });
    svc._initDb();
    svc.saveConfig({ ...svc.getConfig(), ...cfgOverride });
    return svc;
  }

  const CRITICAL_SLA = {
    ok: false,
    alerts: [{ severity: 'critical', metric: 'Pass Rate', value: 80, threshold: 85, message: 'Pass rate critique: 80% < 85%' }],
  };

  const OK_SLA = { ok: true, alerts: [] };

  test('ne POST pas si disabled', async () => {
    const svc = makeSvc({ enabled: false });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('ne POST pas si slaStatus.ok = true', async () => {
    const svc = makeSvc({ enabled: true, slack_webhook_url: 'https://hooks.slack.com/x' });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', OK_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('ne POST pas si webhook URL vide', async () => {
    const svc = makeSvc({ enabled: true, slack_webhook_url: '' });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('ne POST pas si cooldown actif', async () => {
    const svc = makeSvc({ enabled: true, slack_webhook_url: 'https://hooks.slack.com/x', cooldown_hours: 4 });
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    svc._db.prepare('INSERT INTO alert_cooldowns (project_id, last_sent_at) VALUES (?, ?)').run('1', recent);
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });

  test('POST webhook et update cooldown si toutes conditions remplies', async () => {
    const svc = makeSvc({ enabled: true, slack_webhook_url: 'https://hooks.slack.com/x', cooldown_hours: 4 });
    svc._postWebhook = jest.fn().mockResolvedValue();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).toHaveBeenCalledTimes(1);
    const [url, payload] = svc._postWebhook.mock.calls[0];
    expect(url).toBe('https://hooks.slack.com/x');
    expect(payload.text).toContain('neo-pilot');
    expect(payload.text).toContain('Pass Rate');
    const cooldownRow = svc._db.prepare('SELECT * FROM alert_cooldowns WHERE project_id = ?').get('1');
    expect(cooldownRow).toBeTruthy();
  });

  test('filtre les alertes selon config metrics', async () => {
    const svc = makeSvc({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
      metrics: { passRate_critical: false, passRate_warning: false, completionRate_warning: false, blockedRate_warning: false },
    });
    svc._postWebhook = jest.fn();
    await svc.checkAndNotify('1', 'neo-pilot', CRITICAL_SLA);
    expect(svc._postWebhook).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Lancer — vérifier échec**

```bash
cd backend && npx jest tests/alerts.service.test.js --no-coverage
```
Attendu : `checkAndNotify is not a function`

- [ ] **Step 3: Implémenter `checkAndNotify`, `_buildPayload`, `_postWebhook`, `_alertMatchesConfig`**

Ajouter dans la classe `AlertsService` :

```js
  _alertMatchesConfig(alert) {
    const { metrics } = this._config;
    if (alert.metric === 'Pass Rate' && alert.severity === 'critical') return metrics.passRate_critical;
    if (alert.metric === 'Pass Rate' && alert.severity === 'warning')  return metrics.passRate_warning;
    if (alert.metric === 'Completion Rate')                             return metrics.completionRate_warning;
    if (alert.metric === 'Blocked Rate')                               return metrics.blockedRate_warning;
    return true;
  }

  _buildPayload(projectName, alerts) {
    const lines = alerts.map(a => `• ${a.severity.toUpperCase()} — ${a.message}`).join('\n');
    return {
      text: `🚨 [${projectName}] Alerte QA — ${alerts.length} problème(s) détecté(s)\n${lines}`,
    };
  }

  async _postWebhook(url, payload) {
    const fetch = require('node-fetch');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Slack webhook HTTP ${res.status}`);
  }

  async checkAndNotify(projectId, projectName, slaStatus) {
    const cfg = this.getConfig();
    if (!cfg.enabled || !cfg.slack_webhook_url || !slaStatus || slaStatus.ok) return;
    if (this._isCoolingDown(String(projectId), cfg.cooldown_hours)) return;

    const filtered = (slaStatus.alerts || []).filter(a => this._alertMatchesConfig(a));
    if (filtered.length === 0) return;

    const payload = this._buildPayload(projectName, filtered);
    try {
      await this._postWebhook(cfg.slack_webhook_url, payload);
      this._updateCooldown(String(projectId));
      logger.info(`[Alerts] Notification Slack envoyée pour projet ${projectName}`);
    } catch (err) {
      logger.error(`[Alerts] Échec envoi Slack: ${err.message}`);
    }
  }

  async sendTest() {
    const cfg = this.getConfig();
    if (!cfg.slack_webhook_url) {
      return { ok: false, error: 'Webhook URL non configurée' };
    }
    try {
      await this._postWebhook(cfg.slack_webhook_url, {
        text: '✅ [QA Dashboard] Test de connexion Slack OK',
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
```

- [ ] **Step 4: Installer node-fetch si absent**

```bash
cd backend && node -e "require('node-fetch')" 2>&1 || npm install node-fetch@2
```
Attendu : soit aucune erreur (déjà installé), soit installation réussie. On utilise node-fetch v2 (CommonJS).

- [ ] **Step 5: Tests verts**

```bash
cd backend && npx jest tests/alerts.service.test.js --no-coverage
```
Attendu : `PASS` — 12 tests verts

- [ ] **Step 6: Commit**

```bash
cd backend && git add services/alerts.service.js tests/alerts.service.test.js package.json package-lock.json
git commit -m "feat(n2): alerts.service — config JSON + cooldown SQLite + checkAndNotify"
```

---

## Task 4: Validator + Controller + Routes

**Files:**
- Modify: `backend/validators/index.js`
- Create: `backend/controllers/alerts.controller.js`
- Create: `backend/routes/alerts.routes.js`

- [ ] **Step 1: Ajouter le test de routes**

Créer `backend/tests/routes/alerts.routes.test.js` :

```js
'use strict';
const request = require('supertest');
const express = require('express');

// Mock alerts service AVANT require du router
jest.mock('../../services/alerts.service', () => {
  const mockSvc = {
    getConfig: jest.fn(() => ({
      enabled: false,
      slack_webhook_url: '',
      cooldown_hours: 4,
      metrics: { passRate_critical: true, passRate_warning: false, completionRate_warning: true, blockedRate_warning: true },
    })),
    saveConfig: jest.fn(),
    sendTest: jest.fn().mockResolvedValue({ ok: true }),
  };
  return { getAlertsService: () => mockSvc };
});

const alertsRouter = require('../../routes/alerts.routes');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/alerts', alertsRouter);
  return app;
}

describe('GET /api/alerts/config', () => {
  test('retourne la config', async () => {
    const res = await request(makeApp()).get('/api/alerts/config');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cooldown_hours).toBe(4);
  });
});

describe('PUT /api/alerts/config', () => {
  test('accepte un patch valide', async () => {
    const res = await request(makeApp())
      .put('/api/alerts/config')
      .send({ enabled: true, slack_webhook_url: 'https://hooks.slack.com/x', cooldown_hours: 2 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejette cooldown_hours < 1', async () => {
    const res = await request(makeApp())
      .put('/api/alerts/config')
      .send({ cooldown_hours: 0 });
    expect(res.status).toBe(400);
  });

  test('rejette cooldown_hours > 168', async () => {
    const res = await request(makeApp())
      .put('/api/alerts/config')
      .send({ cooldown_hours: 200 });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/alerts/test', () => {
  test('retourne ok: true', async () => {
    const res = await request(makeApp()).post('/api/alerts/test');
    expect(res.status).toBe(200);
    expect(res.body.data.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer — vérifier échec**

```bash
cd backend && npx jest tests/routes/alerts.routes.test.js --no-coverage
```
Attendu : `Cannot find module '../../routes/alerts.routes'`

- [ ] **Step 3: Ajouter le schema Zod dans `backend/validators/index.js`**

À la fin de la section `// ─── Body ───`, ajouter avant le `module.exports` :

```js
const alertsConfigBody = z.object({
  enabled: z.boolean().optional(),
  slack_webhook_url: z.string().url().or(z.literal('')).optional(),
  cooldown_hours: z.number().int().min(1).max(168).optional(),
  metrics: z
    .object({
      passRate_critical: z.boolean().optional(),
      passRate_warning: z.boolean().optional(),
      completionRate_warning: z.boolean().optional(),
      blockedRate_warning: z.boolean().optional(),
    })
    .optional(),
});
```

Ajouter `alertsConfigBody` dans le `module.exports` existant.

- [ ] **Step 4: Créer `backend/controllers/alerts.controller.js`**

```js
'use strict';

const { getAlertsService } = require('../services/alerts.service');
const logger = require('../services/logger.service');

function getConfig(_req, res) {
  const svc = getAlertsService();
  res.json({ success: true, data: svc.getConfig(), timestamp: new Date().toISOString() });
}

function updateConfig(req, res) {
  try {
    const svc = getAlertsService();
    const current = svc.getConfig();
    const { enabled, slack_webhook_url, cooldown_hours, metrics } = req.body;
    const updated = {
      ...current,
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      ...(slack_webhook_url !== undefined && { slack_webhook_url: String(slack_webhook_url).trim() }),
      ...(cooldown_hours !== undefined && { cooldown_hours: Number(cooldown_hours) }),
      ...(metrics && { metrics: { ...current.metrics, ...metrics } }),
    };
    svc.saveConfig(updated);
    logger.info(`[Alerts] Config mise à jour via API`);
    res.json({ success: true, data: svc.getConfig(), timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Erreur PUT /api/alerts/config:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

async function testAlert(_req, res) {
  try {
    const svc = getAlertsService();
    const result = await svc.sendTest();
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Erreur POST /api/alerts/test:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { getConfig, updateConfig, testAlert };
```

- [ ] **Step 5: Créer `backend/routes/alerts.routes.js`**

```js
'use strict';

const express = require('express');
const router = express.Router();
const { validateBody, alertsConfigBody } = require('../validators');
const { getConfig, updateConfig, testAlert } = require('../controllers/alerts.controller');

router.get('/config', getConfig);
router.put('/config', validateBody(alertsConfigBody), updateConfig);
router.post('/test', testAlert);

module.exports = router;
```

- [ ] **Step 6: Tests verts**

```bash
cd backend && npx jest tests/routes/alerts.routes.test.js --no-coverage
```
Attendu : `PASS` — 5 tests verts

- [ ] **Step 7: Commit**

```bash
git add backend/validators/index.js backend/controllers/alerts.controller.js backend/routes/alerts.routes.js backend/tests/routes/alerts.routes.test.js
git commit -m "feat(n2): alerts routes + controller + Zod validator"
```

---

## Task 5: Montage dans server.js + intégration metrics-history

**Files:**
- Modify: `backend/server.js`
- Modify: `backend/services/metrics-history.service.js`

- [ ] **Step 1: Monter le router dans `server.js`**

Ajouter avec les autres imports de routeurs (ligne ~36) :

```js
const alertsRouter = require('./routes/alerts.routes');
```

Ajouter avec les autres `app.use` (après la ligne `app.use('/api/feature-flags', featureFlagsRouter)`) :

```js
app.use('/api/alerts', alertsRouter);
```

- [ ] **Step 2: Vérifier que le serveur démarre sans erreur**

```bash
cd backend && node -e "require('./server')" 2>&1 | head -5
```
Attendu : lignes INFO de démarrage, pas d'erreur `Cannot find module`

- [ ] **Step 3: Intégrer dans `metrics-history.service.js::saveSnapshot()`**

Ajouter en haut du fichier (après les `require`) :

```js
let _alertsService = null;
function _getAlertsService() {
  if (!_alertsService) {
    try { _alertsService = require('./alerts.service').getAlertsService(); } catch (_) {}
  }
  return _alertsService;
}
```

Dans `saveSnapshot()`, après le `return this.db.prepare(...).get(result.lastInsertRowid)` final (la ligne qui retourne le row inséré), ajouter avant le `return` :

```js
    const inserted = this.db
      .prepare('SELECT * FROM metrics_snapshots WHERE id = ?')
      .get(result.lastInsertRowid);

    // Fire-and-forget: notif Slack si seuil SLA franchi
    if (snap.slaStatus) {
      const alertsSvc = _getAlertsService();
      if (alertsSvc) {
        alertsSvc.checkAndNotify(projectId, projectName, snap.slaStatus).catch(() => {});
      }
    }

    return inserted;
```

Supprimer la ligne `return this.db.prepare('SELECT * FROM metrics_snapshots WHERE id = ?').get(result.lastInsertRowid);` qui était là avant (elle est remplacée).

- [ ] **Step 4: Vérifier tests metrics-history toujours verts**

```bash
cd backend && npx jest tests/metrics-history.service.test.js --no-coverage
```
Attendu : `PASS` — tous les tests verts

- [ ] **Step 5: Commit**

```bash
git add backend/server.js backend/services/metrics-history.service.js
git commit -m "feat(n2): mount /api/alerts + fire-and-forget checkAndNotify in saveSnapshot"
```

---

## Task 6: Frontend — api.service.js + Dashboard8

**Files:**
- Modify: `frontend/src/services/api.service.js`
- Modify: `frontend/src/components/Dashboard8.jsx`
- Modify: `frontend/src/styles/Dashboard8.css`

- [ ] **Step 1: Ajouter les 3 méthodes dans `api.service.js`**

Dans `frontend/src/services/api.service.js`, après le bloc `// ---- Fin Dashboard 8 ---` :

```js
  // ---- Dashboard 8: Alertes Slack -----------------------------------------

  async getAlertsConfig() {
    try {
      const response = await apiClient.get('/alerts/config');
      return response.data.data;
    } catch (error) {
      throw this._handleError('Get Alerts Config', error);
    }
  },

  async updateAlertsConfig(patch) {
    try {
      const response = await apiClient.put('/alerts/config', patch);
      return response.data.data;
    } catch (error) {
      throw this._handleError('Update Alerts Config', error);
    }
  },

  async testSlackAlert() {
    try {
      const response = await apiClient.post('/alerts/test');
      return response.data.data;
    } catch (error) {
      throw this._handleError('Test Slack Alert', error);
    }
  },

  // ---- Fin Alertes Slack ---------------------------------------------------
```

- [ ] **Step 2: Ajouter la section "Alertes Slack" dans `Dashboard8.jsx`**

Ajouter ces imports Lucide dans les imports existants (ligne ~6) :
```js
  Bell, BellOff, Eye, EyeOff,
```
(Eye et EyeOff sont peut-être déjà présents — vérifier et n'ajouter que les manquants.)

Ajouter les states dans le composant principal `Dashboard8`, après les states existants :

```js
  const [alertsCfg, setAlertsCfg]         = useState(null);
  const [alertsForm, setAlertsForm]        = useState(null);
  const [alertsSaveStatus, setAlertsSaveStatus] = useState(null); // null | 'saving' | 'ok' | 'error'
  const [alertsTestStatus, setAlertsTestStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [showWebhook, setShowWebhook]      = useState(false);
  const [alertsOpen, setAlertsOpen]        = useState(false);
```

Ajouter le chargement de la config alertes dans `useEffect` (après le `loadConfig()` existant ou dans un `useEffect` dédié) :

```js
  useEffect(() => {
    apiService.getAlertsConfig()
      .then(cfg => { setAlertsCfg(cfg); setAlertsForm(cfg); })
      .catch(() => {});
  }, []);
```

Ajouter les handlers :

```js
  const handleAlertsSave = async () => {
    setAlertsSaveStatus('saving');
    try {
      const updated = await apiService.updateAlertsConfig(alertsForm);
      setAlertsCfg(updated);
      setAlertsForm(updated);
      setAlertsSaveStatus('ok');
      setTimeout(() => setAlertsSaveStatus(null), 3000);
    } catch {
      setAlertsSaveStatus('error');
    }
  };

  const handleAlertsTest = async () => {
    setAlertsTestStatus('testing');
    try {
      const result = await apiService.testSlackAlert();
      setAlertsTestStatus(result.ok ? 'ok' : 'error');
      setTimeout(() => setAlertsTestStatus(null), 4000);
    } catch {
      setAlertsTestStatus('error');
    }
  };
```

Ajouter la section JSX juste **avant** la balise de fermeture `</div>` finale du composant (avant `</div></div>` tout en bas) :

```jsx
      {/* ── Carte Alertes Slack ── */}
      {alertsForm && (
        <div className="d8-card d8-card--alerts">
          <div className="d8-card-title d8-card-title--collapsible" onClick={() => setAlertsOpen(o => !o)}>
            <Bell size={16} /> Alertes Slack
            <span className="d8-collapse-arrow">{alertsOpen ? '▲' : '▼'}</span>
          </div>

          {alertsOpen && (
            <div className="d8-alerts-body">
              {/* Toggle enabled */}
              <div className="d8-field">
                <label>Notifications</label>
                <button
                  className={`d8-toggle ${alertsForm.enabled ? 'd8-toggle--on' : ''}`}
                  onClick={() => setAlertsForm(f => ({ ...f, enabled: !f.enabled }))}
                >
                  {alertsForm.enabled
                    ? <><ToggleRight size={18} /> Activé</>
                    : <><ToggleLeft size={18} /> Désactivé</>}
                </button>
              </div>

              {/* Webhook URL */}
              <div className="d8-field">
                <label>Webhook URL</label>
                <div className="d8-input-row">
                  <input
                    type={showWebhook ? 'text' : 'password'}
                    className="d8-input"
                    placeholder="https://hooks.slack.com/services/..."
                    value={alertsForm.slack_webhook_url}
                    onChange={e => setAlertsForm(f => ({ ...f, slack_webhook_url: e.target.value }))}
                    disabled={!alertsForm.enabled}
                  />
                  <button className="d8-btn-icon" onClick={() => setShowWebhook(v => !v)}>
                    {showWebhook ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Cooldown */}
              <div className="d8-field">
                <label>Cooldown (heures)</label>
                <input
                  type="number"
                  className="d8-input d8-input--small"
                  min={1} max={168}
                  value={alertsForm.cooldown_hours}
                  onChange={e => setAlertsForm(f => ({ ...f, cooldown_hours: Number(e.target.value) }))}
                  disabled={!alertsForm.enabled}
                />
              </div>

              {/* Métriques surveillées */}
              <div className="d8-field">
                <label>Métriques surveillées</label>
                <div className="d8-checkboxes">
                  {[
                    { key: 'passRate_critical',    label: 'Pass Rate critique (< 85%)' },
                    { key: 'passRate_warning',     label: 'Pass Rate warning (< 90%)' },
                    { key: 'completionRate_warning', label: 'Completion Rate warning (< 80%)' },
                    { key: 'blockedRate_warning',  label: 'Blocked Rate warning (> 5%)' },
                  ].map(({ key, label }) => (
                    <label key={key} className="d8-checkbox-label">
                      <input
                        type="checkbox"
                        checked={alertsForm.metrics[key]}
                        onChange={e => setAlertsForm(f => ({
                          ...f,
                          metrics: { ...f.metrics, [key]: e.target.checked },
                        }))}
                        disabled={!alertsForm.enabled}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="d8-alerts-actions">
                <button className="d8-btn-primary" onClick={handleAlertsSave} disabled={alertsSaveStatus === 'saving'}>
                  {alertsSaveStatus === 'saving' ? <><RefreshCw size={14} className="spinning" /> Sauvegarde…</> : <><Save size={14} /> Sauvegarder</>}
                </button>
                <button className="d8-btn-secondary" onClick={handleAlertsTest} disabled={alertsTestStatus === 'testing' || !alertsForm.slack_webhook_url}>
                  {alertsTestStatus === 'testing' ? <><RefreshCw size={14} className="spinning" /> Test…</> : <><Zap size={14} /> Tester la connexion</>}
                </button>
              </div>

              {/* Feedback */}
              {alertsSaveStatus === 'ok' && <p className="d8-feedback d8-feedback--ok"><CheckCircle2 size={13} /> Config sauvegardée</p>}
              {alertsSaveStatus === 'error' && <p className="d8-feedback d8-feedback--error"><XCircle size={13} /> Erreur lors de la sauvegarde</p>}
              {alertsTestStatus === 'ok' && <p className="d8-feedback d8-feedback--ok"><CheckCircle2 size={13} /> Message Slack envoyé ✅</p>}
              {alertsTestStatus === 'error' && <p className="d8-feedback d8-feedback--error"><XCircle size={13} /> Échec — vérifier le webhook URL</p>}
            </div>
          )}
        </div>
      )}
```

- [ ] **Step 3: Ajouter les styles dans `Dashboard8.css`**

À la fin de `frontend/src/styles/Dashboard8.css`, ajouter :

```css
/* ── Alertes Slack ──────────────────────────────────────────── */
.d8-card--alerts { border-left: 3px solid #f59e0b; }

.d8-card-title--collapsible {
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 8px;
}
.d8-collapse-arrow { margin-left: auto; font-size: 11px; }

.d8-alerts-body { display: flex; flex-direction: column; gap: 14px; margin-top: 12px; }

.d8-input-row { display: flex; gap: 6px; align-items: center; }
.d8-input { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border, #e5e7eb); background: var(--bg-input, #fff); font-size: 13px; flex: 1; }
.d8-input--small { width: 80px; flex: none; }
.d8-btn-icon { background: transparent; border: 1px solid var(--border, #e5e7eb); border-radius: 6px; padding: 5px 8px; cursor: pointer; }

.d8-checkboxes { display: flex; flex-direction: column; gap: 6px; }
.d8-checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }
.d8-checkbox-label input { cursor: pointer; }

.d8-alerts-actions { display: flex; gap: 10px; flex-wrap: wrap; }

.d8-feedback { font-size: 12px; display: flex; align-items: center; gap: 5px; margin: 0; }
.d8-feedback--ok    { color: #16a34a; }
.d8-feedback--error { color: #dc2626; }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.service.js frontend/src/components/Dashboard8.jsx frontend/src/styles/Dashboard8.css
git commit -m "feat(n2): Dashboard8 — section Alertes Slack (toggle, webhook, cooldown, métriques)"
```

---

## Task 7: Tests frontend Dashboard8

**Files:**
- Modify: `frontend/src/tests/Dashboard8.test.jsx` (créer si absent)

- [ ] **Step 1: Vérifier si un test Dashboard8 existe**

```bash
ls frontend/src/tests/ 2>/dev/null || ls frontend/tests/ 2>/dev/null || find frontend -name "Dashboard8*test*" -o -name "Dashboard8*spec*" 2>/dev/null
```

- [ ] **Step 2: Créer/compléter le fichier de test**

Si le fichier n'existe pas, créer `frontend/src/tests/Dashboard8.alerts.test.jsx` :

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard8 from '../components/Dashboard8';
import apiService from '../services/api.service';

vi.mock('../services/api.service', () => ({
  default: {
    getAutoSyncConfig: vi.fn().mockResolvedValue({ enabled: false, runId: null, iterationName: '', gitlabProjectId: '', version: '' }),
    getAlertsConfig: vi.fn().mockResolvedValue({
      enabled: false,
      slack_webhook_url: '',
      cooldown_hours: 4,
      metrics: { passRate_critical: true, passRate_warning: false, completionRate_warning: true, blockedRate_warning: true },
    }),
    updateAlertsConfig: vi.fn().mockResolvedValue({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
      metrics: { passRate_critical: true, passRate_warning: false, completionRate_warning: true, blockedRate_warning: true },
    }),
    testSlackAlert: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

describe('Dashboard8 — section Alertes Slack', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('affiche le titre "Alertes Slack" après chargement', async () => {
    render(<Dashboard8 isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Alertes Slack/i)).toBeInTheDocument());
  });

  it('ouvre la section au clic sur le titre', async () => {
    render(<Dashboard8 isDark={false} />);
    await waitFor(() => screen.getByText(/Alertes Slack/i));
    fireEvent.click(screen.getByText(/Alertes Slack/i).closest('div'));
    await waitFor(() => expect(screen.getByPlaceholderText(/hooks.slack.com/i)).toBeInTheDocument());
  });

  it('bouton Tester appelle testSlackAlert et affiche feedback ok', async () => {
    render(<Dashboard8 isDark={false} />);
    await waitFor(() => screen.getByText(/Alertes Slack/i));
    fireEvent.click(screen.getByText(/Alertes Slack/i).closest('div'));
    await waitFor(() => screen.getByText(/Tester la connexion/i));
    fireEvent.click(screen.getByText(/Tester la connexion/i));
    await waitFor(() => expect(screen.getByText(/Message Slack envoyé/i)).toBeInTheDocument());
    expect(apiService.testSlackAlert).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Lancer les tests frontend**

```bash
cd frontend && npx vitest run src/tests/Dashboard8.alerts.test.jsx 2>&1 | tail -20
```
Attendu : `PASS` — 3 tests verts

- [ ] **Step 4: Lancer tous les tests backend pour non-régression**

```bash
cd backend && npm test 2>&1 | tail -20
```
Attendu : tous verts, total ≥ 516 tests (501 existants + 12 alertes.service + 5 alerts.routes = 518)

- [ ] **Step 5: Commit final + ROADMAP update**

```bash
git add frontend/src/tests/Dashboard8.alerts.test.jsx
git commit -m "test(n2): tests frontend Dashboard8 alertes Slack"
```

Mettre à jour `ROADMAP.md` : changer `N2 | ⬜ todo` → `N2 | ✅ done` et ajouter la session dans le tableau :

```bash
git add ROADMAP.md
git commit -m "docs(roadmap): N2 ✅ done — alertes Slack"
```

---

## Vérification finale

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npx vitest run

# Smoke test API (backend démarré)
curl -s http://localhost:3001/api/alerts/config | jq .
curl -s -X PUT http://localhost:3001/api/alerts/config \
  -H "Content-Type: application/json" \
  -d '{"enabled":false,"slack_webhook_url":"","cooldown_hours":4}' | jq .
```
