# Procédures diverses

## 1. Sync GitLab → Testmo

### 1.1 Lancement manuel

Depuis le dossier `backend/` :

```bash
# Production (crée dans le vrai dossier Testmo)
node run-sync.js "R14 - run 1"

# Mode test (crée dans un dossier [TEST-API])
node run-sync.js "R14 - run 1" --test

# Simulation (aucune écriture, log uniquement)
node run-sync.js "R14 - run 1" --dry-run
```

### 1.2 Activation du cron (Task Scheduler Windows)

**Prérequis** : VPN connecté, terminal en mode administrateur.

1. Ouvrir un terminal **en administrateur**
2. Se placer dans le dossier backend :
   ```
   cd "C:\Users\Matou\Claude code\qa-dashboard\backend"
   ```
3. Lancer le script d'installation :
   ```
   setup-cron.bat
   ```
4. La tâche `GitLab-Testmo-Sync` est créée avec les paramètres suivants :

| Paramètre | Valeur |
|-----------|--------|
| Fréquence | Toutes les 2 heures |
| Jours | Lundi → Vendredi |
| Plage horaire | 08:00 → 19:00 |
| Itération par défaut | R14 - run 1 |

### 1.3 Modifier l'itération du cron

```
schtasks /change /tn "GitLab-Testmo-Sync" /tr "cmd /c cd /d \"C:\Users\Matou\Claude code\qa-dashboard\backend\" && node run-sync.js \"R14 - run 2\" >> sync.log 2>&1"
```

### 1.4 Désactiver le cron

```
schtasks /delete /tn "GitLab-Testmo-Sync" /f
```

### 1.5 Vérifier le statut du cron

```
schtasks /query /tn "GitLab-Testmo-Sync" /v
```

### 1.6 Consulter les logs

Les logs de sync sont écrits dans `backend/sync.log`.

---

## 2. Nettoyage des dossiers de test Testmo

Après une session de test, supprimer les dossiers `[TEST-API]` créés dans Testmo :

```bash
cd "C:\Users\Matou\Claude code\qa-dashboard\backend"
node test-testmo-api.js cleanup
```

Ou manuellement via l'interface Testmo : supprimer les dossiers préfixés `[TEST-API]` sous TESTS ISSUES.

---

## 3. Configuration requise

Le fichier `backend/.env` doit contenir :

| Variable | Description |
|----------|-------------|
| `TESTMO_URL` | URL Testmo (ex: `https://neo-logix.testmo.net`) |
| `TESTMO_TOKEN` | API Key Testmo (Profile > API Keys) |
| `TESTMO_PROJECT_ID` | ID du projet Testmo (défaut: 1) |
| `TESTMO_ROOT_GROUP_ID` | ID du dossier racine TESTS ISSUES (défaut: 4514) |
| `TESTMO_GITLAB_INTEGRATION_ID` | ID de l'intégration GitLab dans Testmo (défaut: 2) |
| `TESTMO_GITLAB_CONNECTION_PROJECT_ID` | ID du projet GitLab dans Testmo (défaut: 63) |
| `GITLAB_URL` | URL GitLab (ex: `https://gitlab.neo-logix.fr`) |
| `GITLAB_TOKEN` | Personal Access Token GitLab (scope: `read_api`) |
| `GITLAB_PROJECT_ID` | ID du projet GitLab (défaut: 63) |
| `GITLAB_LABEL` | Label de filtre (défaut: `Test::TODO`) |
