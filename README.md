# Neo-Logix QA Workspace

Mono-repo consolidé contenant l'ensemble des outils QA Neo-Logix.

## Projets

### 🧪 qa-dashboard
Dashboard de monitoring QA connecté à **Testmo** et **GitLab**, conforme ISTQB/LEAN/ITIL.

- **Frontend** : React 18 + Vite (port 3000)
- **Backend** : Express Node.js (port 3001)
- **Fonctionnalités** :
  - Métriques temps réel (Pass Rate, Failure Rate, Test Efficiency)
  - 3 boutons d'action : Clôture ISTQB, Clôture rapide, Rapport HTML/PPTX
  - Génération dynamique de rapports de clôture (HTML + PowerPoint)
  - Synchronisation GitLab ↔ Testmo

### 🐛 qa-bug-tracker
Outil de suivi de bugs et matrice de risque intégré à **GitLab**.

- **Stack** : Flask Python (port 5050)
- **Fonctionnalités** :
  - Matrice de risque ISTQB avec poids et probabilités
  - Synchronisation automatique des issues GitLab
  - Export Excel
  - CRUD complet sur matrices et lignes

## Démarrage rapide

```bash
# qa-dashboard
cd qa-dashboard/backend && npm install && cp .env.example .env && npm start
cd qa-dashboard/frontend && npm install && npm run dev

# qa-bug-tracker
cd qa-bug-tracker && pip install -r requirements.txt && python app.py
```

## Configuration

Chaque projet nécessite un fichier `.env` — voir `.env.example` dans chaque sous-dossier.
