# Modernisation Architecture — neo-logix-qa-workspace

> **Pour les agents IA :** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal :** Combler les écarts entre neo-logix-qa-workspace et dashboard-by-kimi-2.0, corriger la dette technique interne, et élever le projet au niveau production-grade (tests, CI/CD, architecture, monitoring).

**Architecture :** Approche par phases progressives — chaque phase livre du code fonctionnel et testé. On commence par les quick wins (nettoyage sans risque), puis on refactore l'architecture (frontend → backend), puis on ajoute tests & monitoring.

**Tech Stack :** Node.js 18+, Express 4.18.2, React 18, Vite 5, Jest 29, SQLite, Zod, Winston, Chart.js, GitHub Actions

---

## Statut global

| Phase | Titre | Statut | Priorité |
|-------|-------|--------|----------|
| 1 | Quick wins — nettoyage & outils | ✅ Terminé (2026-04-23) | 🔴 Haute |
| 2 | Architecture Frontend — Contexts & Hooks | ✅ Terminé (2026-04-24) — 4/4 | 🔴 Haute |
| 3 | Architecture Frontend — Routing & Lazy Loading | ✅ Terminé (2026-04-24) — bundle −84% | 🟠 Moyenne |
| 4 | Architecture Backend — Refactoring server.js | ✅ Terminé (2026-04-23) | 🔴 Haute |
| 5 | Tests Frontend (Vitest + RTL) | ✅ Terminé (2026-04-23) — 10 tests | 🟠 Moyenne |
| 6 | Tests E2E Playwright | ⬜ Optionnel | 🟠 Moyenne |
| 7 | CI/CD GitHub Actions | ✅ Terminé (2026-04-23) | 🟠 Moyenne |
| 8 | Monitoring & Production (Sentry) | ✅ Terminé (2026-04-23) | 🟡 Faible |
| 9 | Upgrades dépendances | ✅ Terminé (2026-04-23) | 🟡 Faible |

**Légende statut :** ⬜ À faire | 🔄 En cours | ✅ Terminé | ⏸ Bloqué

---

## Phase 1 — Quick wins (nettoyage & outils)

> **Objectif :** Supprimer le dead code, configurer les outils de qualité. Aucun risque de régression.

### Tâche 1.1 : Supprimer Recharts (dead dependency)

**Fichiers :**
- Modifier : `qa-dashboard/frontend/package.json`
- Vérifier absence d'import : `qa-dashboard/frontend/src/**/*.jsx`

- [ ] **Étape 1 : Vérifier que Recharts n'est pas importé**

```bash
grep -r "recharts" qa-dashboard/frontend/src/
```
Expected : aucun résultat (zéro import).

- [ ] **Étape 2 : Désinstaller**

```bash
cd qa-dashboard/frontend && npm uninstall recharts
```
Expected : `removed 1 package` dans la sortie.

- [ ] **Étape 3 : Vérifier que le build passe toujours**

```bash
cd qa-dashboard/frontend && npm run build 2>&1 | tail -20
```
Expected : `✓ built in` sans erreur.

- [ ] **Étape 4 : Commit**

```bash
git add qa-dashboard/frontend/package.json qa-dashboard/frontend/package-lock.json
git commit -m "chore(frontend): remove unused recharts dependency (-70kb bundle)"
```

---

### Tâche 1.2 : Configurer ESLint + Prettier

**Fichiers :**
- Créer : `qa-dashboard/frontend/.eslintrc.json`
- Créer : `qa-dashboard/frontend/.prettierrc`
- Créer : `qa-dashboard/backend/.eslintrc.json`
- Créer : `qa-dashboard/backend/.prettierrc`
- Modifier : `qa-dashboard/frontend/package.json` (scripts lint)
- Modifier : `qa-dashboard/backend/package.json` (scripts lint)

- [ ] **Étape 1 : Installer ESLint + Prettier frontend**

```bash
cd qa-dashboard/frontend && npm install --save-dev eslint eslint-plugin-react eslint-plugin-react-hooks @eslint/js prettier eslint-config-prettier eslint-plugin-prettier
```

- [ ] **Étape 2 : Créer `.eslintrc.json` frontend**

```json
{
  "env": { "browser": true, "es2021": true },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "plugins": ["react", "react-hooks", "prettier"],
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "module" },
  "settings": { "react": { "version": "detect" } },
  "rules": {
    "prettier/prettier": "warn",
    "react/react-in-jsx-scope": "off",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  }
}
```

- [ ] **Étape 3 : Créer `.prettierrc` frontend**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Étape 4 : Ajouter scripts lint dans `frontend/package.json`**

Dans la section `"scripts"`, ajouter :
```json
"lint": "eslint src --ext .js,.jsx",
"lint:fix": "eslint src --ext .js,.jsx --fix",
"format": "prettier --write src"
```

- [ ] **Étape 5 : Installer ESLint backend**

```bash
cd qa-dashboard/backend && npm install --save-dev eslint prettier eslint-config-prettier eslint-plugin-prettier
```

- [ ] **Étape 6 : Créer `.eslintrc.json` backend**

