# QA Dashboard — Roadmap post-audit

Créée le 2026-04-29 après completion des 15 items d'audit.
Branche de référence : `master` (401 tests verts).

Légende : `✅ done` · `🔄 in progress` · `⬜ todo`

---

## Phase 1 — Qualité code (quick wins)

| # | Statut | Description | Effort |
|---|--------|-------------|--------|
| Q1 | ✅ done | **Prettier warnings backend** — 1284 → 0 warnings ; dead code supprimé (reportService, _resolveField, preprodRuns/Sessions, cases inutile) | ~1h |
| Q2 | ✅ done | **Tests routes API (supertest)** — 77 tests sur 9 routers (400 Zod, 403 CSRF, 200 mock) ; suite totale 367 → 444 tests | ~1 jour |

---

## Phase 2 — Fonctionnalité en cours

| # | Statut | Description | Effort |
|---|--------|-------------|--------|
| F1 | ✅ done | **Brancher `getIssuesByStatusAndIteration`** — déjà intégré dans `sync.service.js` (l. 320 + 489) via les flux `/sync/execute` et `/sync/preview` depuis feat/modernisation-architecture | — |

---

## Phase 3 — Production readiness

| # | Statut | Description | Effort |
|---|--------|-------------|--------|
| P1 | ✅ done | **Dockerfile + docker-compose** — backend (node:22-alpine), frontend (nginx multi-stage), volumes SQLite/data/logs, healthcheck, docker-compose.yml | ~1 jour |
| P2 | ✅ done | **Validation env au démarrage** — REQUIRED_ENV exit(1) + RECOMMENDED_ENV warn dans server.js | ~2h |
| P3 | ✅ done | **Procédure de déploiement** — DEPLOY.md : env vars, docker compose, volumes SQLite, reverse proxy, migration, healthcheck | ~2h |

---

## Phase 4 — Nouvelles fonctionnalités

| # | Statut | Description | Effort |
|---|--------|-------------|--------|
| N1 | ✅ done | **Historique métriques SQLite** — metrics-history.service.js (dedup/jour), GET /history, auto-snapshot fire-and-forget, MetricsTrendChart.jsx dans Dashboard5 | ~2 jours |
| N2 | ✅ done | **Alertes Slack/email** — notifier quand pass rate < seuil critique ou escape rate > seuil | ~1 jour |
| N3 | ✅ done | **Dashboard comparaison inter-milestones** — Dashboard10 + route /compare, 2 sélecteurs milestone, métriques côte-à-côte (passRate, completionRate, failureRate, testEfficiency), delta coloré (vert/rouge), 8 tests Vitest | ~2 jours |

---

## Sessions de travail

| Date | Items traités | Branche |
|------|--------------|---------|
| 2026-04-29 | Audit + C1-C3 + H1-H5 + M1-M5 + P1-P3 + S1 (15 items) | `feat/modernisation-architecture` → merge master |
| 2026-04-29 | Q1 (0 warnings ESLint), ROADMAP.md créée | `master` |
| 2026-04-29 | Q2 (77 tests supertest, 444 tests total) | `master` |
| 2026-05-05 | sync-filtres-cumulables (4 filtres), run-manager (service + routes + frontend Dashboard9/RunActionPanel) | `master` |
| 2026-05-06 | P1 Docker + P3 Deploy doc (DEPLOY.md) — Phase 3 complète | `master` |
| 2026-05-06 | N2 alertes Slack (alerts.service, routes, Dashboard8, 17 tests) | `master` |
| 2026-05-06 | N3 comparaison inter-milestones (Dashboard10, route /compare, 8 tests) | `master` |
| 2026-05-06 | Backend test coverage — nock + 21 nouveaux tests (sync.extractSteps 9, status-sync.integration 6, alerts.integration 6) → 539 tests total | `master` |
