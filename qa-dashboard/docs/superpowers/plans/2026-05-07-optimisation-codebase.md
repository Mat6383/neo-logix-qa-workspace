# Optimisation Codebase QA Dashboard — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger 12 problèmes identifiés par audit (critiques → moyens → faibles), dans l'ordre de priorité, sans casser les fonctionnalités existantes.

**Architecture:** Fixes progressifs — d'abord les comportements (sécurité/perf), puis les structures (refactoring), puis les utilitaires partagés. Chaque task est indépendante et commitée séparément.

**Tech Stack:** Node.js/Express (backend), React 18 + Vite (frontend), Jest (backend tests), Vitest (frontend tests)

---

## Pré-requis vérifiés lors de l'audit

- `docx`, `pptxgenjs`, `marked`, `sanitize-html` → **tous utilisés**, ne pas supprimer
- `setExportHandler` dans DashboardPrincipal → React state setter stable → pas de boucle infinie, mais stale closure sur `isDark`
- Le global error handler dans `server.js:182` masque déjà `error.message` en prod — les routes doivent déléguer via `next(error)` au lieu de répondre directement

---

## GROUPE 1 — Critiques comportementaux (sécurité / perf réelle)

### Task 1 : Supprimer les console.log en production — `api.service.js`

**Files:**
- Modify: `frontend/src/services/api.service.js:26-48, 542-546`

- [ ] **Step 1 : Vérifier le test existant**

```bash
cd frontend && npx vitest run src/services --passWithNoTests 2>/dev/null | tail -5
```

- [ ] **Step 2 : Modifier api.service.js**

Remplacer le bloc intercepteurs (lignes 25-48) :

```js
// Intercepteur pour logging — dev uniquement
if (import.meta.env.DEV) {
  apiClient.interceptors.request.use(
    config => {
      console.log(`[API] ${config.method.toUpperCase()} ${config.url}`);
      return config;
    },
    error => {
      console.error('[API] Request error:', error);
      return Promise.reject(error);
    }
  );

  apiClient.interceptors.response.use(
    response => {
      console.log(`[API] Response:`, response.status, response.data);
      return response;
    },
    error => {
      if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return Promise.reject(error);
      }
      console.error('[API] Response error:', error.response?.data || error.message);
      return Promise.reject(error);
    }
  );
} else {
  apiClient.interceptors.response.use(
    response => response,
    error => {
      if (error.name === 'CanceledError' || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return Promise.reject(error);
      }
      return Promise.reject(error);
    }
  );
}
```

Remplacer `_handleError` (lignes 542-546) :

```js
_handleError(operation, error) {
  const errorMessage = error.response?.data?.error || error.message;
  if (import.meta.env.DEV) {
    console.error(`[API Service] ${operation} failed:`, errorMessage);
  }
  return new Error(`${operation}: ${errorMessage}`);
}
```

- [ ] **Step 3 : Lancer les tests frontend**

```bash
cd frontend && npm test
```
Expected : tous les tests passent (aucun test ne teste les console.log)

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/services/api.service.js
git commit -m "perf: gate API console.log/error behind import.meta.env.DEV"
```

---

### Task 2 : Fix O(n²) concat en boucle — `istqb-metrics.service.js`

**Files:**
- Modify: `backend/services/istqb-metrics.service.js:117-122, 401-412`
- Test: `backend/tests/calculations.test.js`

- [ ] **Step 1 : Vérifier les tests existants**

```bash
cd backend && npx jest tests/calculations.test.js -t "aggregat" --verbose 2>/dev/null | tail -15
```

- [ ] **Step 2 : Fix ligne 117-122 (getProjectMetrics)**

Remplacer :
```js
runs = [];
allRunsData.forEach((resp) => {
  if (resp.data.result) {
    runs = runs.concat(resp.data.result);
  }
});
```
Par :
```js
runs = allRunsData.flatMap((resp) => resp.data.result || []);
```

- [ ] **Step 3 : Fix lignes 401-412 (getEscapeAndDetectionRates)**

Remplacer :
```js
allRunsData.forEach((resp) => {
  if (resp.data.result) {
    allRuns = allRuns.concat(resp.data.result);
  }
});

