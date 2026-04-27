import React, { useState, lazy, Suspense } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useDashboard } from './hooks/useDashboard';
import { usePreferences } from './hooks/usePreferences';
import apiService from './services/api.service';
import MetricsCards from './components/MetricsCards';
import StatusChart from './components/StatusChart';
import RunsList from './components/RunsList';

const TvDashboard = lazy(() => import('./components/TvDashboard'));
const Dashboard3 = lazy(() => import('./components/Dashboard3'));
const Dashboard4 = lazy(() => import('./components/Dashboard4'));
const Dashboard5 = lazy(() => import('./components/Dashboard5'));
const Dashboard6 = lazy(() => import('./components/Dashboard6'));
const Dashboard7 = lazy(() => import('./components/Dashboard7'));
const Dashboard8 = lazy(() => import('./components/Dashboard8'));
const ConfigurationScreen = lazy(() => import('./components/ConfigurationScreen'));
import {
  RefreshCw,
  AlertCircle,
  Activity,
  Settings,
  Database,
  CheckCircle2,
  Monitor,
  Download
} from 'lucide-react';
import './styles/App.css';

// Maps select option value → URL path
const VIEW_TO_ROUTE = {
  '1': '/dashboard',
  '2': '/tv',
  '3': '/quality',
  '4': '/global',
  '5': '/trends',
  '6': '/config',
  '7': '/sync/gitlab',
  '8': '/crosstest',
  '9': '/autosync',
};

// Maps URL path → select option value (for controlled select)
const ROUTE_TO_VIEW = Object.fromEntries(
  Object.entries(VIEW_TO_ROUTE).map(([v, r]) => [r, v])
);

