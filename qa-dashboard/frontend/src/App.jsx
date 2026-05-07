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
import TabBar from './components/TabBar';

const TvDashboard = lazy(() => import('./components/TvDashboard'));
const Dashboard3 = lazy(() => import('./components/Dashboard3'));
const DashboardPrincipal = lazy(() => import('./components/DashboardPrincipal'));
const Dashboard5 = lazy(() => import('./components/Dashboard5'));
const Dashboard6 = lazy(() => import('./components/Dashboard6'));
const Dashboard7 = lazy(() => import('./components/Dashboard7'));
const Dashboard8 = lazy(() => import('./components/Dashboard8'));
const Dashboard9 = lazy(() => import('./components/Dashboard9'));
const Dashboard10 = lazy(() => import('./components/Dashboard10'));
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

// Maps tab id → URL path
const TAB_ROUTES = {
  principal:     '/principal',
  dashboard:     '/dashboard',
  tv:            '/tv',
  quality:       '/quality',
  trends:        '/trends',
  crosstest:     '/crosstest',
  compare:       '/compare',
  config:        '/config',
  'sync-gitlab': '/sync/gitlab',
  autosync:      '/autosync',
  'runs-manage': '/runs/manage',
};

const ROUTE_TO_TAB = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab])
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
  const activeTab = ROUTE_TO_TAB[pathname] || 'principal';

  const [exportHandler, setExportHandler] = useState(null);
  const [csvExportHandler, setCsvExportHandler] = useState(null);

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
    <div className={`app ${tvMode ? 'tv-mode' : ''} ${darkMode ? 'dark-theme' : ''}`}>
      <header className="app-header">
        <div className="header-row-1">
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

            {pathname === '/principal' && csvExportHandler && (
              <button
                className="btn-icon"
                style={{ backgroundColor: '#10B981', color: 'white', marginRight: '4px', border: 'none' }}
                onClick={() => csvExportHandler()}
                title="Exporter en CSV"
              >
                <Download size={16} />
                <span style={{ fontSize: '0.7rem', marginLeft: '2px' }}>CSV</span>
              </button>
            )}

            {pathname === '/principal' && exportHandler && (
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
        </div>

        <TabBar
          activeTab={activeTab}
          onTabChange={(tabId) => navigate(TAB_ROUTES[tabId])}
        />
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
            <Route path="/" element={<Navigate to="/principal" replace />} />

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

            <Route path="/global" element={<Navigate to="/principal" replace />} />

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
                  navigate('/principal');
                }}
              />
            } />

            <Route path="/crosstest" element={
              <Dashboard7 isDark={darkMode} />
            } />

            <Route path="/autosync" element={
              <Dashboard8 isDark={darkMode} />
            } />

            <Route path="/runs/manage" element={
              <Dashboard9 isDark={darkMode} />
            } />

            <Route path="/compare" element={
              <Dashboard10 projectId={projectId} isDark={darkMode} />
            } />

            <Route path="*" element={<Navigate to="/principal" replace />} />
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