let allSessions = [];
allSessionsData.forEach((resp) => {
  if (resp.data.result) {
    allSessions = allSessions.concat(resp.data.result);
  }
});
```
Par :
```js
allRuns = allRunsData.flatMap((resp) => resp.data.result || []);
const allSessions = allSessionsData.flatMap((resp) => resp.data.result || []);
```

- [ ] **Step 4 : Lancer les tests**

```bash
cd backend && npm test -- --testPathPattern=calculations
```
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add backend/services/istqb-metrics.service.js
git commit -m "perf: replace O(n²) concat loop with flatMap in istqb-metrics.service"
```

---

### Task 3 : TvDashboard — réduire les re-renders horloge

**Files:**
- Modify: `frontend/src/components/TvDashboard.jsx:9, 32`
- Test: `frontend/src/components/__tests__/TvDashboard.test.jsx`

**Contexte :** Le dashboard TV affiche `toLocaleTimeString` avec secondes → 86 400 renders/jour.
Fix : afficher HH:mm seulement (précision minute suffisante pour un dashboard TV), passer l'interval à 60 000 ms.

- [ ] **Step 1 : Lancer les tests existants**

```bash
cd frontend && npx vitest run src/components/__tests__/TvDashboard.test.jsx 2>/dev/null | tail -10
```

- [ ] **Step 2 : Modifier TvDashboard.jsx**

Ligne 9 — changer l'interval :
```js
const timer = setInterval(() => setCurrentDate(new Date()), 60000);
```

Ligne 32 — supprimer les secondes de l'affichage :
```jsx
Généré le {currentDate.toLocaleDateString('fr-FR')} {currentDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} • ISTQB • LEAN • ITIL • Refresh auto 5min
```

- [ ] **Step 3 : Lancer les tests**

```bash
cd frontend && npx vitest run src/components/__tests__/TvDashboard.test.jsx 2>/dev/null | tail -10
```
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/components/TvDashboard.jsx
git commit -m "perf: reduce TvDashboard clock from 1s to 60s interval, show HH:mm only"
```

---

### Task 4 : Ne pas exposer error.message dans les 500 — toutes les routes

**Files:**
- Modify: `backend/routes/projects.routes.js`
- Modify: `backend/routes/runs.routes.js`
- Modify: `backend/routes/crosstest.routes.js`
- Modify: `backend/routes/cache.routes.js`

**Contexte :** Le `server.js:182` a déjà un handler global correct qui masque `error.message` en production. Les routes doivent déléguer via `next(error)` au lieu de répondre directement.

- [ ] **Step 1 : Vérifier les tests de routes**

```bash
cd backend && npx jest tests/routes/ --passWithNoTests 2>/dev/null | tail -10
```

- [ ] **Step 2 : Modifier projects.routes.js**

Dans chaque handler, ajouter `next` comme 3ème paramètre et remplacer le bloc catch :

```js
// Avant (exemple handler GET /)
router.get('/', async (req, res) => {
  try { ... }
  catch (error) {
    logger.error('Erreur GET /api/projects:', error);
    res.status(500).json({ success: false, error: error.message, timestamp: new Date().toISOString() });
  }
});

// Après
router.get('/', async (req, res, next) => {
  try { ... }
  catch (error) {
    logger.error('Erreur GET /api/projects:', error);
    next(error);
  }
});
```

Appliquer ce pattern aux 4 handlers de projects.routes.js.

- [ ] **Step 3 : Même transformation sur runs.routes.js**

Tous les blocs catch → `next(error)` (7 handlers).

- [ ] **Step 4 : Même transformation sur crosstest.routes.js**

Tous les blocs catch → `next(error)` (6 handlers).

- [ ] **Step 5 : Même transformation sur cache.routes.js**

Tous les blocs catch → `next(error)` (1 handler).

- [ ] **Step 6 : Vérifier que le global error handler est correct dans server.js**

```bash
grep -n "NODE_ENV.*production" backend/server.js
```
Expected output : `error: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur' : err.message`

- [ ] **Step 7 : Lancer tous les tests backend**

```bash
cd backend && npm test 2>&1 | tail -20
```
Expected : tous les tests passent

- [ ] **Step 8 : Commit**

```bash
git add backend/routes/projects.routes.js backend/routes/runs.routes.js backend/routes/crosstest.routes.js backend/routes/cache.routes.js
git commit -m "security: delegate route errors to global handler via next(error), stop exposing error.message"
```

---

## GROUPE 2 — Refactoring structurel (grands fichiers)

### Task 5 : Découper Dashboard6.jsx (856 lignes)