function App() {
  const { isDark: darkMode, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const {
    projectId, setProjectId,
    metrics, loading, error, lastUpdate,
    projects, backendStatus,
    autoRefresh, setAutoRefresh,
    selectedPreprodMilestones, setSelectedPreprodMilestones,
    selectedProdMilestones, setSelectedProdMilestones,
    loadDashboardMetrics,
  } = useDashboard();
  const { prefs, updatePref } = usePreferences();
  const { tvMode, useBusinessTerms, showProductionSection } = prefs;

  const navigate = useNavigate();
  const { pathname } = useLocation();
  const dashboardView = ROUTE_TO_VIEW[pathname] || '1';

  const [exportHandler, setExportHandler] = useState(null);

  const handleClearCache = async () => {
    try {
      await apiService.clearCache();
      await loadDashboardMetrics();
      addToast({ message: 'Cache nettoyé avec succès', type: 'success' });
    } catch (err) {
      addToast({ message: `Erreur: ${err.message}`, type: 'error' });
    }
  };

  const renderBackendStatus = () => {
    const statusConfig = {
      checking: { icon: Activity, color: '#F59E0B', text: 'Connexion...' },
      ok: { icon: CheckCircle2, color: '#10B981', text: 'Backend OK' },
      error: { icon: AlertCircle, color: '#EF4444', text: 'Backend Error' }
    };
    const config = statusConfig[backendStatus];
    const Icon = config.icon;
    return (
      <div className="backend-status" style={{ color: config.color }}>
        <Icon size={16} />
        <span>{config.text}</span>
      </div>
    );
  };

  if (error && !metrics) {
    return (
      <div className="app-error">
        <AlertCircle size={48} color="#EF4444" />
        <h2>Erreur de Chargement</h2>
        <p>{error}</p>
        <button onClick={loadDashboardMetrics} className="btn-retry">
          <RefreshCw size={16} />
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className={`app ${tvMode ? 'tv-mode' : ''} ${darkMode ? 'dark-theme' : ''} view-dash${dashboardView}`}>
      <header className="app-header">
        <div className="header-left">
          <Database size={32} color="#3B82F6" />
          <div className="header-title">
            <h1>Testmo Dashboard</h1>
            <p className="header-subtitle">
              ISTQB Compliant | LEAN Optimized | ITIL SLA Monitoring
            </p>
          </div>
        </div>

        <div className="header-right">
          {projects.length > 0 && (
            <select
              value={projectId}
              onChange={(e) => setProjectId(parseInt(e.target.value))}
              className="project-selector"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}

          <button
            className={`btn-toggle ${tvMode ? 'active' : ''}`}
            onClick={() => updatePref('tvMode', !tvMode)}
            title="Mode TV"
          >
            <Monitor size={16} />
            {tvMode ? 'Mode TV' : 'Mode Standard'}
          </button>

          <div className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', marginRight: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>Dark thème</span>
            <label className="theme-switch">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={toggleTheme}
              />
              <span className="slider round"></span>
            </label>
          </div>

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
            </select>
          </div>

          {pathname === '/global' && exportHandler && (
            <button
              className="btn-icon"
              style={{ backgroundColor: '#3B82F6', color: 'white', marginRight: '8px', border: 'none' }}
              onClick={() => exportHandler()}
              title="Exporter en PDF"
            >
              <Download size={16} />
            </button>
          )}

          <div className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', marginRight: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>Vocabulaire Métier</span>
            <label className="theme-switch">
              <input
                type="checkbox"
                checked={useBusinessTerms}
                onChange={() => updatePref('useBusinessTerms', !useBusinessTerms)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          <button
            className={`btn-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh 5m"
          >
            <RefreshCw size={16} className={autoRefresh ? 'spinning' : ''} />
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>

          <button
            className="btn-icon"
            onClick={loadDashboardMetrics}
            disabled={loading}
            title="Actualiser"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>

          <button
            className="btn-icon"
            onClick={handleClearCache}
            title="Nettoyer le cache"
          >
            <Settings size={16} />
          </button>

          {renderBackendStatus()}
        </div>
      </header>

      <main className="app-main">
        {loading && !metrics ? (
          <div className="loading-container">
            <RefreshCw size={48} className="spinner" />
            <p>Chargement des métriques ISTQB...</p>
          </div>
        ) : (
          <ErrorBoundary>
          <Suspense fallback={<div className="loading-container"><RefreshCw size={48} className="spinner" /><p>Chargement...</p></div>}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={
              <>
                <section className="section">
                  <MetricsCards metrics={metrics} useBusiness={useBusinessTerms} />
                </section>
                <section className="section charts-section">
                  <div className="chart-container">
                    <StatusChart metrics={metrics} chartType="doughnut" useBusiness={useBusinessTerms} isDark={darkMode} />
                  </div>
                  <div className="chart-container">
                    <StatusChart metrics={metrics} chartType="bar" useBusiness={useBusinessTerms} isDark={darkMode} />
                  </div>
                </section>
                <section className="section">
                  <RunsList metrics={metrics} useBusiness={useBusinessTerms} />
                </section>
              </>
            } />

            <Route path="/tv" element={
              <TvDashboard
                metrics={metrics}
                project={projects.find(p => p.id === projectId)}
                isDark={darkMode}
                useBusiness={useBusinessTerms}
              />
            } />

            <Route path="/quality" element={
              <Dashboard3
                metrics={metrics}
                project={projects.find(p => p.id === projectId)}
                isDark={darkMode}
                useBusiness={useBusinessTerms}
              />
            } />

            <Route path="/global" element={
              <Dashboard4
                metrics={metrics}
                project={projects.find(p => p.id === projectId)}
                projects={projects}
                projectId={projectId}
                onProjectChange={(id) => setProjectId(id)}
                isDark={darkMode}
                useBusiness={useBusinessTerms}
                setExportHandler={setExportHandler}
                showProductionSection={showProductionSection}
                onToggleProductionSection={(val) => updatePref('showProductionSection', val)}
              />
            } />

            <Route path="/trends" element={
              <Dashboard5
                projectId={projectId}
                isDark={darkMode}
                useBusiness={useBusinessTerms}
              />
            } />

            <Route path="/sync/gitlab" element={
              <Dashboard6 isDark={darkMode} />
            } />

            <Route path="/config" element={
              <ConfigurationScreen
                projectId={projectId}
                isDark={darkMode}
                initialPreprodMilestones={selectedPreprodMilestones}
                initialProdMilestones={selectedProdMilestones}
                onSaveSelection={(preprodMilestones, prodMilestones) => {
                  setSelectedPreprodMilestones(preprodMilestones || []);
                  setSelectedProdMilestones(prodMilestones || []);
                  navigate('/dashboard');
                }}
              />
            } />

            <Route path="/crosstest" element={
              <Dashboard7 isDark={darkMode} />
            } />

            <Route path="/autosync" element={
              <Dashboard8 isDark={darkMode} />
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        )}
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <span>© 2026 Neo-Logix | QA Dashboard by Matou</span>
          {lastUpdate && (
            <span className="last-update">
              Dernière mise à jour: {lastUpdate.toLocaleTimeString('fr-FR')}
            </span>
          )}
          <span>Standards: ISTQB | LEAN | ITIL</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
