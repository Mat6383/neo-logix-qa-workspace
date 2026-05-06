# Procédure de déploiement — QA Dashboard

## Prérequis

- Docker 24+ et Docker Compose v2
- Accès à l'instance Testmo (token API)
- Accès à GitLab (token lecture + écriture)

## 1 — Variables d'environnement

```bash
cp backend/.env.example backend/.env
```

Remplir les variables **[REQUIS]** dans `backend/.env` :

| Variable | Rôle |
|----------|------|
| `TESTMO_URL` | URL de l'instance Testmo (ex: `https://votre-instance.testmo.net`) |
| `TESTMO_TOKEN` | Token API Testmo |
| `GITLAB_URL` | URL GitLab self-hosted |
| `GITLAB_TOKEN` | Token lecture GitLab (`read_api`) |
| `GITLAB_WRITE_TOKEN` | Token écriture GitLab (`api`) |

Le serveur refuse de démarrer si une variable [REQUIS] est absente.

## 2 — Démarrage avec Docker Compose

```bash
# Build + démarrage en arrière-plan
docker compose up -d --build

# Vérifier les services
docker compose ps
docker compose logs -f
```

- Frontend : http://localhost (port 80)
- Backend API : http://localhost:3001

### Arrêt

```bash
docker compose down
```

## 3 — Persistence SQLite

Les volumes Docker préservent les données entre redémarrages :

| Volume | Contenu |
|--------|---------|
| `backend-db` | `sync-history.db`, `crosstest-comments.db` |
| `backend-data` | `auto-sync-config.json` (config cron auto-sync) |
| `backend-logs` | Logs Winston (combined + errors) |

Pour sauvegarder :

```bash
docker run --rm -v qa-dashboard_backend-db:/data -v $(pwd):/backup alpine \
  tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz -C /data .
```

## 4 — Migration SQLite (schéma)

Les tables sont créées automatiquement au démarrage (`syncHistory.service.js`, `comments.service.js`). Aucune migration manuelle requise.

Si migration nécessaire entre versions :

```bash
# Accéder au container backend
docker compose exec backend sh

# Utiliser sqlite3
sqlite3 db/sync-history.db ".schema"
```

## 5 — Reverse proxy (nginx externe, optionnel)

Si déployé derrière un reverse proxy (Nginx, Traefik, Caddy) :

- Exposer uniquement le port 80 (frontend)
- Le frontend proxifie `/api/` vers `backend:3001` via nginx interne
- Ne pas exposer le port 3001 en production

Exemple Nginx externe (HTTPS) :

```nginx
server {
    listen 443 ssl;
    server_name dashboard.exemple.fr;

    ssl_certificate /etc/letsencrypt/live/dashboard.exemple.fr/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.exemple.fr/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

## 6 — Mise à jour

```bash
git pull
docker compose up -d --build
```

Les volumes de données sont préservés lors du rebuild.

## 7 — Développement local (sans Docker)

```bash
# Terminal 1 — Backend
cd backend && npm install && npm run dev

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Backend : http://localhost:3001  
Frontend : http://localhost:3000

## Healthcheck

```bash
curl http://localhost:3001/api/health
# → {"status":"ok","timestamp":"..."}
```