**Files:**
- Modify: `frontend/src/components/Dashboard6.jsx`
- Create: `frontend/src/components/D6SyncForm.jsx` — formulaire de config (projet, dossier, filtres)
- Create: `frontend/src/components/D6SyncPreview.jsx` — tableau preview des issues
- Create: `frontend/src/components/D6SyncLog.jsx` — log SSE en temps réel
- Create: `frontend/src/components/D6SyncHistory.jsx` — historique des syncs
- Test: `frontend/src/components/__tests__/Dashboard6.sync.test.jsx` (existant)

**Stratégie :** Dashboard6 gère l'état principal (flux idle→analyzing→preview→syncing→done). Les sous-composants reçoivent tout par props. Pas de Context — pas nécessaire à ce stade.

- [ ] **Step 1 : Lancer les tests existants (baseline)**

```bash
cd frontend && npx vitest run src/components/__tests__/Dashboard6.sync.test.jsx 2>/dev/null | tail -10
```
Note le nombre de tests qui passent.

- [ ] **Step 2 : Extraire D6SyncHistory**

Lire Dashboard6.jsx pour identifier la section historique (rendu de `history` state).
Créer `frontend/src/components/D6SyncHistory.jsx` avec :
```jsx
import React from 'react';
import { History, Clock, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { formatDate } from './Dashboard6'; // ré-exporter formatDate depuis D6

export default function D6SyncHistory({ history }) {
  if (!history || history.length === 0) return null;
  return (
    // ... JSX extrait de Dashboard6
  );
}
```

- [ ] **Step 3 : Extraire D6SyncLog**

Créer `frontend/src/components/D6SyncLog.jsx` avec :
```jsx
import React from 'react';
import { LogIcon } from './Dashboard6'; // ré-exporter LogIcon

export default function D6SyncLog({ log }) {
  return (
    // ... JSX du panneau de log SSE
  );
}
```

- [ ] **Step 4 : Extraire D6SyncPreview**

Créer `frontend/src/components/D6SyncPreview.jsx` avec le tableau d'issues en preview.

- [ ] **Step 5 : Réintégrer dans Dashboard6**

Dashboard6 devient le composant-container qui :
- gère tout l'état (useState, useEffect, useRef, useCallback)
- importe et affiche D6SyncHistory, D6SyncLog, D6SyncPreview, RunActionPanel

- [ ] **Step 6 : Lancer les tests**

```bash
cd frontend && npx vitest run src/components/__tests__/Dashboard6.sync.test.jsx 2>/dev/null | tail -10
```
Expected : même nombre de tests passent qu'à l'étape 1.

- [ ] **Step 7 : Commit**

```bash
git add frontend/src/components/Dashboard6.jsx frontend/src/components/D6Sync*.jsx
git commit -m "refactor: split Dashboard6 into D6SyncHistory, D6SyncLog, D6SyncPreview sub-components"
```

---

### Task 6 : Découper Dashboard8.jsx (630 lignes)

**Files:**
- Modify: `frontend/src/components/Dashboard8.jsx`
- Create: `frontend/src/components/D8ConfigForm.jsx` — formulaire config cron
- Create: `frontend/src/components/D8AlertsSection.jsx` — section alertes Slack
- Test: `frontend/src/components/__tests__/Dashboard8.alerts.test.jsx` (existant)

- [ ] **Step 1 : Lancer les tests existants**

```bash
cd frontend && npx vitest run src/components/__tests__/Dashboard8.alerts.test.jsx 2>/dev/null | tail -10
```

- [ ] **Step 2 : Extraire D8AlertsSection**

La section alertes Slack est distincte de la config cron. L'extraire avec ses props :
```jsx
// frontend/src/components/D8AlertsSection.jsx
import React from 'react';
import { Bell, BellOff } from 'lucide-react';

export default function D8AlertsSection({ alertsConfig, onUpdate, onTest, saving, testResult }) {
  return (
    // ... JSX section alertes
  );
}
```

- [ ] **Step 3 : Extraire D8ConfigForm**

```jsx
// frontend/src/components/D8ConfigForm.jsx
import React from 'react';
import { Save, Eye, EyeOff } from 'lucide-react';
import StatusBadge from './D8StatusBadge'; // StatusBadge déjà inline dans D8

export default function D8ConfigForm({ config, onChange, onSave, saving, showToken, onToggleToken }) {
  return (
    // ... JSX formulaire runId, iterationName, gitlabProjectId, token
  );
}
```

