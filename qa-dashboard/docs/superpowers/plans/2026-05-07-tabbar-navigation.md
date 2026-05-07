# TabBar Navigation + Dashboard Principal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la dropdown de navigation par une TabBar 2 rangées dans le header, et renommer Dashboard4 en DashboardPrincipal partout.

**Architecture:** Nouveau composant isolé `TabBar.jsx` (tabs primaires + sous-menu Outils). App.jsx intègre la TabBar en row 2 du header et supprime la `<select>` de navigation. Dashboard4.jsx est renommé DashboardPrincipal.jsx avec mise à jour de tous les imports et tests.

**Tech Stack:** React 18, React Router v7, Vitest + RTL, CSS variables existantes (`--color-primary`, `--header-bg`, `--border-color`, etc.)

---

## File Map

| Action | Fichier | Responsabilité |
|--------|---------|----------------|
| RENAME | `src/components/Dashboard4.jsx` → `DashboardPrincipal.jsx` | Vue principale globale + PDF |
| RENAME | `src/components/__tests__/Dashboard4.global.test.jsx` → `DashboardPrincipal.test.jsx` | Tests de DashboardPrincipal |
| CREATE | `src/components/TabBar.jsx` | Tabs primaires + sous-menu Outils |
| CREATE | `src/styles/TabBar.css` | Styles du composant TabBar |
| CREATE | `src/components/__tests__/TabBar.test.jsx` | 8 tests Vitest + RTL |
| MODIFY | `src/App.jsx` | Import + routes + header 2 rangées |
| MODIFY | `src/styles/App.css` | Header → layout 2 rangées |

---

## Task 1 — Renommer Dashboard4 → DashboardPrincipal

**Files:**
- Create: `src/components/DashboardPrincipal.jsx`
- Create: `src/components/__tests__/DashboardPrincipal.test.jsx`
- Delete: `src/components/Dashboard4.jsx`
- Delete: `src/components/__tests__/Dashboard4.global.test.jsx`

- [ ] **Step 1.1 — Créer DashboardPrincipal.jsx**

Copier le contenu de `Dashboard4.jsx` dans `DashboardPrincipal.jsx` en changeant uniquement le nom de la fonction et le export :

```bash
cp frontend/src/components/Dashboard4.jsx frontend/src/components/DashboardPrincipal.jsx
```

Puis dans `frontend/src/components/DashboardPrincipal.jsx`, changer les lignes 13 et 570 :

```jsx
// ligne 13 — avant :
const Dashboard4 = ({ metrics, project, projects = [], projectId, onProjectChange, isDark = false, useBusiness = true, setExportHandler, setCsvExportHandler, showProductionSection = true, onToggleProductionSection }) => {

// ligne 13 — après :
const DashboardPrincipal = ({ metrics, project, projects = [], projectId, onProjectChange, isDark = false, useBusiness = true, setExportHandler, setCsvExportHandler, showProductionSection = true, onToggleProductionSection }) => {
```

```jsx
// ligne 570 — avant :
export default Dashboard4;

// ligne 570 — après :
export default DashboardPrincipal;
```

- [ ] **Step 1.2 — Créer DashboardPrincipal.test.jsx**

```bash
cp frontend/src/components/__tests__/Dashboard4.global.test.jsx \
   frontend/src/components/__tests__/DashboardPrincipal.test.jsx
```

Puis dans `DashboardPrincipal.test.jsx`, changer les lignes d'import :

```jsx
// avant :
import Dashboard4 from '../Dashboard4';

// après :
import DashboardPrincipal from '../DashboardPrincipal';
```

Et changer toutes les occurrences de `<Dashboard4` en `<DashboardPrincipal` et `Dashboard4` en `DashboardPrincipal` dans le contenu du fichier (render calls, describe labels) :

```bash
sed -i '' 's/Dashboard4/DashboardPrincipal/g' \
  frontend/src/components/__tests__/DashboardPrincipal.test.jsx
```

- [ ] **Step 1.3 — Vérifier que les nouveaux tests passent**

```bash
cd frontend
npx vitest run src/components/__tests__/DashboardPrincipal.test.jsx
```

