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
| P1 | ⬜ todo | **Dockerfile + docker-compose** — conteneurisation backend + frontend pour déploiement reproductible | ~1 jour |
| P2 | ⬜ todo | **Validation env au démarrage** — compléter le check des variables requises, ajouter des valeurs par défaut sûres | ~2h |
| P3 | ⬜ todo | **Procédure de déploiement** — documenter les étapes (variables d'env, migration SQLite, reverse proxy) | ~2h |

---

## Phase 4 — Nouvelles fonctionnalités

| # | Statut | Description | Effort |
|---|--------|-------------|--------|
| N1 | ⬜ todo | **Historique métriques SQLite** — stocker les snapshots ISTQB quotidiens pour voir les tendances dans le temps | ~2 jours |
| N2 | ⬜ todo | **Alertes Slack/email** — notifier quand pass rate < seuil critique ou escape rate > seuil | ~1 jour |
| N3 | ⬜ todo | **Dashboard comparaison inter-milestones** — vue côte-à-côte de 2 jalons pour mesurer la progression | ~2 jours |

---

## Sessions de travail

| Date | Items traités | Branche |
|------|--------------|---------|
| 2026-04-29 | Audit + C1-C3 + H1-H5 + M1-M5 + P1-P3 + S1 (15 items) | `feat/modernisation-architecture` → merge master |
| 2026-04-29 | Q1 (0 warnings ESLint), ROADMAP.md créée | `master` |
| 2026-04-29 | Q2 (77 tests supertest, 444 tests total) | `master` |
