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
| H1 | ✅ done | **Zéro tests pour sync.service** — parseIterationName (5 cas), syncIteration dryRun + error path | `backend/tests/sync.service.test.js` · commit `5b7aa7f` |
| H2 | ✅ done | **Zéro tests pour status-sync.service** — 16 cas purs : buildCommentText, isCommentDuplicate, computeLabelChanges, computeStatusChange, mapping | `backend/tests/status-sync.service.test.js` · commit `3fb3054` |
| H3 | ✅ done | **Zéro tests pour gitlab.service** — 20 cas : formatEstimate, getIssueNotes, findIterationForProject, searchIterations, executeGraphQL | `backend/tests/gitlab.service.test.js` · commit `c1cf8b5` |
| H4 | ✅ done | **Tokens dans les logs** — `_scrubEvent` dans Sentry `beforeSend` + 4 call sites testmo.service passent `{status,message}` au lieu du full error | `backend/services/sentry.service.js`, `testmo.service.js:343,363,609,690` · commit `d2a8b2e` |
| H5 | ✅ done | **Erreurs avalées inconsistamment** — `api.service.js` retourne `{ success: false }` au lieu de throw ; `DashboardContext` utilisait `Promise.all` (bloquant) au lieu de `Promise.allSettled` (non-bloquant pour quality rates) | `frontend/src/services/api.service.js`, `frontend/src/contexts/DashboardContext.jsx` |

---

## 🟡 Maintenance / Architecture

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| M1 | ✅ done | **testmo.service.js 1400+ LOC** — 3 méthodes ISTQB + helpers extraits dans `istqb-metrics.service.js` ; testmo.service passe de 1414 → 665 LOC | `backend/services/testmo.service.js`, `backend/services/istqb-metrics.service.js` |
| M2 | ✅ done | **Logique couleur/seuil dupliquée** — `utils/colorHelpers.js` centralise `getColorByThreshold` + `getColorForFailure` ; MetricsCards + Dashboard4 importent le module | `frontend/src/utils/colorHelpers.js` |
| M3 | ✅ done | **Dashboard4.jsx 639 LOC** — modal state + boutons + renders extraits dans `ModalGroup.jsx` ; Dashboard4 passe à 567 LOC | `frontend/src/components/ModalGroup.jsx` |
| M4 | ✅ done | **`_withRetry()` appliqué inconsistamment** — 7 méthodes GET supplémentaires wrappées (getProjectSessions, getRunDetails, getProjectMilestones, getRunResults, getAutomationRuns, getFolders, getCases) | `backend/services/testmo.service.js` |
| M5 | ✅ done | **Paramètres query non validés** — `activeQuery` (enum true/false) sur runs, `iterationSearchQuery` (max 100 chars) sur iterations ; Zod retourne 400 sur valeur invalide | `backend/validators/index.js`, `backend/routes/` |

---

## 🔵 Performance

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| P1 | ✅ done | **Dashboard6 logs non virtualisés** — `logLines` cappé à 500 entrées (slice -500) ; évite le freeze DOM sur gros syncs | `frontend/src/components/Dashboard6.jsx` |
| P2 | ✅ done | **Auto-refresh ignorant la visibilité** — setInterval suspendu sur `visibilityState=hidden`, repris sur visible | `frontend/src/contexts/DashboardContext.jsx` |
| P3 | ✅ done | **Pas de headers HTTP cache** — `Cache-Control: private, max-age=N` sur 6 routes GET (2–10 min selon la volatilité) | `backend/routes/dashboard.routes.js`, `backend/routes/projects.routes.js` |

---

## 🔒 Sécurité

| # | Statut | Description | Fichier(s) |
|---|--------|-------------|-----------|
| S1 | ✅ done | **Pas de protection CSRF** — middleware backend exige `X-Requested-With` sur POST/PUT/DELETE/PATCH ; le frontend axios l'envoie sur toutes les requêtes | `backend/server.js`, `frontend/src/services/api.service.js` |

---

## Sessions de travail

| Date | Items traités | Branche |
|------|--------------|---------|
| 2026-04-29 | C1, C2, C3 | `feat/modernisation-architecture` |
| 2026-04-29 | H1, H2, H3 | `feat/modernisation-architecture` |
| 2026-04-29 | H4 | `feat/modernisation-architecture` |
| 2026-04-29 | H5 | `feat/modernisation-architecture` |
| 2026-04-29 | M1, M2, M3, M4, M5, P1, P2, P3, S1 | `feat/modernisation-architecture` |
