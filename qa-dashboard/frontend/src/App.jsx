/**
 * ================================================
 * TESTMO DASHBOARD - Main Application
 * ================================================
 * Dashboard principal de monitoring des tests
 * 
 * Standards:
 * - ISTQB: Test Monitoring & Control
 * - LEAN: Auto-refresh 5m
 * - ITIL: Service Level Management
 * 
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from './hooks/useTheme';
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

const REFRESH_COOLDOWN = 5000; // 5s minimum entre deux rechargements

function App() {
  // État de l'application (avec persistance localStorage)
  const [projectId, setProjectId] = useState(() => parseInt(localStorage.getItem('testmo_projectId')) || 1);
  const [metrics, setMetrics] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [tvMode, setTvMode] = useState(() => localStorage.getItem('testmo_tvMode') !== 'false');
  const { isDark: darkMode, toggleTheme } = useTheme();
  const [dashboardView, setDashboardView] = useState(() => localStorage.getItem('testmo_dashboardView') || '1');
  const [useBusinessTerms, setUseBusinessTerms] = useState(() => localStorage.getItem('testmo_useBusinessTerms') !== 'false');
  const [backendStatus, setBackendStatus] = useState('checking');
  const [exportHandler, setExportHandler] = useState(null);

  // Configuration personnalisée des jalons (milestones) avec persistance
  const [selectedPreprodMilestones, setSelectedPreprodMilestones] = useState(() => {
    const saved = localStorage.getItem('testmo_selectedPreprodMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedProdMilestones, setSelectedProdMilestones] = useState(() => {
    const saved = localStorage.getItem('testmo_selectedProdMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [showProductionSection, setShowProductionSection] = useState(() => {
    const saved = localStorage.getItem('testmo_showProductionSection');
    return saved !== null ? saved === 'true' : true;
  });

  // Refs pour éviter les race conditions
  const abortControllerRef = useRef(null);
  const lastRefreshRef = useRef(Date.now()); // Initialisé à now pour bloquer les refreshs pendant le chargement initial
  const isLoadingRef = useRef(false);
  // Effet: Sauvegarde des préférences dans le localStorage
  useEffect(() => {
    localStorage.setItem('testmo_projectId', projectId);
    localStorage.setItem('testmo_selectedPreprodMilestones', JSON.stringify(selectedPreprodMilestones));
    localStorage.setItem('testmo_selectedProdMilestones', JSON.stringify(selectedProdMilestones));
    localStorage.setItem('testmo_dashboardView', dashboardView);
    localStorage.setItem('testmo_tvMode', tvMode);
    localStorage.setItem('testmo_useBusinessTerms', useBusinessTerms);
    localStorage.setItem('testmo_showProductionSection', showProductionSection);
  }, [projectId, selectedPreprodMilestones, selectedProdMilestones, dashboardView, tvMode, useBusinessTerms, showProductionSection]);

  /**
   * Vérifie la santé du backend
   */
  const checkBackendHealth = useCallback(async () => {
    try {
      await apiService.healthCheck();
      setBackendStatus('ok');
    } catch (err) {
      setBackendStatus('error');
      console.error('Backend health check failed:', err);
    }
  }, []);

  /**
   * Charge la liste des projets
   */
  const loadProjects = useCallback(async () => {
    try {
      const response = await apiService.getProjects();
      if (response.success && response.data.result) {
        setProjects(response.data.result);
      }
    } catch (err) {
      console.error('Erreur chargement projets:', err);
    }
  }, []);

  /**
   * Charge les métriques du dashboard
   * ISTQB: Test Monitoring
   * Protection contre les race conditions via AbortController + cooldown
   */
  const loadDashboardMetrics = useCallback(async (force = false) => {
    // Éviter les appels concurrents sauf si forcé (ex: changement de projet)
    if (isLoadingRef.current && !force) {
      console.log('[loadDashboardMetrics] Chargement déjà en cours, ignoré');
      return;
    }

    // Annuler la requête précédente si elle est encore en cours
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isLoadingRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const [metricsResponse, qualityResponse] = await Promise.all([
        apiService.getDashboardMetrics(
          projectId,
          selectedPreprodMilestones.length > 0 ? selectedPreprodMilestones : null,
          selectedProdMilestones.length > 0 ? selectedProdMilestones : null,
          controller.signal
        ),
        apiService.getQualityRates(
          projectId,
          selectedPreprodMilestones.length > 0 ? selectedPreprodMilestones : null,
          selectedProdMilestones.length > 0 ? selectedProdMilestones : null,
          controller.signal
        )
      ]);

      // Ignorer si cette requête a été annulée entre-temps
      if (controller.signal.aborted) return;

      if (metricsResponse.success) {
        setMetrics({
          ...metricsResponse.data,
          qualityRates: qualityResponse.success ? qualityResponse.data : null
        });
        setLastUpdate(new Date());
        lastRefreshRef.current = Date.now();
      } else {
        throw new Error(metricsResponse.error || 'Erreur inconnue');
      }

    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError' || controller.signal.aborted) return;
      setError(err.message);
      console.error('Erreur chargement métriques:', err);
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
      isLoadingRef.current = false;
    }
  }, [projectId, selectedPreprodMilestones, selectedProdMilestones]);

  /**
   * Nettoie le cache backend
   * LEAN: Gestion optimisée
   */
  const handleClearCache = async () => {
    try {
      await apiService.clearCache();
      await loadDashboardMetrics();
      alert('Cache nettoyé avec succès');
    } catch (err) {
      alert(`Erreur: ${err.message}`);
    }
  };

  /**
   * Changement de projet
   */
  const handleProjectChange = (event) => {
    const newProjectId = parseInt(event.target.value);
    setProjectId(newProjectId);
  };

  // Effet initial: vérifier backend et charger données (une seule fois au mount)
  useEffect(() => {
    checkBackendHealth();
    loadProjects();
    loadDashboardMetrics(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recharger quand le projet ou les milestones changent
  useEffect(() => {
    loadDashboardMetrics(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedPreprodMilestones, selectedProdMilestones]);

  // Effet: Auto-refresh toutes les minutes (LEAN)
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      console.log('[Auto-refresh] Rechargement des métriques (1m)...');
      loadDashboardMetrics();
    }, 60000); // 1 minute

    return () => clearInterval(interval);
  }, [autoRefresh, loadDashboardMetrics]);

  // Effet: Rafraichissement forcé au retour sur la page (ex: plein écran F11 après veille)
  // Throttlé pour éviter les avalanches de requêtes (focus + visibilitychange + resize se déclenchent souvent ensemble)
  useEffect(() => {
    if (!autoRefresh) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (isLoadingRef.current) return;
        const now = Date.now();
        if (now - lastRefreshRef.current < REFRESH_COOLDOWN) return;
        console.log('[Auto-refresh] Retour focus/visibilité - Rechargement des métriques');
        lastRefreshRef.current = now;
        loadDashboardMetrics();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('resize', handleVisibilityChange);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('resize', handleVisibilityChange);
    };
  }, [autoRefresh, loadDashboardMetrics]);

  /**
   * Rendu du statut du backend
   */
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

  /**
   * Rendu de l'erreur
   */
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
      {/* Header */}
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
          {/* Sélecteur de projet */}
          {projects.length > 0 && (
            <select
              value={projectId}
              onChange={handleProjectChange}
              className="project-selector"
            >
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          )}

          {/* Toggle TV Mode */}
          <button
            className={`btn-toggle ${tvMode ? 'active' : ''}`}
            onClick={() => setTvMode(!tvMode)}
            title="Mode TV"
          >
            <Monitor size={16} />
            {tvMode ? 'Mode TV' : 'Mode Standard'}
          </button>

          {/* Toggle Dark Theme Switch */}
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

          {/* Sélecteur de Dashboard */}
          <div style={{ marginLeft: '8px', marginRight: '8px' }}>
            <select
              value={dashboardView}
              onChange={(e) => setDashboardView(e.target.value)}
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

          {/* Export PDF Dashboard 4 */}
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

          {/* Toggle Vocabulaire Métier Switch */}
          <div className="switch-container" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px', marginRight: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>Vocabulaire Métier</span>
            <label className="theme-switch">
              <input
                type="checkbox"
                checked={useBusinessTerms}
                onChange={() => setUseBusinessTerms(!useBusinessTerms)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* Toggle auto-refresh */}
          <button
            className={`btn-toggle ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto-refresh 5m"
          >
            <RefreshCw size={16} className={autoRefresh ? 'spinning' : ''} />
            {autoRefresh ? 'Auto ON' : 'Auto OFF'}
          </button>

          {/* Refresh manuel */}
          <button
            className="btn-icon"
            onClick={loadDashboardMetrics}
            disabled={loading}
            title="Actualiser"
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
          </button>

          {/* Clear cache */}
          <button
            className="btn-icon"
            onClick={handleClearCache}
            title="Nettoyer le cache"
          >
            <Settings size={16} />
          </button>

          {/* Statut backend */}
          {renderBackendStatus()}
        </div>
      </header>

      {/* Main Content */}
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
            onToggleProductionSection={setShowProductionSection}
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
              // Retourner au dashboard global par défaut après validation
              setDashboardView('1');
            }}
          />
        ) : (
          <>
            {/* Métriques ISTQB */}
            <section className="section">
              <MetricsCards metrics={metrics} useBusiness={useBusinessTerms} />
            </section>

            {/* Graphiques */}
            <section className="section charts-section">
              <div className="chart-container">
                <StatusChart metrics={metrics} chartType="doughnut" useBusiness={useBusinessTerms} isDark={darkMode} />
              </div>
              <div className="chart-container">
                <StatusChart metrics={metrics} chartType="bar" useBusiness={useBusinessTerms} isDark={darkMode} />
              </div>
            </section>

            {/* Liste des runs */}
            <section className="section">
              <RunsList metrics={metrics} useBusiness={useBusinessTerms} />
            </section>
          </>
        )}
      </main>

      {/* Footer */}
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
