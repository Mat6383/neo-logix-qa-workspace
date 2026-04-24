import React, { useState } from 'react';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { useDashboard } from './hooks/useDashboard';
import { usePreferences } from './hooks/usePreferences';
import apiService from './services/api.service';
import MetricsCards from './components/MetricsCards';
import StatusChart from './components/StatusChart';
import RunsList from './components/RunsList';
import TvDashboard from './components/TvDashboard';
import Dashboard3 from './components/Dashboard3';
import Dashboard4 from './components/Dashboard4';
import Dashboard5 from './components/Dashboard5';
import Dashboard6 from './components/Dashboard6';
import Dashboard7 from './components/Dashboard7';
import Dashboard8 from './components/Dashboard8';
import ConfigurationScreen from './components/ConfigurationScreen';
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
  const { tvMode, dashboardView, useBusinessTerms, showProductionSection } = prefs;

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
              onChange={(e) => updatePref('dashboardView', e.target.value)}
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

          {dashboardView === '4' && exportHandler && (
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
        ) : dashboardView === '2' ? (
          <TvDashboard
            metrics={metrics}
            project={projects.find(p => p.id === projectId)}
            isDark={darkMode}
            useBusiness={useBusinessTerms}
          />
        ) : dashboardView === '3' ? (
          <Dashboard3
            metrics={metrics}
            project={projects.find(p => p.id === projectId)}
            isDark={darkMode}
            useBusiness={useBusinessTerms}
          />
        ) : dashboardView === '4' ? (
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
        ) : dashboardView === '5' ? (
          <Dashboard5
            projectId={projectId}
            isDark={darkMode}
            useBusiness={useBusinessTerms}
          />
        ) : dashboardView === '7' ? (
          <Dashboard6
            isDark={darkMode}
          />
        ) : dashboardView === '8' ? (
          <Dashboard7
            isDark={darkMode}
          />
        ) : dashboardView === '9' ? (
          <Dashboard8
            isDark={darkMode}
          />
        ) : dashboardView === '6' ? (
          <ConfigurationScreen
            projectId={projectId}
            isDark={darkMode}
            initialPreprodMilestones={selectedPreprodMilestones}
            initialProdMilestones={selectedProdMilestones}
            onSaveSelection={(preprodMilestones, prodMilestones) => {
              setSelectedPreprodMilestones(preprodMilestones || []);
              setSelectedProdMilestones(prodMilestones || []);
              updatePref('dashboardView', '1');
            }}
          />
        ) : (
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
