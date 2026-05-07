# Design Spec — TabBar Navigation + Dashboard Principal

Date : 2026-05-07
Branche cible : `master`

---

## Contexte

L'interface actuelle utilise une `<select>` dropdown dans le header pour naviguer entre 11 vues. Cette dropdown est remplacée par une **TabBar underline en 2ème rangée du header**, sans perte de surface contenu. Dashboard4 devient "Dashboard Principal" (renommage complet).

---

## Architecture

### Nouveau composant `TabBar.jsx`

Responsabilité unique : afficher les onglets primaires + le sous-menu "Outils".

```
Props:
  activeTab : string  — identifiant de l'onglet actif (ex: 'principal')
  onTabChange : (tabId: string) => void  — callback de navigation
```

**TabBar ne connaît pas les routes React Router.** App.jsx reste maître de la navigation ; TabBar appelle `onTabChange`, App.jsx appelle `navigate()`.

### Structure header après refonte

```
┌──────────────────────────────────────────────────────────────────┐
│ Testmo Dashboard  [Projet ▾]           [refresh][dark][TV][export]│  ← Row 1 (inchangée sauf suppression dropdown vues)
├──────────────────────────────────────────────────────────────────┤
│ Dashboard Principal | Standard | TV | Qualité | Tendances |       │  ← Row 2 : TabBar
│ CrossTest | Comparaison |  Outils ⚙▾                             │
└──────────────────────────────────────────────────────────────────┘
```

**Suppression explicite :** le `<select>` de sélection de vue (dropdown "Dashboard 1 … Dashboard 11") est **retiré de la Row 1**. Aucun doublon de navigation.

Le `<select>` de sélection de **projet** reste en Row 1 — ce n'est pas de la navigation de vue, c'est de la sélection de données.

---

## Onglets

### Tabs primaires (7, toujours visibles)

| Ordre | Label | Route | Composant |
|-------|-------|-------|-----------|
| 1 | Dashboard Principal | `/principal` | `DashboardPrincipal.jsx` |
| 2 | Standard | `/dashboard` | *(inline App.jsx)* |
| 3 | TV | `/tv` | `TvDashboard.jsx` |
| 4 | Qualité | `/quality` | `Dashboard3.jsx` |
| 5 | Tendances | `/trends` | `Dashboard5.jsx` |
| 6 | CrossTest | `/crosstest` | `Dashboard7.jsx` |
| 7 | Comparaison | `/compare` | `Dashboard10.jsx` |

### Tab "Outils ⚙" (sous-menu dropdown, 4 items)

| Label | Route | Composant |
|-------|-------|-----------|
| Configuration des Cycles | `/config` | `ConfigurationScreen.jsx` |
| Sync GitLab → Testmo | `/sync/gitlab` | `Dashboard6.jsx` |
| Auto-Sync Testmo → GitLab | `/autosync` | `Dashboard8.jsx` |
| Gestionnaire de Runs | `/runs/manage` | `Dashboard9.jsx` |

### Route par défaut

`/` → redirect vers `/principal` (Dashboard Principal). Ancienne route `/global` → redirect `/principal`.

---

## Renommage Dashboard4 → DashboardPrincipal

| Avant | Après |
|-------|-------|
| `src/components/Dashboard4.jsx` | `src/components/DashboardPrincipal.jsx` |
| `src/components/__tests__/Dashboard4.global.test.jsx` | `src/components/__tests__/DashboardPrincipal.test.jsx` |
| Import lazy dans App.jsx | `DashboardPrincipal` |
| Route `/global` | `/principal` |
| Label dropdown "Dashboard 4 (Vue Globale & PDF)" | *(supprimé — remplacé par tab)* |
| `VIEW_TO_ROUTE['4']` | `VIEW_TO_ROUTE['principal']` ou mapping refactorisé |

Toutes les références internes à "Dashboard4" dans les commentaires, titres et libellés UI sont mises à jour.

---

## CSS

Fichier : `src/styles/App.css`

- Header passe de 1 à 2 rangées. Row 2 = `display: flex; gap: 0; border-bottom: 1px solid var(--border-color)`.
- Tab actif : `border-bottom: 2px solid var(--primary-color); color: var(--primary-color); font-weight: 600`.
- Tab hover : `background: var(--hover-bg)`.
- Sous-menu Outils : `position: absolute; top: 100%; left: 0; z-index: 100` — même pattern que les dropdowns existants. Fermé au clic extérieur (`useEffect` + listener).
- Aucune modification de la hauteur du conteneur de contenu.

---

## Tests

### Renommage
- `Dashboard4.global.test.jsx` → `DashboardPrincipal.test.jsx` — imports mis à jour, contenu identique.

### Nouveau fichier `TabBar.test.jsx`

8 tests Vitest + RTL :
1. Rendu des 7 tabs primaires
2. Tab "Dashboard Principal" actif par défaut
3. Click tab → `onTabChange` appelé avec le bon id
4. Tab actif reçoit la classe CSS active
5. Bouton "Outils ⚙" visible
6. Click "Outils ⚙" → sous-menu visible
7. Click item sous-menu → `onTabChange` appelé
8. Click extérieur → sous-menu fermé

---

## Périmètre explicitement hors-scope

- Contenu interne des dashboards : inchangé
- Logique métier (metrics, sync, alerts) : inchangée
- Backend : aucun changement
- Dashboard1 (Standard) inline dans App.jsx : rendu inchangé

---

## Critères de succès

- [ ] App charge sur Dashboard Principal par défaut
- [ ] Navigation par tabs fonctionne pour les 11 vues
- [ ] Dropdown de vue supprimée de Row 1 (aucun doublon)
- [ ] `DashboardPrincipal` remplace `Dashboard4` partout (fichiers, tests, labels)
- [ ] Sous-menu Outils s'ouvre/ferme correctement
- [ ] Tous les tests passent (569 backend + ~220 frontend attendus)