- [ ] **Step 4 : Mettre à jour Dashboard8**

Dashboard8 orchestre : config, trigger manuel, dry-run, log SSE, alertes.

- [ ] **Step 5 : Lancer les tests**

```bash
cd frontend && npx vitest run src/components/__tests__/Dashboard8.alerts.test.jsx 2>/dev/null | tail -10
```
Expected : même résultat qu'étape 1.

- [ ] **Step 6 : Commit**

```bash
git add frontend/src/components/Dashboard8.jsx frontend/src/components/D8*.jsx
git commit -m "refactor: split Dashboard8 into D8ConfigForm, D8AlertsSection sub-components"
```

---

## GROUPE 3 — Medium : utilitaires et corrections

### Task 7 : Extraire les helpers partagés — `utils/metrics.utils.js`

**Files:**
- Create: `backend/utils/metrics.utils.js`
- Modify: `backend/services/testmo.service.js` (supprimer les doublons)
- Modify: `backend/services/istqb-metrics.service.js` (importer depuis utils)
- Test: `backend/tests/calculations.test.js`

- [ ] **Step 1 : Créer backend/utils/metrics.utils.js**

```js
// backend/utils/metrics.utils.js

function calculatePercentage(value, total) {
  if (!total || total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
}

function aggregateSessions(sessions) {
  const aggregated = { total: 0, passed: 0, failed: 0, completed: 0, success: 0, failure: 0, wip: 0 };
  sessions.forEach((session) => {
    const successCount = session.success_count || 0;
    const failureCount = session.failure_count || 0;
    const sessionTotal = successCount + failureCount;
    if (sessionTotal > 0) {
      aggregated.total += sessionTotal;
      aggregated.passed += successCount;
      aggregated.failed += failureCount;
      aggregated.completed += sessionTotal;
      aggregated.success += successCount;
      aggregated.failure += failureCount;
    } else {
      aggregated.total += 1;
      aggregated.wip += 1;
    }
  });
  return aggregated;
}

function globalMetrics(aggregated) {
  return {
    completionRate: calculatePercentage(aggregated.completed, aggregated.total),
    passRate: calculatePercentage(aggregated.passed, aggregated.completed),
    failureRate: calculatePercentage(aggregated.failed, aggregated.completed),
    testEfficiency: calculatePercentage(aggregated.passed, aggregated.passed + aggregated.failed),
  };
}

module.exports = { calculatePercentage, aggregateSessions, globalMetrics };
```

- [ ] **Step 2 : Vérifier les imports actuels dans les tests**

```bash
grep -n "require.*istqb-metrics\|_calculatePercentage\|aggregateSessions" backend/tests/calculations.test.js | head -10
```

- [ ] **Step 3 : Mettre à jour istqb-metrics.service.js**

Remplacer les définitions locales de `_calculatePercentage` et `aggregateSessions` par :
```js
const { calculatePercentage: _calculatePercentage, aggregateSessions, globalMetrics } = require('../utils/metrics.utils');
```

Supprimer les 3 fonctions redéfinies localement (lignes 16-60).

- [ ] **Step 4 : Mettre à jour testmo.service.js**

Faire de même si `testmo.service.js` contient des doublons :
```bash
grep -n "_calculatePercentage\|aggregateSessions" backend/services/testmo.service.js | head -10
```
Si présent, remplacer par import depuis `../utils/metrics.utils`.

- [ ] **Step 5 : Mettre à jour les exports des modules**

Dans `istqb-metrics.service.js`, les tests importent directement `_calculatePercentage` et `aggregateSessions`. Maintenir la rétrocompatibilité :
```js
// Maintenir les exports existants pour les tests
module.exports._calculatePercentage = _calculatePercentage;
module.exports.aggregateSessions = aggregateSessions;
module.exports.globalMetrics = globalMetrics;
```

- [ ] **Step 6 : Lancer les tests**

```bash
cd backend && npm test -- --testPathPattern=calculations
```
Expected : PASS (les exports sont maintenus)

- [ ] **Step 7 : Commit**

```bash
git add backend/utils/metrics.utils.js backend/services/istqb-metrics.service.js backend/services/testmo.service.js
git commit -m "refactor: extract _calculatePercentage+aggregateSessions to backend/utils/metrics.utils.js"
```

---

### Task 8 : Ajouter un timeout sur les Promise.all sans délai max

**Files:**
- Create: `backend/utils/async.utils.js`
- Modify: `backend/services/istqb-metrics.service.js` (wrapping des Promise.all clés)

