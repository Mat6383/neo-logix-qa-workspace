# QA Dashboard — Améliorations en cours

Audit réalisé le 2026-04-29. 15 items, classés par priorité.

Légende statut : `✅ done` · `🔄 in progress` · `⬜ todo`

---

## 🔴 Critique (données corrompues / sécurité)

| # | Statut | Description | Fichier(s) | Plan |
|---|--------|-------------|-----------|------|
| C1 | ✅ done | **NaN silencieux dans parseMilestones** — `map(Number)` propageait des NaN dans les calculs ISTQB | `backend/controllers/dashboard.controller.js:4` | [plan](docs/superpowers/plans/2026-04-29-critical-bug-fixes.md) · commit `fix(dashboard): filter NaN from milestone query params` |
| C2 | ✅ done | **XSS via marked.parse** — descriptions GitLab converties en HTML sans sanitisation (stored XSS dans Testmo + export PDF) | `backend/services/sync.service.js:79,167` | [plan](docs/superpowers/plans/2026-04-29-critical-bug-fixes.md) · commit `fix(sync): sanitize marked.parse output to prevent XSS` |
| C3 | ✅ done | **N+1 appels getIssueNotes** — 1 appel API GitLab par résultat dans la boucle de sync ; 100 résultats = 100+ requêtes séquentielles (~40s) | `backend/services/status-sync.service.js` | [plan](docs/superpowers/plans/2026-04-29-critical-bug-fixes.md) · commit `fix(status-sync): pre-fetch GitLab notes before loop` |

---

## 🟠 Haute priorité

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| H1 | ⬜ todo | **Zéro tests pour sync.service** (625 LOC) — flux principal GitLab → Testmo sans couverture | `backend/tests/` |
| H2 | ⬜ todo | **Zéro tests pour status-sync.service** (170+ LOC) — flux Testmo → GitLab | `backend/tests/` |
| H3 | ⬜ todo | **Zéro tests pour gitlab.service** (695 LOC) — client API GitLab entier | `backend/tests/` |
| H4 | ⬜ todo | **Tokens dans les logs** — headers d'autorisation loggés sans redaction (fuite potentielle vers Sentry) | `backend/services/testmo.service.js:85`, `backend/services/gitlab.service.js:57` |
| H5 | ⬜ todo | **Erreurs avalées inconsistamment** — `api.service.js` retourne `{ success: false }` au lieu de throw ; les composants qui attendent une exception ne reçoivent rien | `frontend/src/services/api.service.js` |

---

## 🟡 Maintenance / Architecture

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| M1 | ⬜ todo | **testmo.service.js 1400+ LOC** — mélange client HTTP + calculs ISTQB + cache + retry ; splitter en `testmo-api.js` + `istqb-metrics.js` | `backend/services/testmo.service.js` |
| M2 | ⬜ todo | **Logique couleur/seuil dupliquée 3×** — `getColorByThreshold()` redéfini dans MetricsCards, Dashboard4, StatusChart | `frontend/src/components/MetricsCards.jsx`, `Dashboard4.jsx`, `StatusChart.jsx` |
| M3 | ⬜ todo | **Dashboard4.jsx 639 LOC** — gère métriques + export PDF + 3 modales (TestClosure, QuickClosure, ReportGenerator) ; extraire les modales | `frontend/src/components/Dashboard4.jsx` |
| M4 | ⬜ todo | **`_withRetry()` appliqué inconsistamment** — `gitlab.service.js` protège tous les appels, `testmo.service.js` seulement certains ; erreurs réseau tombent silencieusement | `backend/services/testmo.service.js` |
| M5 | ⬜ todo | **Paramètres query non validés** — `?active=0` ou `?dryRun=yes` passent les vérifications ; utiliser les validators Zod existants | `backend/routes/projects.routes.js:38`, `backend/services/sync.controller.js:124` |

---

## 🔵 Performance

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| P1 | ⬜ todo | **Dashboard6 logs non virtualisés** — `logLines` grandit indéfiniment pendant le SSE ; 500+ événements = 500 nœuds DOM, freeze sur gros syncs | `frontend/src/components/Dashboard6.jsx:148` |
| P2 | ⬜ todo | **Auto-refresh ignorant la visibilité** — DashboardContext recharge toutes les 60s même quand l'onglet est en arrière-plan | `frontend/src/contexts/DashboardContext.jsx` |
| P3 | ⬜ todo | **Pas de headers HTTP cache** — réponses API sans `Cache-Control` / `ETag` ; le frontend re-fetch des données identiques à chaque navigation | `backend/routes/` |

---

## 🔒 Sécurité

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| S1 | ⬜ todo | **Pas de protection CSRF** — endpoints POST/PUT sans token CSRF ; n'importe quelle origine peut déclencher un sync | `backend/server.js` |

---

## Sessions de travail

| Date | Items traités | Branche |
|------|--------------|---------|
| 2026-04-29 | C1, C2, C3 | `feat/modernisation-architecture` |
