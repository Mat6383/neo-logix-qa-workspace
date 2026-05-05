# Graph Report - /Users/matou/claude-workspace/qa-dashboard  (2026-05-05)

## Corpus Check
- 117 files · ~118,130 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 520 nodes · 694 edges · 96 communities (83 shown, 13 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.82)
- Token cost: 18,500 input · 3,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend CrossTest UI|Frontend CrossTest UI]]
- [[_COMMUNITY_Testmo Service & ISTQB Metrics|Testmo Service & ISTQB Metrics]]
- [[_COMMUNITY_GitLab Service & GraphQL|GitLab Service & GraphQL]]
- [[_COMMUNITY_Project Docs & Concepts|Project Docs & Concepts]]
- [[_COMMUNITY_API Service & Dashboard Views 6-9|API Service & Dashboard Views 6-9]]
- [[_COMMUNITY_App Root & Dashboard Views 3-5|App Root & Dashboard Views 3-5]]
- [[_COMMUNITY_Dashboard Controller & Metrics|Dashboard Controller & Metrics]]
- [[_COMMUNITY_Sync Service (GitLab→Testmo)|Sync Service (GitLab→Testmo)]]
- [[_COMMUNITY_DOCXPDF Report Generator|DOCX/PDF Report Generator]]
- [[_COMMUNITY_MetricsCards & UI Tests|MetricsCards & UI Tests]]
- [[_COMMUNITY_GitLab Service Tests|GitLab Service Tests]]
- [[_COMMUNITY_Sync Controller & Routes|Sync Controller & Routes]]
- [[_COMMUNITY_Status Sync Service (Testmo→GitLab)|Status Sync Service (Testmo→GitLab)]]
- [[_COMMUNITY_Integration & E2E Tests|Integration & E2E Tests]]
- [[_COMMUNITY_Routes Tests & CSRF|Routes Tests & CSRF]]
- [[_COMMUNITY_Unit Tests (Calculations)|Unit Tests (Calculations)]]
- [[_COMMUNITY_Auto-Sync Config & SQLite|Auto-Sync Config & SQLite]]
- [[_COMMUNITY_UI Helpers & Theme|UI Helpers & Theme]]
- [[_COMMUNITY_GraphQL Tests|GraphQL Tests]]
- [[_COMMUNITY_Run Manager Service|Run Manager Service]]
- [[_COMMUNITY_Module 20|Module 20]]
- [[_COMMUNITY_Module 21|Module 21]]
- [[_COMMUNITY_Module 22|Module 22]]
- [[_COMMUNITY_Module 23|Module 23]]
- [[_COMMUNITY_Module 24|Module 24]]
- [[_COMMUNITY_Module 27|Module 27]]
- [[_COMMUNITY_Module 28|Module 28]]
- [[_COMMUNITY_Module 31|Module 31]]
- [[_COMMUNITY_Module 33|Module 33]]
- [[_COMMUNITY_Module 35|Module 35]]
- [[_COMMUNITY_Module 40|Module 40]]
- [[_COMMUNITY_Module 41|Module 41]]
- [[_COMMUNITY_Module 56|Module 56]]
- [[_COMMUNITY_Module 57|Module 57]]
- [[_COMMUNITY_Module 93|Module 93]]
- [[_COMMUNITY_Module 94|Module 94]]
- [[_COMMUNITY_Module 95|Module 95]]

## God Nodes (most connected - your core abstractions)
1. `TestmoService` - 29 edges
2. `Backend Express Server` - 26 edges
3. `GitLabService` - 24 edges
4. `testmo.service` - 22 edges
5. `logger.service` - 17 edges
6. `SyncService` - 15 edges
7. `generateQuickClosureDoc()` - 14 edges
8. `sync.service` - 14 edges
9. `useToast()` - 13 edges
10. `status-sync.service` - 12 edges