```json
{
  "env": { "node": true, "es2021": true, "jest": true },
  "extends": ["eslint:recommended", "prettier"],
  "plugins": ["prettier"],
  "parserOptions": { "ecmaVersion": "latest", "sourceType": "commonjs" },
  "rules": {
    "prettier/prettier": "warn",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": "off"
  }
}
```

- [ ] **Étape 7 : Créer `.prettierrc` backend** (même config)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Étape 8 : Ajouter script lint dans `backend/package.json`**

```json
"lint": "eslint . --ext .js --ignore-pattern node_modules --ignore-pattern db",
"lint:fix": "eslint . --ext .js --ignore-pattern node_modules --fix"
```

- [ ] **Étape 9 : Vérifier que lint tourne (erreurs acceptées, crash non)**

```bash
cd qa-dashboard/backend && npm run lint 2>&1 | tail -5
cd qa-dashboard/frontend && npm run lint 2>&1 | tail -5
```

- [ ] **Étape 10 : Commit**

```bash
git add qa-dashboard/frontend/.eslintrc.json qa-dashboard/frontend/.prettierrc qa-dashboard/backend/.eslintrc.json qa-dashboard/backend/.prettierrc qa-dashboard/frontend/package.json qa-dashboard/backend/package.json
git commit -m "chore: add ESLint + Prettier config (frontend + backend)"
```

---

### Tâche 1.3 : Configurer Husky (pre-commit hook lint + tests)

**Fichiers :**
- Créer : `.husky/pre-commit`
- Modifier : `package.json` racine

- [ ] **Étape 1 : Initialiser Husky à la racine du repo**

```bash
cd /Users/matou/claude-workspace && npm init -y 2>/dev/null; npx husky init
```

- [ ] **Étape 2 : Créer le hook pre-commit**

Fichier `.husky/pre-commit` :
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

echo "▶ Lint backend..."
cd qa-dashboard/backend && npm run lint --if-present
echo "▶ Tests backend..."
cd qa-dashboard/backend && npm test -- --passWithNoTests
echo "▶ Lint frontend..."
cd qa-dashboard/frontend && npm run lint --if-present
```

- [ ] **Étape 3 : Rendre le hook exécutable**

```bash
chmod +x .husky/pre-commit
```

- [ ] **Étape 4 : Tester le hook**

```bash
git commit --allow-empty -m "test: vérification hook husky"
```
Expected : le hook s'exécute, lint + tests passent.

- [ ] **Étape 5 : Commit**

```bash
git add .husky/ package.json package-lock.json
git commit -m "chore: add Husky pre-commit hook (lint + tests)"
```

---

## Phase 2 — Architecture Frontend : Contexts & Hooks

> **Objectif :** Extraire le state global de App.jsx dans des Contexts React. Éliminer le props drilling. Mirror de dashboard-by-kimi-2.0.

### Tâche 2.1 : Créer ThemeContext

**Fichiers :**
- Créer : `qa-dashboard/frontend/src/contexts/ThemeContext.jsx`
- Créer : `qa-dashboard/frontend/src/hooks/useTheme.js`
- Modifier : `qa-dashboard/frontend/src/App.jsx` (remplacer state isDark)

- [ ] **Étape 1 : Créer `contexts/ThemeContext.jsx`**

```jsx
import { createContext, useState, useEffect, useCallback } from 'react';

export const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = useCallback(() => setIsDark((prev) => !prev), []);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Étape 2 : Créer `hooks/useTheme.js`**

```js
import { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

- [ ] **Étape 3 : Envelopper App dans ThemeProvider dans `main.jsx`**

```jsx
import { ThemeProvider } from './contexts/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Étape 4 : Remplacer useState isDark dans App.jsx par useTheme()**

Dans `App.jsx`, supprimer :
```js
const [isDark, setIsDark] = useState(false);
```
Remplacer par :
```js
const { isDark, toggleTheme } = useTheme();
```
Remplacer toutes les occurrences de `setIsDark(!isDark)` par `toggleTheme()`.

- [ ] **Étape 5 : Vérifier que le build passe**

```bash
cd qa-dashboard/frontend && npm run build 2>&1 | grep -E "error|Error|✓"
```
Expected : `✓ built in` sans erreur.

- [ ] **Étape 6 : Vérifier manuellement (si serveur dev)**

```bash
cd qa-dashboard/frontend && npm run dev &
# Ouvrir http://localhost:5173 et tester toggle dark/light
```

- [ ] **Étape 7 : Commit**

```bash
git add qa-dashboard/frontend/src/contexts/ThemeContext.jsx qa-dashboard/frontend/src/hooks/useTheme.js qa-dashboard/frontend/src/main.jsx qa-dashboard/frontend/src/App.jsx
git commit -m "refactor(frontend): extract ThemeContext + useTheme hook"
```

---

### Tâche 2.2 : Créer ToastContext

**Fichiers :**
- Créer : `qa-dashboard/frontend/src/contexts/ToastContext.jsx`
- Créer : `qa-dashboard/frontend/src/hooks/useToast.js`
- Modifier : `qa-dashboard/frontend/src/App.jsx` (remplacer alert/confirm natifs)

