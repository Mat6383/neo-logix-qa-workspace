# 🚀 TESTMO DASHBOARD - DÉMARRAGE RAPIDE

## ⚡ Installation en 5 minutes

### 1️⃣ Récupérer votre Token API Testmo
```
1. Ouvrir Testmo
2. Avatar (coin droit) > User Profile > API access
3. "Generate new API key"
4. ⚠️ COPIER LE TOKEN (affiché une seule fois!)
```

### 2️⃣ Backend - Installation
```bash
cd backend
npm install
cp .env.example .env
# Éditer .env et coller votre token
nano .env
npm start
```

Vous verrez :
```
╔════════════════════════════════════════════╗
║  Backend Server Started on port 3001      ║
╚════════════════════════════════════════════╝
```

### 3️⃣ Frontend - Installation (nouveau terminal)
```bash
cd frontend
npm install
npm run dev
```

Vous verrez :
```
  ➜  Local:   http://localhost:3000/
```

### 4️⃣ Ouvrir le Dashboard
```
http://localhost:3000
```

---

## 📝 Configuration .env (backend)

```bash
TESTMO_URL=https://votre-instance.testmo.net
TESTMO_TOKEN=votre_token_copie_depuis_testmo
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## ✅ Vérification

### Test Backend
```bash
curl http://localhost:3001/api/health
# Doit retourner: {"status":"OK",...}
```

### Test Frontend
Ouvrir http://localhost:3000
- ✅ Vous devez voir 4 cartes de métriques
- ✅ Des graphiques de distribution
- ✅ Une liste de runs actifs

---

## 🐛 Problème ?

### "Authentification échouée"
→ Vérifier le token dans backend/.env

### "Module not found"
→ `npm install` dans backend/ et frontend/

### "Cannot connect to backend"
→ Vérifier que le backend tourne sur le port 3001

### "Pas de données"
→ Vérifier le project ID (défaut: 1) dans App.jsx

---

## 📊 Métriques affichées (ISTQB)

1. **Completion Rate** : Tests exécutés / Total
2. **Pass Rate** : Tests réussis / Exécutés  
3. **Failure Rate** : Tests échoués / Exécutés
4. **Test Efficiency** : Efficacité globale QA

**SLA ITIL** : Alertes automatiques si seuils dépassés

---

## 🔄 Auto-Refresh
Le dashboard se rafraîchit automatiquement toutes les **5 minutes** (LEAN)

Pour désactiver : Bouton "Auto OFF" dans le header

---

## 📖 Documentation complète

Voir `README.md` pour :
- Structure détaillée du projet
- API endpoints disponibles  
- Configuration avancée
- Déploiement production
- Standards ISTQB/LEAN/ITIL

---

**Créé par** : Matou - Neo-Logix QA Lead  
**Standards** : ISTQB | LEAN | ITIL | DevOps