## Surprising Connections (you probably didn't know these)
- `QUICK_START.md — 5-minute setup guide` --semantically_similar_to--> `CLAUDE.md — Project guidance for Claude Code agents`  [INFERRED] [semantically similar]
  QUICK_START.md → CLAUDE.md
- `RAPPORT_ANALYSE_QA_DASHBOARD.md — Full static analysis report` --semantically_similar_to--> `IMPROVEMENTS.md — 15 audit findings tracker`  [INFERRED] [semantically similar]
  RAPPORT_ANALYSE_QA_DASHBOARD.md → IMPROVEMENTS.md
- `health.spec.js (Playwright E2E)` --references--> `testmo.service`  [INFERRED]
  e2e/health.spec.js → backend/services/testmo.service.js
- `generate_R06_pptx.js (standalone script)` --conceptually_related_to--> `report.service`  [INFERRED]
  reports/generate_R06_pptx.js → backend/services/report.service.js
- `Dashboard4()` --calls--> `getAlertForMetric()`  [INFERRED]
  frontend/src/components/Dashboard4.jsx → backend/tests/integrity.guards.test.js

## Hyperedges (group relationships)
- **React Context Provider Tree (Theme, Toast, Preferences, Dashboard)** — themecontext_jsx, toastcontext_jsx, preferencescontext_jsx, dashboardcontext_jsx, main_jsx, app_jsx [EXTRACTED 1.00]
- **ISTQB Dashboard Views (3=Quality Rates, 4=Global, 5=Trends)** — dashboard3_jsx, dashboard4_jsx, dashboard5_jsx, istqb_metrics_rationale [EXTRACTED 1.00]
- **Document Export Pipeline (DOCX and PDF generation)** — docxgenerator_js, quickclosuremodal_jsx, testclosuremodal_jsx, dashboard4_jsx [EXTRACTED 1.00]
- **Run management workflow (create/merge Testmo runs)** — runactionpanel_jsx, api_service [EXTRACTED 1.00]
- **Sync-related Dashboards (6, 8, 9) all use SSE streaming and apiService for GitLab/Testmo sync flows** — dashboard6_component, dashboard8_component, dashboard9_component, api_service, runactionpanel_component [INFERRED 0.85]
- **All custom hooks (useDashboard, useTheme, usePreferences, useToast) follow identical context-consumer pattern** — usedashboard_hook, usetheme_hook, usepreferences_hook, usetoast_hook, dashboardcontext_context, themecontext_context, preferencescontext_context, toastcontext_context [EXTRACTED 1.00]
- **ModalGroup orchestrates TestClosureModal, QuickClosureModal, and ReportGeneratorModal as a unified closure workflow** — modalgroup_component, testclosuremodal_component, quickclosuremodal_component, reportgeneratormodal_component [EXTRACTED 1.00]
- **MetricsCards and TvDashboard both display ISTQB metrics (completionRate, passRate, failureRate, testEfficiency) with business/technical label toggling** — metricscards_component, tvdashboard_component, statuschart_component [INFERRED 0.85]
- **Sync Feature Cluster — cumulative filters + run manager (2026-04-30 plans)** — plan_sync_filtres, plan_run_manager, concept_sync_filters_cumulative, concept_folderName_decoupling, concept_run_manager, concept_run_action_panel, concept_dashboard9_run_manager_ui [INFERRED 0.85]
- **Audit Fix Cluster — critical bugs + service tests + route tests (2026-04-29)** — plan_critical_bugs, plan_h1_h2_h3_service_tests, plan_supertest_routes, improvements_doc, concept_critical_bugs_fixed [INFERRED 0.85]
- **Automated QA Routines Cluster — Claude Desktop remote routines for bidirectional sync** — routines_readme, routine_a_status_sync, routine_b_gitlab_to_testmo, concept_claude_remote_routines, concept_sync_bidirectional [EXTRACTED 0.95]
- **Project Documentation Cluster — guides, analysis, roadmap** — roadmap_doc, improvements_doc, rapport_analyse_doc, claude_md_doc, quick_start_doc [INFERRED 0.80]
- **GitLab Native Status Migration Cluster** — plan_gitlab_status_migration, concept_gitlab_status_native, concept_testmo_status_mapping, routine_a_status_sync [INFERRED 0.80]