- [ ] **Step 1 : Créer backend/utils/async.utils.js**

```js
// backend/utils/async.utils.js

/**
 * Wrap a promise with a timeout. Rejects with an Error if the promise
 * doesn't settle within `ms` milliseconds.
 */
function withTimeout(promise, ms, operationName = 'operation') {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${operationName}`)), ms)
  );
  return Promise.race([promise, timeout]);
}

module.exports = { withTimeout };
```

- [ ] **Step 2 : Écrire le test**

Créer `backend/tests/helpers/async.utils.test.js` :
```js
const { withTimeout } = require('../../utils/async.utils');

test('resolves when promise completes before timeout', async () => {
  const fast = Promise.resolve(42);
  const result = await withTimeout(fast, 1000, 'test');
  expect(result).toBe(42);
});

test('rejects when promise exceeds timeout', async () => {
  const slow = new Promise(resolve => setTimeout(resolve, 500));
  await expect(withTimeout(slow, 50, 'slow-op')).rejects.toThrow('Timeout after 50ms: slow-op');
});
```

- [ ] **Step 3 : Lancer le test**

```bash
cd backend && npx jest tests/helpers/async.utils.test.js --verbose 2>/dev/null | tail -10
```
Expected : 2 tests PASS

- [ ] **Step 4 : Appliquer dans istqb-metrics.service.js**

Ajouter l'import en haut du fichier :
```js
const { withTimeout } = require('../utils/async.utils');
```

Wrapper le Promise.all principal (lignes 115, 157, etc.) :
```js
// Avant
const allRunsData = await Promise.all(runPromises);

// Après
const allRunsData = await withTimeout(Promise.all(runPromises), 15000, 'fetchRunsByMilestone');
```

Appliquer aux 3 Promise.all dans getProjectMetrics, getEscapeAndDetectionRates, getAnnualQualityTrends.

- [ ] **Step 5 : Lancer tous les tests backend**

```bash
cd backend && npm test 2>&1 | tail -10
```
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add backend/utils/async.utils.js backend/tests/helpers/async.utils.test.js backend/services/istqb-metrics.service.js
git commit -m "perf: add withTimeout utility and wrap Promise.all calls in istqb-metrics.service"
```

---

### Task 9 : Extraire les magic numbers vers des fichiers de constantes

**Files:**
- Create: `backend/config/thresholds.config.js`
- Create: `frontend/src/config/thresholds.js`
- Modify: `backend/services/istqb-metrics.service.js` (SLA_THRESHOLDS)
- Modify: `frontend/src/components/Dashboard3.jsx` (seuils escape/detection rate)

- [ ] **Step 1 : Créer backend/config/thresholds.config.js**

```js
// backend/config/thresholds.config.js
const SLA_THRESHOLDS = {
  passRate: { target: 95, warning: 90, critical: 85 },
  blockedRate: { max: 5 },
  completionRate: { target: 90, warning: 80 },
};

const ITIL_TARGETS = {
  mttr: 72,           // heures
  leadTime: 120,      // heures
  changeFailRate: 20, // %
};

const LEAN_TARGETS = {
  wip: 20,
};

const ISTQB_TARGETS = {
  passRate: 80,
  blockRate: 5,
};

module.exports = { SLA_THRESHOLDS, ITIL_TARGETS, LEAN_TARGETS, ISTQB_TARGETS };
```

- [ ] **Step 2 : Créer frontend/src/config/thresholds.js**

```js
// frontend/src/config/thresholds.js
export const SLA = {
  passRate: { ok: 95, warning: 90, critical: 85 },
  failureRate: { ok: 5, warning: 10 },
  completionRate: { ok: 90, warning: 80 },
  testEfficiency: { ok: 95, warning: 90 },
  escapeRate: { max: 5 },
  detectionRate: { min: 95 },
};

export const ITIL = {
  mttr: 72,
  leadTime: 120,
  changeFailRate: 20,
};

export const LEAN = {
  wip: 20,
};
```

- [ ] **Step 3 : Mettre à jour istqb-metrics.service.js**

Remplacer la définition locale de `SLA_THRESHOLDS` dans `_checkSLA` :
```js
const { SLA_THRESHOLDS } = require('../config/thresholds.config');
```
Et supprimer la constante locale.

- [ ] **Step 4 : Mettre à jour Dashboard3.jsx si applicable**