Résultat attendu : tous les tests passent (même nombre qu'avant dans Dashboard4.global.test.jsx).

- [ ] **Step 1.4 — Supprimer les anciens fichiers**

```bash
rm frontend/src/components/Dashboard4.jsx
rm frontend/src/components/__tests__/Dashboard4.global.test.jsx
```

- [ ] **Step 1.5 — Vérifier qu'aucune référence à Dashboard4 ne reste**

```bash
grep -r "Dashboard4" frontend/src/ --include="*.jsx" --include="*.js" --include="*.css"
```

Résultat attendu : aucune ligne (0 résultats).

- [ ] **Step 1.6 — Commit**

```bash
git add frontend/src/components/DashboardPrincipal.jsx \
        frontend/src/components/__tests__/DashboardPrincipal.test.jsx
git rm frontend/src/components/Dashboard4.jsx \
       frontend/src/components/__tests__/Dashboard4.global.test.jsx
git commit -m "refactor: Dashboard4 → DashboardPrincipal (rename complet)"
```

---

## Task 2 — Créer TabBar.jsx (TDD)

**Files:**
- Create: `src/components/__tests__/TabBar.test.jsx`
- Create: `src/components/TabBar.jsx`
- Create: `src/styles/TabBar.css`

- [ ] **Step 2.1 — Écrire les tests (fichier doit échouer)**

Créer `frontend/src/components/__tests__/TabBar.test.jsx` :

```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabBar from '../TabBar';

describe('TabBar', () => {
  it('rend les 7 tabs primaires', () => {
    render(<TabBar activeTab="principal" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dashboard Principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qualité' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tendances' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CrossTest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparaison' })).toBeInTheDocument();
  });

  it('le tab actif reçoit la classe tab-active', () => {
    render(<TabBar activeTab="quality" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Qualité' })).toHaveClass('tab-active');
    expect(screen.getByRole('button', { name: 'Standard' })).not.toHaveClass('tab-active');
  });

  it('click tab → onTabChange appelé avec le bon id', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="principal" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tendances' }));
    expect(onTabChange).toHaveBeenCalledWith('trends');
  });

  it('click Dashboard Principal → onTabChange("principal")', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="dashboard" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Principal' }));
    expect(onTabChange).toHaveBeenCalledWith('principal');
  });

  it('bouton "Outils ⚙" est visible', () => {
    render(<TabBar activeTab="principal" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Outils/i })).toBeInTheDocument();
  });

  it('click "Outils ⚙" → sous-menu visible avec 4 items', () => {
    render(<TabBar activeTab="principal" onTabChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    expect(screen.getByRole('button', { name: 'Configuration des Cycles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync GitLab → Testmo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto-Sync Testmo → GitLab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestionnaire de Runs' })).toBeInTheDocument();
  });

  it('click item sous-menu → onTabChange appelé + sous-menu fermé', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="principal" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Gestionnaire de Runs' }));
    expect(onTabChange).toHaveBeenCalledWith('runs-manage');
    expect(screen.queryByRole('button', { name: 'Gestionnaire de Runs' })).not.toBeInTheDocument();
  });

  it('click extérieur → sous-menu fermé', () => {
    render(
      <div>
        <TabBar activeTab="principal" onTabChange={vi.fn()} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    expect(screen.getByRole('button', { name: 'Configuration des Cycles' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('button', { name: 'Configuration des Cycles' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2.2 — Vérifier que les tests échouent**

```bash
cd frontend
npx vitest run src/components/__tests__/TabBar.test.jsx
```

Résultat attendu : FAIL (TabBar module not found).

- [ ] **Step 2.3 — Créer TabBar.css**

Créer `frontend/src/styles/TabBar.css` :

```css
.tab-bar {
  display: flex;
  align-items: stretch;
  border-top: 1px solid var(--border-color);
  background: var(--header-bg);
  padding: 0 var(--spacing-xl);
  overflow-x: auto;
  overflow-y: visible;
  position: relative;
}

.tab-item {
  padding: 0.7rem 1rem;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
  position: relative;
}

.tab-item:hover {
  color: var(--text-color);
  background: var(--color-gray-100);
}

.tab-active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

/* Dark theme */
.dark-theme .tab-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

/* Outils sous-menu */
.tab-tools {
  position: relative;
  margin-left: auto;
}

.tab-tools-trigger {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.tab-tools-menu {
  position: absolute;
  top: calc(100% + 2px);
  right: 0;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-md);
  z-index: 200;
  min-width: 220px;
  padding: 0.25rem 0;
}

.tab-tools-item {
  display: block;
  width: 100%;
  padding: 0.6rem 1rem;
  text-align: left;
  border: none;
  background: none;
  color: var(--text-color);
  cursor: pointer;
  font-size: 0.875rem;
  transition: background 0.1s;
}

.tab-tools-item:hover {
  background: var(--color-gray-100);
}

.dark-theme .tab-tools-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.tab-tools-item-active {
  color: var(--color-primary);
  font-weight: 600;
}
```

- [ ] **Step 2.4 — Créer TabBar.jsx**

Créer `frontend/src/components/TabBar.jsx` :

```jsx
import React, { useState, useEffect, useRef } from 'react';
import '../styles/TabBar.css';

const PRIMARY_TABS = [
  { id: 'principal', label: 'Dashboard Principal' },
  { id: 'dashboard', label: 'Standard' },
  { id: 'tv', label: 'TV' },
  { id: 'quality', label: 'Qualité' },
  { id: 'trends', label: 'Tendances' },
  { id: 'crosstest', label: 'CrossTest' },
  { id: 'compare', label: 'Comparaison' },
];

const TOOLS_ITEMS = [
  { id: 'config', label: 'Configuration des Cycles' },
  { id: 'sync-gitlab', label: 'Sync GitLab → Testmo' },
  { id: 'autosync', label: 'Auto-Sync Testmo → GitLab' },
  { id: 'runs-manage', label: 'Gestionnaire de Runs' },
];

const TabBar = ({ activeTab, onTabChange }) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isToolsActive = TOOLS_ITEMS.some((t) => t.id === activeTab);

  return (
    <nav className="tab-bar">
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item${activeTab === tab.id ? ' tab-active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}

      <div className="tab-tools" ref={toolsRef}>
        <button
          className={`tab-item tab-tools-trigger${isToolsActive ? ' tab-active' : ''}`}
          onClick={() => setToolsOpen((o) => !o)}
        >
          Outils ⚙
        </button>
        {toolsOpen && (
          <div className="tab-tools-menu">
            {TOOLS_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`tab-tools-item${activeTab === item.id ? ' tab-tools-item-active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  setToolsOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default TabBar;
```

- [ ] **Step 2.5 — Vérifier que les 8 tests passent**

```bash
cd frontend
npx vitest run src/components/__tests__/TabBar.test.jsx
```

Résultat attendu :
```
Tests  8 passed (8)
```

- [ ] **Step 2.6 — Commit**

```bash
git add frontend/src/components/TabBar.jsx \
        frontend/src/styles/TabBar.css \
        frontend/src/components/__tests__/TabBar.test.jsx
git commit -m "feat: TabBar component — tabs primaires + sous-menu Outils (8 tests)"
```

---

## Task 3 — Intégrer TabBar dans App.jsx + CSS header

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/styles/App.css`

- [ ] **Step 3.1 — Mettre à jour les imports dans App.jsx**

Dans `frontend/src/App.jsx`, remplacer :

```jsx
// avant (ligne 15) :
const Dashboard4 = lazy(() => import('./components/Dashboard4'));

// après :
const DashboardPrincipal = lazy(() => import('./components/DashboardPrincipal'));
```

Ajouter l'import de TabBar après les imports lazy (après la ligne `const ConfigurationScreen = ...`) :

```jsx
import TabBar from './components/TabBar';
```

- [ ] **Step 3.2 — Remplacer VIEW_TO_ROUTE/ROUTE_TO_VIEW par TAB_ROUTES**

Dans `frontend/src/App.jsx`, remplacer les lignes 35–53 (les deux constantes `VIEW_TO_ROUTE` et `ROUTE_TO_VIEW`) par :

```jsx
// Maps tab id → URL path
const TAB_ROUTES = {
  principal:    '/principal',
  dashboard:    '/dashboard',
  tv:           '/tv',
  quality:      '/quality',
  trends:       '/trends',
  crosstest:    '/crosstest',
  compare:      '/compare',
  config:       '/config',
  'sync-gitlab':'/sync/gitlab',
  autosync:     '/autosync',
  'runs-manage':'/runs/manage',
};

const ROUTE_TO_TAB = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])
);
```

- [ ] **Step 3.3 — Mettre à jour la dérivation de l'onglet actif**

Dans la fonction `App()`, remplacer la ligne :

```jsx
// avant (ligne 72) :
const dashboardView = ROUTE_TO_VIEW[pathname] || '1';

// après :
const activeTab = ROUTE_TO_TAB[pathname] || 'principal';
```

- [ ] **Step 3.4 — Supprimer la dropdown de navigation + ajouter TabBar au header**

Dans `frontend/src/App.jsx` :

**a) Supprimer le bloc dropdown vues** (lines ~166–185, le `<div style={{ marginLeft: '8px'... }}>` qui contient le `<select value={dashboardView}...>`) :

Supprimer entièrement :
```jsx
          <div style={{ marginLeft: '8px', marginRight: '8px' }}>
            <select
              value={dashboardView}
              onChange={(e) => navigate(VIEW_TO_ROUTE[e.target.value] || '/dashboard')}
              className="project-selector"
              style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
            >
              <option value="1">Dashboard 1 (Standard)</option>
              <option value="2">Dashboard 2 (TV)</option>
              <option value="3">Dashboard 3 (Quality Rates)</option>
              <option value="4">Dashboard 4 (Vue Globale & PDF)</option>
              <option value="5">Dashboard 5 (Tendances Annuelles)</option>
              <option value="7">⚙ Sync GitLab → Testmo</option>
              <option value="6">⚙️ Configuration des Cycles</option>
              <option value="8">🔗 CrossTest OK</option>
              <option value="9">🤖 Auto-Sync Testmo → GitLab</option>
              <option value="10">🧪 Gestionnaire de Runs</option>
              <option value="11">📊 Comparaison inter-milestones</option>
            </select>
          </div>
```

**b) Corriger les boutons CSV/PDF export** — ils vérifient `pathname === '/global'`, changer en `'/principal'` :

```jsx
// avant :
{pathname === '/global' && csvExportHandler && (
{pathname === '/global' && exportHandler && (

// après :
{pathname === '/principal' && csvExportHandler && (
{pathname === '/principal' && exportHandler && (
```

**c) Wrapper le contenu header en deux rangées** — remplacer la structure `<header>` :

```jsx
// avant :
<header className="app-header">
  <div className="header-left">
    ...
  </div>
  <div className="header-right">
    ...
  </div>
</header>

// après :
<header className="app-header">
  <div className="header-row-1">
    <div className="header-left">
      ...  {/* contenu inchangé */}
    </div>
    <div className="header-right">
      ...  {/* contenu inchangé — sans la dropdown vues */}
    </div>
  </div>
  <TabBar
    activeTab={activeTab}
    onTabChange={(tabId) => navigate(TAB_ROUTES[tabId])}
  />
</header>
```

**d) Supprimer le className `view-dash${dashboardView}`** dans la div racine :

```jsx
// avant (ligne 118) :
<div className={`app ${tvMode ? 'tv-mode' : ''} ${darkMode ? 'dark-theme' : ''} view-dash${dashboardView}`}>

// après :
<div className={`app ${tvMode ? 'tv-mode' : ''} ${darkMode ? 'dark-theme' : ''}`}>
```

- [ ] **Step 3.5 — Mettre à jour les routes React Router**

Dans `frontend/src/App.jsx`, mettre à jour les routes :

```jsx
// avant :
<Route path="/" element={<Navigate to="/dashboard" replace />} />

// après :
<Route path="/" element={<Navigate to="/principal" replace />} />
```

```jsx
// avant :
<Route path="/global" element={
  <Dashboard4
    ...
  />
} />

// après :
<Route path="/principal" element={
  <DashboardPrincipal
    metrics={metrics}
    project={projects.find(p => p.id === projectId)}
    projects={projects}
    projectId={projectId}
    onProjectChange={(id) => setProjectId(id)}
    isDark={darkMode}
    useBusiness={useBusinessTerms}
    setExportHandler={setExportHandler}
    setCsvExportHandler={setCsvExportHandler}
    showProductionSection={showProductionSection}
    onToggleProductionSection={(val) => updatePref('showProductionSection', val)}
  />
} />
```

```jsx
// Ajouter redirect pour ancienne route (compatibilité) :
<Route path="/global" element={<Navigate to="/principal" replace />} />
```

```jsx
// avant (wildcard fallback) :
<Route path="*" element={<Navigate to="/dashboard" replace />} />

// après :
<Route path="*" element={<Navigate to="/principal" replace />} />
```

```jsx
// ConfigurationScreen onSaveSelection — navigate vers /principal :
onSaveSelection={(preprodMilestones, prodMilestones) => {
  setSelectedPreprodMilestones(preprodMilestones || []);
  setSelectedProdMilestones(prodMilestones || []);
  navigate('/principal');
}}
```

- [ ] **Step 3.6 — Mettre à jour App.css pour le header 2 rangées**

Dans `frontend/src/styles/App.css`, trouver la règle `.app-header` (ligne ~160) et la remplacer :

```css
/* avant : */
.app-header {
  background: var(--header-bg);
  padding: var(--spacing-lg) var(--spacing-xl);
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 100;
}

/* après : */
.app-header {
  background: var(--header-bg);
  display: flex;
  flex-direction: column;
  box-shadow: var(--shadow-md);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-row-1 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-xl);
}
```

Le mode TV cache déjà l'ensemble de `.app-header` via `transform: translateY(-100%)` — aucune modification CSS nécessaire pour le mode TV.

- [ ] **Step 3.7 — Vérifier que tous les tests passent**

```bash
cd frontend
npx vitest run
```

Résultat attendu :
```
Test Files  27 passed (27)
Tests  217+ passed
```

Aucun test existant ne référence la dropdown de navigation — tous doivent passer sans modification.

- [ ] **Step 3.8 — Commit**

```bash
git add frontend/src/App.jsx \
        frontend/src/styles/App.css
git commit -m "feat: intégration TabBar dans App.jsx — header 2 rangées, dropdown supprimée, routes /principal"
```

---

## Task 4 — Vérification finale + ROADMAP

**Files:**
- Modify: `ROADMAP.md`

- [ ] **Step 4.1 — Lancer tous les tests (backend + frontend)**

```bash
cd backend && npx jest --passWithNoTests 2>&1 | tail -3
cd ../frontend && npx vitest run 2>&1 | tail -5
```

Résultats attendus :
- Backend : `569 passed, 569 total`
- Frontend : `27 passed` (fichiers) / `217+ passed` (tests)

- [ ] **Step 4.2 — Vérifier visuellement l'app (dev server)**

```bash
cd frontend && npm run dev
```

Ouvrir `http://localhost:3000` et vérifier :
- [ ] App s'ouvre sur Dashboard Principal (tab actif = "Dashboard Principal")
- [ ] Les 7 tabs primaires sont visibles dans la Row 2
- [ ] Click "Tendances" → navigate vers `/trends` → Dashboard5 s'affiche
- [ ] Click "Outils ⚙" → sous-menu avec 4 items s'affiche
- [ ] Click "Configuration des Cycles" → navigate `/config`
- [ ] Aucune dropdown de navigation dans la Row 1
- [ ] Sélecteur de projet toujours présent en Row 1
- [ ] Boutons CSV/PDF export visibles sur Dashboard Principal

- [ ] **Step 4.3 — Mettre à jour ROADMAP.md**

Ajouter en fin de tableau des sessions dans `ROADMAP.md` :

```markdown
| 2026-05-07 | Refonte navigation : TabBar 2 rangées (7 tabs primaires + Outils sous-menu), renommage Dashboard4 → DashboardPrincipal, suppression dropdown vues | `master` |
```

Mettre à jour le compteur de tests dans le header du ROADMAP si le total frontend augmente.

- [ ] **Step 4.4 — Commit final**

```bash
git add ROADMAP.md
git commit -m "docs: ROADMAP — TabBar navigation + DashboardPrincipal"
```

---

## Récapitulatif des commits

| # | Message | Contenu |
|---|---------|---------|
| 1 | `refactor: Dashboard4 → DashboardPrincipal (rename complet)` | DashboardPrincipal.jsx + test |
| 2 | `feat: TabBar component — tabs primaires + sous-menu Outils (8 tests)` | TabBar.jsx + TabBar.css + test |
| 3 | `feat: intégration TabBar dans App.jsx — header 2 rangées, dropdown supprimée, routes /principal` | App.jsx + App.css |
| 4 | `docs: ROADMAP — TabBar navigation + DashboardPrincipal` | ROADMAP.md |

---

## Critères de succès

- [ ] App charge sur `/principal` (Dashboard Principal) par défaut
- [ ] 7 tabs primaires visibles + sous-menu Outils fonctionnel
- [ ] Aucune dropdown de navigation dans le header
- [ ] `DashboardPrincipal` remplace `Dashboard4` partout
- [ ] 569 tests backend + 217+ tests frontend — tous verts