## Communities (96 total, 13 thin omitted)

### Community 0 - "Frontend CrossTest UI"
Cohesion: 0.06
Nodes (14): CommentCell(), ErrorBoundary, QuickClosureModal(), TestClosureModal(), DashboardProvider(), PreferencesProvider(), ThemeProvider(), ToastProvider() (+6 more)

### Community 1 - "Testmo Service & ISTQB Metrics"
Cohesion: 0.14
Nodes (3): _calculatePercentage(), globalMetrics(), TestmoService

### Community 3 - "Project Docs & Concepts"
Cohesion: 0.11
Nodes (23): CLAUDE.md — Project guidance for Claude Code agents, Auto-sync cron (Mon-Fri 8h-18h, 5-min interval, Europe/Paris), Claude Desktop Remote Routines for automated QA sync (10h00, 13h30 workdays), Critical Bugs Fixed: NaN milestones (C1), XSS marked.parse (C2), N+1 notes (C3), GitLab Native Status (replaces Test::* labels, requires GitLab 17+), ISTQB Metrics (Completion Rate, Pass Rate, Failure Rate, Test Efficiency), SLA Thresholds ITIL (passRate target=95, completionRate target=90), Bidirectional Sync GitLab ↔ Testmo (+15 more)

### Community 4 - "API Service & Dashboard Views 6-9"
Cohesion: 0.13
Nodes (16): cache.routes, ConfigurationScreen, Dashboard6, Dashboard7, Dashboard8, Dashboard9, dashboard.routes, health.routes (+8 more)

### Community 5 - "App Root & Dashboard Views 3-5"
Cohesion: 0.2
Nodes (3): ISTQB Metrics (Completion, Pass, Failure, Escape, Detection), localStorage persistence for user preferences, SLA Thresholds (ITIL/ISTQB)

### Community 6 - "Dashboard Controller & Metrics"
Cohesion: 0.2
Nodes (9): getAnnualTrends(), getMetrics(), getQualityRates(), parseMilestones(), aggregateSessions(), _calculatePercentage(), getIstqbMetricsService(), globalMetrics() (+1 more)

### Community 8 - "DOCX/PDF Report Generator"
Cohesion: 0.27
Nodes (13): bold(), bullet(), criteriaMet(), emptyLine(), generateQuickClosureDoc(), h1(), h2(), italic() (+5 more)

### Community 9 - "MetricsCards & UI Tests"
Cohesion: 0.17
Nodes (5): Dashboard4(), MetricsCards(), getAlertForMetric(), getColorByThreshold(), getColorForFailure()

### Community 10 - "GitLab Service Tests"
Cohesion: 0.18
Nodes (14): critical-bugs.test, gitlab.graphql.test, gitlab.service, gitlab.service.filters.test, gitlab.service.test, SQLite DB: sync-history.db, SSE streaming pattern (executeSync / statusToGitlab), status-sync.service (+6 more)

### Community 13 - "Integration & E2E Tests"
Cohesion: 0.21
Nodes (13): calculations.test (ISTQB), health.spec.js (Playwright E2E), projects.routes.test, report.calculations.test, run-manager.service, run-manager.service.test, runs.routes, runs.routes.test (+5 more)

### Community 14 - "Routes Tests & CSRF"
Cohesion: 0.26
Nodes (12): crosstest.routes.test, CSRF X-Requested-With protection pattern, featureFlags.routes, featureflags-cache.routes.test, health.routes.test, reports.routes.test, resilience.test, run-manager.routes.test (+4 more)

### Community 15 - "Unit Tests (Calculations)"
Cohesion: 0.22
Nodes (3): _calculatePercentage(), globalMetrics(), sessionPassRate()