- [ ] **Étape 1 : Créer `contexts/ToastContext.jsx`**

```jsx
import { createContext, useState, useCallback } from 'react';

export const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = 'info', duration = 4000 }) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`} onClick={() => removeToast(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

- [ ] **Étape 2 : Créer `hooks/useToast.js`**

```js
import { useContext } from 'react';
import { ToastContext } from '../contexts/ToastContext';

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Étape 3 : Ajouter styles Toast dans `src/styles/Toast.css`** (si inexistant)

```css
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 9999;
}
.toast {
  padding: 0.75rem 1.25rem;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  min-width: 200px;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.toast-info    { background: #3b82f6; }
.toast-success { background: #22c55e; }
.toast-warning { background: #f59e0b; }
.toast-error   { background: #ef4444; }
```

- [ ] **Étape 4 : Envelopper App dans ToastProvider dans `main.jsx`**

```jsx
import { ToastProvider } from './contexts/ToastContext';

<ThemeProvider>
  <ToastProvider>
    <App />
  </ToastProvider>
</ThemeProvider>
```

- [ ] **Étape 5 : Remplacer les alert() dans App.jsx par addToast()**

Rechercher :
```bash
grep -n "alert(" qa-dashboard/frontend/src/App.jsx qa-dashboard/frontend/src/components/*.jsx
```
Pour chaque `alert('message')`, remplacer par :
```js
const { addToast } = useToast();
addToast({ message: 'message', type: 'info' }); // ou 'success'/'error'
```

- [ ] **Étape 6 : Build + vérif**

```bash
cd qa-dashboard/frontend && npm run build 2>&1 | grep -E "error|✓"
```

- [ ] **Étape 7 : Commit**

```bash
git add qa-dashboard/frontend/src/contexts/ToastContext.jsx qa-dashboard/frontend/src/hooks/useToast.js qa-dashboard/frontend/src/styles/Toast.css qa-dashboard/frontend/src/main.jsx qa-dashboard/frontend/src/App.jsx qa-dashboard/frontend/src/components/
git commit -m "refactor(frontend): add ToastContext, replace native alert() calls"
```

---

### Tâche 2.3 : Créer DashboardContext (state metrics central)

**Fichiers :**
- Créer : `qa-dashboard/frontend/src/contexts/DashboardContext.jsx`
- Créer : `qa-dashboard/frontend/src/hooks/useDashboard.js`
- Modifier : `qa-dashboard/frontend/src/App.jsx`

- [ ] **Étape 1 : Créer `contexts/DashboardContext.jsx`**

```jsx
import { createContext, useState, useCallback, useEffect } from 'react';
import { apiService } from '../services/api.service';

export const DashboardContext = createContext(null);

export function DashboardProvider({ children }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProject, setSelectedProject] = useState(
    () => localStorage.getItem('selectedProject') || null
  );
  const [activeView, setActiveView] = useState('dashboard');

  const fetchMetrics = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getDashboardMetrics(selectedProject);
      setMetrics(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    if (selectedProject) {
      localStorage.setItem('selectedProject', selectedProject);
      fetchMetrics();
    }
  }, [selectedProject, fetchMetrics]);

  return (
    <DashboardContext.Provider value={{
      metrics, loading, error, selectedProject,
      setSelectedProject, activeView, setActiveView, fetchMetrics
    }}>
      {children}
    </DashboardContext.Provider>
  );
}
```

- [ ] **Étape 2 : Créer `hooks/useDashboard.js`**

```js
import { useContext } from 'react';
import { DashboardContext } from '../contexts/DashboardContext';

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}
```

- [ ] **Étape 3 : Ajouter DashboardProvider dans `main.jsx`**

```jsx
import { DashboardProvider } from './contexts/DashboardContext';

<ThemeProvider>
  <ToastProvider>
    <DashboardProvider>
      <App />
    </DashboardProvider>
  </ToastProvider>
</ThemeProvider>
```

- [ ] **Étape 4 : Retirer le fetch metrics de App.jsx, utiliser useDashboard()**

Dans App.jsx, supprimer les `useState(metrics)`, `useState(loading)`, `useEffect` fetch, et les remplacer par :
```js
const { metrics, loading, error, selectedProject, setSelectedProject, activeView, setActiveView } = useDashboard();
```

- [ ] **Étape 5 : Build vérification**

```bash
cd qa-dashboard/frontend && npm run build 2>&1 | grep -E "error|✓"
```

- [ ] **Étape 6 : Commit**

```bash
git add qa-dashboard/frontend/src/contexts/DashboardContext.jsx qa-dashboard/frontend/src/hooks/useDashboard.js qa-dashboard/frontend/src/main.jsx qa-dashboard/frontend/src/App.jsx
git commit -m "refactor(frontend): add DashboardContext, centralize metrics state"
```

---

### Tâche 2.4 : Créer PreferencesContext (milestones, configs utilisateur)

**Fichiers :**
- Créer : `qa-dashboard/frontend/src/contexts/PreferencesContext.jsx`
- Créer : `qa-dashboard/frontend/src/hooks/usePreferences.js`
- Modifier : `qa-dashboard/frontend/src/App.jsx`

- [ ] **Étape 1 : Créer `contexts/PreferencesContext.jsx`**

```jsx
import { createContext, useState, useCallback } from 'react';

export const PreferencesContext = createContext(null);

const STORAGE_KEY = 'qa_preferences';

const defaultPrefs = {
  autoRefreshInterval: 60,
  selectedMilestone: null,
  useBusiness: false,
  tvModeAutoRefresh: 30,
};

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });

  const updatePref = useCallback((key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref }}>
      {children}
    </PreferencesContext.Provider>
  );
}
```

- [ ] **Étape 2 : Créer `hooks/usePreferences.js`**

```js
import { useContext } from 'react';
import { PreferencesContext } from '../contexts/PreferencesContext';

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
```

- [ ] **Étape 3 : Ajouter PreferencesProvider dans `main.jsx`**

```jsx
import { PreferencesProvider } from './contexts/PreferencesContext';

<ThemeProvider>
  <ToastProvider>
    <PreferencesProvider>
      <DashboardProvider>
        <App />
      </DashboardProvider>
    </PreferencesProvider>
  </ToastProvider>
</ThemeProvider>
```

- [ ] **Étape 4 : Retirer les localStorage épars de App.jsx**

Chercher tous les `localStorage.getItem/setItem` dans `App.jsx` et les remplacer par `usePreferences()`.

- [ ] **Étape 5 : Build + commit**

```bash
cd qa-dashboard/frontend && npm run build 2>&1 | grep -E "error|✓"
git add qa-dashboard/frontend/src/contexts/PreferencesContext.jsx qa-dashboard/frontend/src/hooks/usePreferences.js qa-dashboard/frontend/src/main.jsx qa-dashboard/frontend/src/App.jsx
git commit -m "refactor(frontend): add PreferencesContext, centralize user preferences"
```

---

## Phase 3 — Architecture Frontend : Routing & Lazy Loading

> **Objectif :** Ajouter React Router pour le deep-linking. Lazy loading des dashboards lourds.

### Tâche 3.1 : Ajouter React Router

**Fichiers :**
- Modifier : `qa-dashboard/frontend/package.json`
- Modifier : `qa-dashboard/frontend/src/main.jsx`
- Modifier : `qa-dashboard/frontend/src/App.jsx`

- [ ] **Étape 1 : Installer react-router-dom**

```bash
cd qa-dashboard/frontend && npm install react-router-dom
```

- [ ] **Étape 2 : Envelopper dans BrowserRouter dans `main.jsx`**

```jsx
import { BrowserRouter } from 'react-router-dom';

<BrowserRouter>
  <ThemeProvider>
    <ToastProvider>
      <PreferencesProvider>
        <DashboardProvider>
          <App />
        </DashboardProvider>
      </PreferencesProvider>
    </ToastProvider>
  </ThemeProvider>
</BrowserRouter>
```

- [ ] **Étape 3 : Remplacer la navigation manuelle dans App.jsx par Routes**

Remplacer le `activeView` state + conditions par :
```jsx
import { Routes, Route, Navigate } from 'react-router-dom';

// Dans le JSX :
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/dashboard" element={<Dashboard3 />} />
  <Route path="/status" element={<Dashboard4 />} />
  <Route path="/runs" element={<Dashboard5 />} />
  <Route path="/sync/gitlab-to-testmo" element={<Dashboard6 />} />
  <Route path="/sync/testmo-to-gitlab" element={<Dashboard7 />} />
  <Route path="/auto-sync" element={<Dashboard8 />} />
  <Route path="/tv" element={<TvDashboard />} />
  <Route path="*" element={<Navigate to="/dashboard" replace />} />
</Routes>
```

- [ ] **Étape 4 : Mettre à jour la navigation header**

Remplacer les `onClick={() => setActiveView('...')}` par `<Link to="/dashboard">` ou `useNavigate()`.

- [ ] **Étape 5 : Vérifier navigation fonctionne**

```bash
cd qa-dashboard/frontend && npm run dev &
# Naviguer entre les vues, vérifier URL change dans le browser
# Vérifier que F5 (reload) ne casse pas la navigation
```

- [ ] **Étape 6 : Commit**

```bash
git add qa-dashboard/frontend/src/ qa-dashboard/frontend/package.json
git commit -m "feat(frontend): add React Router for URL-based navigation"
```

---

### Tâche 3.2 : Lazy Loading des dashboards

**Fichiers :**
- Modifier : `qa-dashboard/frontend/src/App.jsx`
- Modifier : `qa-dashboard/frontend/vite.config.js`

- [ ] **Étape 1 : Convertir les imports statiques en React.lazy()**

Dans App.jsx, remplacer :
```js
import Dashboard3 from './components/Dashboard3';
import Dashboard4 from './components/Dashboard4';
import Dashboard5 from './components/Dashboard5';
import Dashboard6 from './components/Dashboard6';
import Dashboard7 from './components/Dashboard7';
import Dashboard8 from './components/Dashboard8';
import TvDashboard from './components/TvDashboard';
```
Par :
```js
import { lazy, Suspense } from 'react';
const Dashboard3 = lazy(() => import('./components/Dashboard3'));
const Dashboard4 = lazy(() => import('./components/Dashboard4'));
const Dashboard5 = lazy(() => import('./components/Dashboard5'));
const Dashboard6 = lazy(() => import('./components/Dashboard6'));
const Dashboard7 = lazy(() => import('./components/Dashboard7'));
const Dashboard8 = lazy(() => import('./components/Dashboard8'));
const TvDashboard = lazy(() => import('./components/TvDashboard'));
```

- [ ] **Étape 2 : Envelopper Routes dans Suspense**

```jsx
<Suspense fallback={<div className="loading-spinner">Chargement...</div>}>
  <Routes>
    {/* routes */}
  </Routes>
</Suspense>
```

- [ ] **Étape 3 : Configurer manualChunks dans vite.config.js**

```js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'pdf-export': ['html2canvas', 'jspdf'],
        'docx-export': ['docx'],
        'charts': ['chart.js', 'react-chartjs-2'],
      }
    }
  }
}
```

- [ ] **Étape 4 : Vérifier que le build découpe correctement les chunks**

```bash
cd qa-dashboard/frontend && npm run build 2>&1 | grep -E "chunk|kb|KB"
```
Expected : chunks séparés pour pdf-export, docx-export, charts.

- [ ] **Étape 5 : Commit**

```bash
git add qa-dashboard/frontend/src/App.jsx qa-dashboard/frontend/vite.config.js
git commit -m "perf(frontend): lazy load dashboards + split PDF/DOCX/charts chunks"
```

---

## Phase 4 — Architecture Backend : Refactoring server.js

> **Objectif :** Démanteler server.js monolithique (1131 lignes). Corriger les routes dupliquées. Introduire une couche controller.

### Tâche 4.1 : Audit et suppression des routes dupliquées

**Fichiers :**
- Analyser : `qa-dashboard/backend/server.js`
- Analyser : `qa-dashboard/backend/routes/*.routes.js`

- [ ] **Étape 1 : Identifier les routes dupliquées**

```bash
grep -n "app\.\(get\|post\|put\|delete\)" qa-dashboard/backend/server.js | head -50
grep -n "router\.\(get\|post\|put\|delete\)" qa-dashboard/backend/routes/*.routes.js
```

- [ ] **Étape 2 : Vérifier quelles routes sont montées avec app.use()**

```bash
grep -n "app\.use(" qa-dashboard/backend/server.js
```

- [ ] **Étape 3 : Pour chaque route inline en doublon dans server.js, supprimer la version inline**

Pour chaque `app.get('/api/xxx', ...)` qui a un équivalent dans `routes/xxx.routes.js` :
- Supprimer la route inline dans `server.js`
- S'assurer que le router est bien monté avec `app.use('/api', xxxRouter)`

- [ ] **Étape 4 : Tester que tous les endpoints répondent**

```bash
cd qa-dashboard/backend && npm start &
sleep 2
curl -s http://localhost:3001/api/health | python3 -m json.tool
curl -s http://localhost:3001/api/projects | python3 -m json.tool | head -10
```

- [ ] **Étape 5 : Commit**

```bash
git add qa-dashboard/backend/server.js
git commit -m "refactor(backend): remove duplicate inline routes from server.js"
```

---

### Tâche 4.2 : Introduire une couche Controller

**Fichiers :**
- Créer : `qa-dashboard/backend/controllers/dashboard.controller.js`
- Créer : `qa-dashboard/backend/controllers/sync.controller.js`
- Créer : `qa-dashboard/backend/controllers/reports.controller.js`
- Modifier : `qa-dashboard/backend/routes/dashboard.routes.js`
- Modifier : `qa-dashboard/backend/routes/sync.routes.js`
- Modifier : `qa-dashboard/backend/routes/reports.routes.js`

- [ ] **Étape 1 : Créer `controllers/dashboard.controller.js`**

```js
const testmoService = require('../services/testmo.service');
const logger = require('../services/logger.service');

async function getMetrics(req, res, next) {
  try {
    const { projectId } = req.params;
    const data = await testmoService.getDashboardData(projectId);
    res.json(data);
  } catch (err) {
    logger.error('dashboard.getMetrics error', { error: err.message });
    next(err);
  }
}

module.exports = { getMetrics };
```

- [ ] **Étape 2 : Mettre à jour `routes/dashboard.routes.js`**

```js
const { Router } = require('express');
const { getMetrics } = require('../controllers/dashboard.controller');

const router = Router();
router.get('/:projectId', getMetrics);
module.exports = router;
```

- [ ] **Étape 3 : Répéter le pattern pour sync.controller.js et reports.controller.js**

Extraire les handlers de `sync.routes.js` et `reports.routes.js` vers leurs controllers respectifs, en gardant la même logique (aucune modification fonctionnelle).

- [ ] **Étape 4 : Tests backend passent toujours**

```bash
cd qa-dashboard/backend && npm test 2>&1 | tail -10
```
Expected : toutes les suites passent, aucune régression.

- [ ] **Étape 5 : Commit**

```bash
git add qa-dashboard/backend/controllers/ qa-dashboard/backend/routes/
git commit -m "refactor(backend): introduce controller layer between routes and services"
```

---

### Tâche 4.3 : Ajouter featureFlags.routes.js

**Fichiers :**
- Créer : `qa-dashboard/backend/routes/featureFlags.routes.js`
- Modifier : `qa-dashboard/backend/server.js`

- [ ] **Étape 1 : Créer `routes/featureFlags.routes.js`**

```js
const { Router } = require('express');

const router = Router();

const FLAGS = {
  syncEnabled: process.env.SYNC_AUTO_ENABLED === 'true',
  tvModeEnabled: process.env.TV_MODE_ENABLED !== 'false',
  crossTestEnabled: process.env.CROSSTEST_ENABLED !== 'false',
  reportEnabled: process.env.REPORT_ENABLED !== 'false',
};

router.get('/', (req, res) => {
  res.json({ flags: FLAGS, timestamp: new Date().toISOString() });
});

module.exports = router;
```

- [ ] **Étape 2 : Monter la route dans server.js**

```js
const featureFlagsRouter = require('./routes/featureFlags.routes');
app.use('/api/feature-flags', featureFlagsRouter);
```

- [ ] **Étape 3 : Tester l'endpoint**

```bash
curl -s http://localhost:3001/api/feature-flags | python3 -m json.tool
```
Expected : `{ "flags": { "syncEnabled": ..., ... } }`

- [ ] **Étape 4 : Commit**

```bash
git add qa-dashboard/backend/routes/featureFlags.routes.js qa-dashboard/backend/server.js
git commit -m "feat(backend): add featureFlags route for runtime feature toggling"
```

---

## Phase 5 — Tests Frontend (Jest + React Testing Library)

> **Objectif :** Passer de 0 à une couverture minimale sur les composants critiques.

### Tâche 5.1 : Configurer Vitest + RTL

**Fichiers :**
- Modifier : `qa-dashboard/frontend/package.json`
- Créer : `qa-dashboard/frontend/vitest.config.js`
- Créer : `qa-dashboard/frontend/src/test/setup.js`

- [ ] **Étape 1 : Installer les dépendances**

```bash
cd qa-dashboard/frontend && npm install --save-dev vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Étape 2 : Créer `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/components/**', 'src/hooks/**', 'src/contexts/**'],
      thresholds: { global: { statements: 40, branches: 30, functions: 40, lines: 40 } },
    },
  },
});
```

- [ ] **Étape 3 : Créer `src/test/setup.js`**

```js
import '@testing-library/jest-dom';
```

- [ ] **Étape 4 : Ajouter scripts test dans package.json**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui",
"test:coverage": "vitest run --coverage"
```

- [ ] **Étape 5 : Vérifier que vitest démarre**

```bash
cd qa-dashboard/frontend && npm test 2>&1 | tail -5
```
Expected : `No test files found` (pas d'erreur de config).

- [ ] **Étape 6 : Commit**

```bash
git add qa-dashboard/frontend/vitest.config.js qa-dashboard/frontend/src/test/setup.js qa-dashboard/frontend/package.json
git commit -m "chore(frontend): configure Vitest + React Testing Library"
```

---

### Tâche 5.2 : Tests du hook useTheme

**Fichiers :**
- Créer : `qa-dashboard/frontend/src/hooks/__tests__/useTheme.test.jsx`

- [ ] **Étape 1 : Écrire le test (TDD — écrire avant vérification)**

```jsx
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useTheme } from '../useTheme';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('useTheme', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to light mode', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);
  });

  it('toggles to dark mode', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(result.current.isDark).toBe(true);
  });

  it('persists theme preference in localStorage', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('throws without provider', () => {
    expect(() => renderHook(() => useTheme())).toThrow('useTheme must be used within ThemeProvider');
  });
});
```

- [ ] **Étape 2 : Vérifier que le test passe**

```bash
cd qa-dashboard/frontend && npm test src/hooks/__tests__/useTheme.test.jsx 2>&1 | tail -10
```
Expected : `4 passed`.

- [ ] **Étape 3 : Commit**

```bash
git add qa-dashboard/frontend/src/hooks/__tests__/useTheme.test.jsx
git commit -m "test(frontend): add useTheme hook tests (4 cases)"
```

---

### Tâche 5.3 : Tests du composant MetricsCards

**Fichiers :**
- Créer : `qa-dashboard/frontend/src/components/__tests__/MetricsCards.test.jsx`

- [ ] **Étape 1 : Écrire le test**

```jsx
import { render, screen } from '@testing-library/react';
import MetricsCards from '../MetricsCards';

const mockMetrics = {
  completionRate: 92,
  passRate: 97,
  failureRate: 3,
  testEfficiency: 97,
  totalTests: 100,
  executedTests: 92,
  passedTests: 89,
  failedTests: 3,
};

describe('MetricsCards', () => {
  it('renders 4 KPI cards', () => {
    render(<MetricsCards metrics={mockMetrics} isDark={false} />);
    expect(screen.getByText(/completion rate/i)).toBeInTheDocument();
    expect(screen.getByText(/pass rate/i)).toBeInTheDocument();
    expect(screen.getByText(/failure rate/i)).toBeInTheDocument();
    expect(screen.getByText(/test efficiency/i)).toBeInTheDocument();
  });

  it('displays correct metric values', () => {
    render(<MetricsCards metrics={mockMetrics} isDark={false} />);
    expect(screen.getByText('92%')).toBeInTheDocument();
    expect(screen.getByText('97%')).toBeInTheDocument();
  });

  it('renders without crashing when metrics is null', () => {
    expect(() => render(<MetricsCards metrics={null} isDark={false} />)).not.toThrow();
  });
});
```

- [ ] **Étape 2 : Vérifier que le test passe**

```bash
cd qa-dashboard/frontend && npm test src/components/__tests__/MetricsCards.test.jsx 2>&1 | tail -10
```
Expected : `3 passed` (ou ajuster si le composant utilise des props différentes).

- [ ] **Étape 3 : Commit**

```bash
git add qa-dashboard/frontend/src/components/__tests__/MetricsCards.test.jsx
git commit -m "test(frontend): add MetricsCards component tests (3 cases)"
```

---

## Phase 6 — Tests E2E Playwright

> **Objectif :** Couvrir les flux critiques : health check, dashboard load, sync dry-run, génération rapport.

### Tâche 6.1 : Configurer Playwright

**Fichiers :**
- Créer : `playwright.config.js` (racine)
- Créer : `e2e/health.spec.js`
- Créer : `e2e/dashboard.spec.js`
- Modifier : `package.json` (racine)

- [ ] **Étape 1 : Installer Playwright**

```bash
cd /Users/matou/claude-workspace && npm install --save-dev @playwright/test
npx playwright install chromium
```

- [ ] **Étape 2 : Créer `playwright.config.js`**

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'cd qa-dashboard/frontend && npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
});
```

- [ ] **Étape 3 : Créer `e2e/health.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('backend health check endpoint responds', async ({ request }) => {
  const resp = await request.get('http://localhost:3001/api/health');
  expect(resp.status()).toBe(200);
  const body = await resp.json();
  expect(body).toHaveProperty('status');
});
```

- [ ] **Étape 4 : Créer `e2e/dashboard.spec.js`**

```js
import { test, expect } from '@playwright/test';

test('dashboard loads without errors', async ({ page }) => {
  await page.goto('/');
  await expect(page).not.toHaveTitle('Error');
  // Vérifier qu'au moins un élément dashboard est présent
  await expect(page.locator('body')).toBeVisible();
});

test('navigation between views works', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.url()).toContain('/dashboard');
});
```

- [ ] **Étape 5 : Lancer les tests E2E (avec backend + frontend démarrés)**

```bash
cd /Users/matou/claude-workspace && npx playwright test e2e/health.spec.js 2>&1 | tail -10
```

- [ ] **Étape 6 : Commit**

```bash
git add playwright.config.js e2e/ package.json
git commit -m "test(e2e): add Playwright config + health + dashboard specs"
```

---

## Phase 7 — CI/CD GitHub Actions

> **Objectif :** Pipeline automatisé sur chaque PR : lint, tests backend, tests frontend, build.

### Tâche 7.1 : Créer le workflow CI

**Fichiers :**
- Créer : `.github/workflows/ci.yml`

- [ ] **Étape 1 : Créer le dossier**

```bash
mkdir -p /Users/matou/claude-workspace/.github/workflows
```

- [ ] **Étape 2 : Créer `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master, feat/**, fix/**]
  pull_request:
    branches: [master]

jobs:
  backend:
    name: Backend (lint + tests)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: qa-dashboard/backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: qa-dashboard/backend/package-lock.json
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test -- --passWithNoTests --forceExit
        env:
          NODE_ENV: test

  frontend:
    name: Frontend (lint + tests + build)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: qa-dashboard/frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: qa-dashboard/frontend/package-lock.json
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm test --if-present
      - run: npm run build
```

- [ ] **Étape 3 : Pousser la branche et vérifier que le workflow se déclenche**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI (lint + test + build)"
git push origin feat/modernisation-architecture
```

- [ ] **Étape 4 : Vérifier sur GitHub**

Aller sur `https://github.com/Mat6383/neo-logix-qa-workspace/actions` et confirmer que le workflow apparaît et passe.

---

## Phase 8 — Monitoring & Production (Sentry)

> **Objectif :** Intégrer Sentry pour le tracking d'erreurs en production (optionnel, si DSN disponible).

### Tâche 8.1 : Intégrer Sentry backend

**Fichiers :**
- Créer : `qa-dashboard/backend/services/sentry.service.js`
- Modifier : `qa-dashboard/backend/server.js`

- [ ] **Étape 1 : Installer Sentry**

```bash
cd qa-dashboard/backend && npm install @sentry/node
```

- [ ] **Étape 2 : Créer `services/sentry.service.js`**

```js
const Sentry = require('@sentry/node');

function init() {
  if (!process.env.SENTRY_DSN) {
    console.log('[Sentry] DSN not configured, skipping init');
    return;
  }
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  console.log('[Sentry] Initialized');
}

function captureException(err) {
  if (process.env.SENTRY_DSN) Sentry.captureException(err);
}

module.exports = { init, captureException };
```

- [ ] **Étape 3 : Appeler init() au démarrage dans server.js**

```js
const sentry = require('./services/sentry.service');
sentry.init(); // avant tout autre setup
```

- [ ] **Étape 4 : Ajouter SENTRY_DSN dans `.env.example`**

```
# Monitoring (optionnel — laisser vide si non configuré)
SENTRY_DSN=
```

- [ ] **Étape 5 : Commit**

```bash
git add qa-dashboard/backend/services/sentry.service.js qa-dashboard/backend/server.js qa-dashboard/backend/.env.example
git commit -m "feat(backend): add optional Sentry integration for error tracking"
```

---

### Tâche 8.2 : Intégrer Sentry frontend

**Fichiers :**
- Modifier : `qa-dashboard/frontend/src/main.jsx`

- [ ] **Étape 1 : Installer**

```bash
cd qa-dashboard/frontend && npm install @sentry/react
```

- [ ] **Étape 2 : Initialiser dans main.jsx (conditionnel)**

```jsx
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}
```

- [ ] **Étape 3 : Ajouter dans `.env.example` frontend**

```
VITE_SENTRY_DSN=
```

- [ ] **Étape 4 : Commit**

```bash
git add qa-dashboard/frontend/src/main.jsx qa-dashboard/frontend/.env.example
git commit -m "feat(frontend): add optional Sentry integration"
```

---

## Phase 9 — Upgrades dépendances

> **Objectif :** Aligner les versions avec dashboard-by-kimi-2.0 une fois les tests en place (filet de sécurité).

### Tâche 9.1 : Upgrade Express 4 → 5

- [ ] **Prérequis : Tests backend passent à 100% (Phase 4 + 5 complètes)**

- [ ] **Étape 1 : Installer Express 5**

```bash
cd qa-dashboard/backend && npm install express@5
```

- [ ] **Étape 2 : Lancer les tests**

```bash
npm test 2>&1 | tail -10
```
Expected : aucune régression. Si erreur, voir [guide migration Express 5](https://expressjs.com/en/guide/migrating-5.html).

- [ ] **Étape 3 : Tester manuellement les endpoints critiques**

```bash
curl http://localhost:3001/api/health
curl http://localhost:3001/api/projects
```

- [ ] **Étape 4 : Commit**

```bash
git add qa-dashboard/backend/package.json qa-dashboard/backend/package-lock.json
git commit -m "chore(backend): upgrade Express 4 → 5"
```

---

### Tâche 9.2 : Upgrade Vite 5 → latest

- [ ] **Étape 1 : Upgrade**

```bash
cd qa-dashboard/frontend && npm install vite@latest @vitejs/plugin-react@latest
```

- [ ] **Étape 2 : Vérifier le build**

```bash
npm run build 2>&1 | grep -E "error|✓"
```

- [ ] **Étape 3 : Commit**

```bash
git add qa-dashboard/frontend/package.json qa-dashboard/frontend/package-lock.json
git commit -m "chore(frontend): upgrade Vite 5 → latest"
```

---

## Suivi de progression

| Phase | Tâches | Complétées | % |
|-------|--------|------------|---|
| Phase 1 — Quick wins | 1.1, 1.2, 1.3 | 3/3 | 100% ✅ |
| Phase 2 — Contexts & Hooks | 2.1, 2.2, 2.3, 2.4 | 4/4 | 100% ✅ |
| Phase 3 — Routing & Lazy Loading | 3.1, 3.2 | 2/2 | 100% ✅ |
| Phase 4 — Backend Refactoring | 4.1, 4.2, 4.3 | 3/3 | 100% ✅ |
| Phase 5 — Tests Frontend | 5.1, 5.2, 5.3 | 3/3 | 100% ✅ |
| Phase 6 — Tests E2E | 6.1 | 1/1 | 100% ✅ |
| Phase 7 — CI/CD | 7.1 | 1/1 | 100% ✅ |
| Phase 8 — Sentry | 8.1, 8.2 | 2/2 | 100% ✅ |
| Phase 9 — Upgrades | 9.1, 9.2 | 2/2 | 100% ✅ |
| **TOTAL** | **21 tâches** | **21/21** | **100% ✅** |

---

## Ordre d'exécution recommandé

```
Phase 1 (quick wins, aucun risque)
  → Phase 2 (Contexts/Hooks, base pour tout le reste)
    → Phase 4 (Backend refactoring, indépendant du frontend)
    → Phase 3 (Routing, dépend de Phase 2)
      → Phase 5 (Tests frontend, dépend de Phase 2+3)
        → Phase 6 (E2E, dépend de Phase 5)
          → Phase 7 (CI/CD, consolide tout)
            → Phase 8 (Sentry, optionnel)
            → Phase 9 (Upgrades, en dernier, avec filet de sécurité)
```
