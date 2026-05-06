# N2 — Alertes Slack : Design Spec

**Date:** 2026-05-06
**Scope:** Notifications Slack automatiques quand les métriques ISTQB franchissent les seuils SLA

---

## Contexte

Le dashboard QA dispose déjà de :
- Calcul SLA via `_checkSLA()` dans `istqb-metrics.service.js` (passRate, blockedRate, completionRate)
- Snapshots métriques SQLite dans `metrics-history.service.js` (déclenchés au cron auto-sync)
- Config runtime persistée en JSON (`auto-sync-config.service.js` comme modèle)
- Dashboard8 : panneau de configuration auto-sync

N2 ajoute la notification Slack quand un seuil est franchi, avec anti-spam par projet.

---

## Architecture

### Nouveau fichier : `backend/services/alerts.service.js`

**Responsabilité unique :** recevoir un `slaStatus` (déjà calculé), décider si notifier, envoyer le webhook.

**Config persistée** dans `backend/data/alerts-config.json` :
```json
{
  "enabled": false,
  "slack_webhook_url": "",
  "cooldown_hours": 4,
  "metrics": {
    "passRate_critical": true,
    "passRate_warning": false,
    "completionRate_warning": true,
    "blockedRate_warning": true
  }
}
```

**Cooldown** stocké en SQLite dans `backend/db/metrics-history.db`, table :
```sql
CREATE TABLE IF NOT EXISTS alert_cooldowns (
  project_id   TEXT PRIMARY KEY,
  last_sent_at TEXT NOT NULL
)
```
Même base que `metrics_snapshots` — pas de nouvelle dépendance.

**API publique du service :**
```js
alertsService.checkAndNotify(projectId, projectName, slaStatus)  // fire-and-forget
alertsService.getConfig()
alertsService.saveConfig(config)
alertsService.sendTest()  // envoie un message test au webhook configuré
```

### Intégration dans `metrics-history.service.js`

Dans `saveSnapshot()`, après l'INSERT SQLite, appel fire-and-forget :
```js
alertsService.checkAndNotify(snap.project_id, snap.project_name, snap.slaStatus).catch(() => {});
```
`slaStatus` est déjà calculé par `_checkSLA()` avant l'appel à `saveSnapshot`.

### Nouveau fichier : `backend/routes/alerts.routes.js`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/alerts/config` | Retourne la config actuelle |
| PUT | `/api/alerts/config` | Met à jour config (webhook, enabled, cooldown, métriques) |
| POST | `/api/alerts/test` | Envoie un message test au webhook configuré |

Monté dans `server.js` : `app.use('/api/alerts', alertsRouter)`.

### Message Slack (Block Kit)

```
🚨 [neo-pilot] Alerte QA — 2 problèmes détectés

• CRITICAL — Pass Rate: 82% (seuil: 85%)
• WARNING  — Completion Rate: 77% (seuil: 80%)

Dashboard: http://localhost:3000
```

Format Block Kit avec section + context. Couleur rouge si severity=critical, orange si warning only.

---

## Frontend — Dashboard8

Nouvelle section collapsible **"Alertes Slack"** ajoutée dans le panneau existant, après la section auto-sync.

Composants :
- Toggle ON/OFF (enabled)
- Input webhook URL (type password, masqué par défaut, bouton reveal)
- Input numérique cooldown (heures, min=1, max=168, défaut=4)
- Checkboxes métriques surveillées :
  - ☑ Pass Rate critique (< 85%)
  - ☐ Pass Rate warning (< 90%)
  - ☑ Completion Rate warning (< 80%)
  - ☑ Blocked Rate warning (> 5%)
- Bouton **"Tester la connexion"** → POST `/api/alerts/test` → feedback inline (✅ Message envoyé / ❌ Erreur: ...)

State local dans Dashboard8, sauvegarde via PUT `/api/alerts/config` au submit.

---

## Tests

### Backend (Jest) — `backend/tests/alerts.test.js`

| Cas | Comportement attendu |
|-----|---------------------|
| `enabled: false` | `checkAndNotify` ne POST pas le webhook |
| Cooldown actif | Alerte dans la fenêtre cooldown → pas d'envoi |
| Cooldown expiré | Alerte → POST webhook + update `last_sent_at` |
| `slaStatus.ok: true` | Pas d'envoi |
| Alerte critique | POST webhook, message contient "CRITICAL" |
| Webhook URL vide | `sendTest()` retourne erreur propre (pas de crash) |
| Webhook invalide | `sendTest()` catch l'erreur HTTP → retourne `{ ok: false, error }` |

Mock : `node-fetch` ou `axios` mocké via `jest.mock()`.

### Frontend (Vitest) — ajout dans tests Dashboard8 existants

- Toggle désactivé → inputs disabled
- Bouton "Tester" → appelle `api.testSlackAlert()` + affiche feedback

---

## Critères de succès

1. Message Slack reçu quand un seuil est franchi au snapshot
2. Pas de double notification dans la fenêtre cooldown (par projet)
3. Config persiste après restart backend
4. `POST /api/alerts/test` envoie un vrai message Slack
5. Tous les nouveaux tests passent (backend + frontend)