### Community 16 - "Auto-Sync Config & SQLite"
Cohesion: 0.22
Nodes (9): auto-sync-config.json (runtime persistence), auto-sync-config.service, comments.service, crosstest.routes, dashboard.spec.js (Playwright E2E), logger.service, run-sync.js (standalone script), sentry.service (+1 more)

### Community 17 - "UI Helpers & Theme"
Cohesion: 0.25
Nodes (9): colorHelpers, MetricsCards, MetricsCards.test, StatusChart, ThemeContext, ThemeContext, TvDashboard, useTheme (+1 more)

### Community 18 - "GraphQL Tests"
Cohesion: 0.32
Nodes (4): buildStatusMap(), buildVersionProdMap(), filterIssuesByStatus(), filterIssuesByVersionProd()

### Community 19 - "Run Manager Service"
Cohesion: 0.43
Nodes (7): computeMergePreview(), createRunFromCases(), getFolderCases(), getProjectRunsList(), isResultPristine(), mergeRunCases(), resolveProject()

### Community 20 - "Module 20"
Cohesion: 0.43
Nodes (4): formatDate(), getCompletionColor(), getStatusColor(), RunCard()

### Community 22 - "Module 22"
Cohesion: 0.43
Nodes (5): _defaultConfig(), getConfig(), load(), save(), updateConfig()

### Community 24 - "Module 24"
Cohesion: 0.38
Nodes (7): Dashboard9 — autonomous run manager UI (Option B), folderName decoupled from iterationName in sync (architectural decision), RunActionPanel — shared stateful React component for create/merge runs, Run Manager — isResultPristine preservation rule for test run merges, Cumulative AND filters for sync: iterationName, statusGid, versionProd, versionTest, Plan: Run Manager — create/merge Testmo runs post-sync, Plan: Filtres Cumulables Dashboard6 (4 optional AND filters)

### Community 28 - "Module 28"
Cohesion: 0.33
Nodes (6): dashboard.controller, dashboard.routes.test, integrity.guards.test, _calculatePercentage / aggregateSessions / globalMetrics (standalone), istqb-metrics.service, SLA_THRESHOLDS (passRate/completionRate/blockedRate)

### Community 31 - "Module 31"
Cohesion: 0.5
Nodes (5): generate_R06_pptx.js (standalone script), pptxgenjs (PPTX generation library), report.service, reports.controller, reports.routes

### Community 35 - "Module 35"
Cohesion: 0.5
Nodes (4): ModalGroup, QuickClosureModal, ReportGeneratorModal, TestClosureModal

### Community 40 - "Module 40"
Cohesion: 1.0
Nodes (3): DashboardContext, useDashboard, useDashboard.test

### Community 41 - "Module 41"
Cohesion: 1.0
Nodes (3): PreferencesContext, usePreferences, usePreferences.test

## Knowledge Gaps
- **38 isolated node(s):** `test/setup.js`, `ErrorBoundary`, `Toast`, `TvDashboard`, `StatusChart` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useToast()` connect `Frontend CrossTest UI` to `MetricsCards & UI Tests`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `Backend Express Server` connect `Routes Tests & CSRF` to `API Service & Dashboard Views 6-9`, `GitLab Service Tests`, `Integration & E2E Tests`, `Auto-Sync Config & SQLite`, `Module 28`, `Module 31`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `testmo.service` connect `Integration & E2E Tests` to `API Service & Dashboard Views 6-9`, `Routes Tests & CSRF`, `Auto-Sync Config & SQLite`, `Module 28`, `Module 31`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Backend Express Server` (e.g. with `projects.config.js` and `tests/helpers/setup`) actually correct?**
  _`Backend Express Server` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `testmo.service` (e.g. with `health.spec.js (Playwright E2E)` and `sentry.service`) actually correct?**
  _`testmo.service` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `test/setup.js`, `ErrorBoundary`, `Toast` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend CrossTest UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._