```bash
grep -n "escapeRate\|detectionRate\|< 5\|> 95" frontend/src/components/Dashboard3.jsx | head -10
```
Remplacer les valeurs hardcodées par des imports depuis `../config/thresholds`.

- [ ] **Step 5 : Lancer tous les tests**

```bash
cd backend && npm test 2>&1 | tail -5
cd frontend && npm test 2>&1 | tail -5
```
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add backend/config/thresholds.config.js frontend/src/config/thresholds.js backend/services/istqb-metrics.service.js frontend/src/components/Dashboard3.jsx
git commit -m "refactor: extract SLA magic numbers to thresholds.config.js and frontend/config/thresholds.js"
```

---

### Task 10 : Fix stale closure dans DashboardPrincipal.jsx

**Files:**
- Modify: `frontend/src/components/DashboardPrincipal.jsx:18-21`
- Test: `frontend/src/components/__tests__/DashboardPrincipal.test.jsx`

**Contexte :** `handleExportPDF` capture `isDark` par closure. Si `isDark` change après le montage, l'export PDF utilisera l'ancienne valeur. Fix : utiliser un ref pour maintenir la référence à jour.

- [ ] **Step 1 : Lancer les tests existants**

```bash
cd frontend && npx vitest run src/components/__tests__/DashboardPrincipal.test.jsx 2>/dev/null | tail -10
```

- [ ] **Step 2 : Modifier DashboardPrincipal.jsx**

Ajouter après la définition de `handleExportPDF` :

```jsx
// Ref pour éviter la stale closure sur isDark dans le useEffect
const exportHandlerRef = React.useRef(null);
exportHandlerRef.current = handleExportPDF;

React.useEffect(() => {
    if (setExportHandler) setExportHandler(() => () => exportHandlerRef.current());
    return () => { if (setExportHandler) setExportHandler(null); };
}, [setExportHandler]);
```

Supprimer l'ancien useEffect (lignes 18-21).

- [ ] **Step 3 : Lancer les tests**

```bash
cd frontend && npx vitest run src/components/__tests__/DashboardPrincipal.test.jsx 2>/dev/null | tail -10
```
Expected : PASS

- [ ] **Step 4 : Commit**

```bash
git add frontend/src/components/DashboardPrincipal.jsx
git commit -m "fix: use ref to avoid stale isDark closure in DashboardPrincipal export handler"
```

---

## GROUPE 4 — Faible (clarifications post-audit)

### Note d'audit corrigée

Après vérification du code source :

| Package | Statut |
|---------|--------|
| `docx` | ✅ Utilisé dans `QuickClosureModal.jsx` → `docxGenerator.js` |
| `pptxgenjs` | ✅ Utilisé dans `backend/services/report.service.js` |
| `marked` + `sanitize-html` | ✅ Utilisés dans `sync.service.js:88,183` pour protection XSS |

**Aucune suppression nécessaire.** Ces packages remplissent des fonctions actives.

### Task 11 (optionnel) : Cache invalidation événementielle

**Différé** — nécessite une refactorisation de testmo.service.js et l'introduction d'un EventEmitter. Bénéfice faible (cache déjà à 30s). À traiter si des SLA issues liées au cache stale sont observées en prod.

---

## Récapitulatif

| # | Task | Fichiers | Priorité | Durée estimée |
|---|------|----------|----------|---------------|
| 1 | Gate console.log derrière DEV | api.service.js | CRITIQUE | 10 min |
| 2 | Fix O(n²) concat → flatMap | istqb-metrics.service.js | CRITIQUE | 10 min |
| 3 | TvDashboard clock 60s + HH:mm | TvDashboard.jsx | CRITIQUE | 5 min |
| 4 | Routes → next(error) | *.routes.js x4 | CRITIQUE | 15 min |
| 5 | Split Dashboard6 | D6Sync*.jsx | CRITIQUE | 45 min |
| 6 | Split Dashboard8 | D8*.jsx | CRITIQUE | 30 min |
| 7 | Extract metrics utils | metrics.utils.js | MOYEN | 15 min |
| 8 | withTimeout Promise.all | async.utils.js | MOYEN | 15 min |
| 9 | Magic numbers → constantes | thresholds.config.js | MOYEN | 20 min |
| 10 | Fix stale closure DashPrincipal | DashboardPrincipal.jsx | MOYEN | 10 min |
| 11 | Cache invalidation | — | FAIBLE | différé |
