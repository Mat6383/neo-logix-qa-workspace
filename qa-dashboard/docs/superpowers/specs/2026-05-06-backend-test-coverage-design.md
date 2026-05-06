# Design — Fiabilisation backend : couverture tests services critiques

**Date:** 2026-05-06  
**Scope:** Backend uniquement — 4 services critiques  
**Approche:** Mixte (unit tests fonctions pures + intégration nock + edge cases contrat)

---

## Contexte

Quatre services backend sont identifiés comme à risque en production sans couverture de test suffisante :

- `status-sync.service.js` — mauvais label GitLab posé sur une issue
- `sync.service.js` — doublon ou payload malformé envoyé à Testmo
- `istqb-metrics.service.js` — métriques ISTQB fausses affichées
- `alerts.service.js` — alertes Slack en boucle ou manquées

Des tests partiels existent (`sync.service.test.js`, `status-sync.service.test.js`, `alerts.service.test.js`) mais ne couvrent pas les fonctions pures exportées ni les edge cases critiques.

---

## Architecture des tests

### Niveau 1 — Unit tests (fonctions pures, 0 mock)

Tester directement les fonctions exportées sans dépendance externe.

| Service | Fonctions | Fichier test |
|---|---|---|
| `status-sync.service.js` | `STATUS_TO_LABEL`, `buildCommentText`, `computeLabelChanges` | `tests/status-sync.pure.test.js` |
| `sync.service.js` | `extractStepsFromNotes`, `_buildCasePayloadWith` | `tests/sync.pure.test.js` |
| `istqb-metrics.service.js` | `_calculatePercentage`, `aggregateSessions`, `globalMetrics` | déjà dans `calculations.test.js` — compléter |
| `alerts.service.js` | `_isCoolingDown` (logique cooldown isolée) | `tests/alerts.pure.test.js` |

Cas à couvrir systématiquement :
- Valeurs nominales
- Valeurs limites (0, null, undefined, tableau vide)
- Combinaisons de labels conflictuels (`computeLabelChanges`)
- Tous les status_id du mapping `STATUS_TO_LABEL` (2, 3, 4, 8)

### Niveau 2 — Tests d'intégration (nock pour intercepter HTTP)

`nock` intercepte les appels axios sans vrais appels réseau.

**Flow sync GitLab → Testmo** (`tests/sync.integration.test.js`) :
- Cas nominal : issue GitLab → cas Testmo créé
- Idempotence : 2ème appel avec même issue → mise à jour, pas doublon
- GitLab renvoie 0 issues → sync propre, pas de crash
- Testmo renvoie 429 → comportement attendu (erreur explicite)

**Flow status-sync Testmo → GitLab** (`tests/status-sync.integration.test.js`) :
- Cas nominal : résultat Testmo → bon label GitLab posé
- status_id inconnu → skip sans crash
- GitLab renvoie 404 sur une issue → log + continuation
- GitLab renvoie 500 → retry ou fail explicite

**Flow alertes** (`tests/alerts.integration.test.js`) :
- SLA breach → POST Slack envoyé
- 2 appels rapprochés (< cooldown) → 1 seul POST Slack
- 2 appels espacés (> cooldown) → 2 POST Slack
- Webhook URL invalide → pas de crash, log d'erreur

### Niveau 3 — Edge cases contrat

Tests ciblés sur les scénarios de régression identifiés :

| Scénario | Service | Comportement attendu |
|---|---|---|
| Issue GitLab sans labels | `sync.service` | Payload construit sans champ labels, pas de crash |
| `computeLabelChanges` : add + remove même label | `status-sync` | Résolution déterministe (remove gagne) |
| `aggregateSessions` avec sessions vides | `istqb-metrics` | Retourne 0 partout, pas NaN |
| `_calculatePercentage(0, 0)` | `istqb-metrics` | Retourne 0, pas NaN ni Infinity |
| Cooldown expiry exact (boundary) | `alerts` | L'alerte passe exactement à l'expiry |
| `buildCommentText` avec champs optionnels absents | `status-sync` | Texte généré sans placeholder vide |

---

## Dépendance à ajouter

```bash
cd backend && npm install --save-dev nock
```

`nock` est la seule dépendance nouvelle. Compatible Jest, pas de config supplémentaire.

---

## Fichiers créés / modifiés

```
backend/tests/
  status-sync.pure.test.js      (nouveau)
  sync.pure.test.js              (nouveau)
  alerts.pure.test.js            (nouveau)
  sync.integration.test.js       (nouveau)
  status-sync.integration.test.js (nouveau)
  alerts.integration.test.js     (nouveau)
  calculations.test.js           (compléter les edge cases)
```

---

## Critères de succès

- `npm test` passe sans erreur
- Les 4 services ont une couverture > 80% sur leurs fonctions exportées
- Les 3 flows critiques ont au moins un test d'intégration heureux + un test d'erreur
- Aucun test ne fait d'appel réseau réel (nock intercepte tout)

---

## Hors scope

- Frontend (Dashboard composants) — priorité future
- TypeScript migration
- E2E Playwright
- `comments.service.js`, `syncHistory.service.js` — reportés
