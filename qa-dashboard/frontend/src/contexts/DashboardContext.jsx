import { createContext, useState, useCallback, useEffect, useRef } from 'react';
import apiService from '../services/api.service';

export const DashboardContext = createContext(null);

const REFRESH_COOLDOWN = 5000;

export function DashboardProvider({ children }) {
  const [projectId, setProjectId] = useState(() => parseInt(localStorage.getItem('testmo_projectId')) || 1);
  const [metrics, setMetrics] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [backendStatus, setBackendStatus] = useState('checking');
  const [selectedPreprodMilestones, setSelectedPreprodMilestones] = useState(() => {
    const saved = localStorage.getItem('testmo_selectedPreprodMilestones');
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedProdMilestones, setSelectedProdMilestones] = useState(() => {
    const saved = localStorage.getItem('testmo_selectedProdMilestones');
    return saved ? JSON.parse(saved) : [];
  });

  const abortControllerRef = useRef(null);
  const lastRefreshRef = useRef(Date.now());
  const isLoadingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('testmo_projectId', projectId);
    localStorage.setItem('testmo_selectedPreprodMilestones', JSON.stringify(selectedPreprodMilestones));
    localStorage.setItem('testmo_selectedProdMilestones', JSON.stringify(selectedProdMilestones));
  }, [projectId, selectedPreprodMilestones, selectedProdMilestones]);

  const checkBackendHealth = useCallback(async () => {
    try {
      await apiService.healthCheck();
      setBackendStatus('ok');
    } catch (err) {
      setBackendStatus('error');
      console.error('Backend health check failed:', err);
    }
  }, []);

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

  const loadDashboardMetrics = useCallback(async (force = false) => {
    if (isLoadingRef.current && !force) {
      console.log('[loadDashboardMetrics] Chargement déjà en cours, ignoré');
      return;
    }

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

  // Initial load
  useEffect(() => {
    checkBackendHealth();
    loadProjects();
    loadDashboardMetrics(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on project/milestones change
  useEffect(() => {
    loadDashboardMetrics(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedPreprodMilestones, selectedProdMilestones]);

  // Auto-refresh interval (1 min)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      console.log('[Auto-refresh] Rechargement des métriques (1m)...');
      loadDashboardMetrics();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadDashboardMetrics]);

  // Visibility/focus refresh
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

  return (
    <DashboardContext.Provider value={{
      projectId, setProjectId,
      metrics, loading, error, lastUpdate,
      projects, backendStatus,
      autoRefresh, setAutoRefresh,
      selectedPreprodMilestones, setSelectedPreprodMilestones,
      selectedProdMilestones, setSelectedProdMilestones,
      loadDashboardMetrics, loadProjects, checkBackendHealth,
    }}>
      {children}
    </DashboardContext.Provider>
  );
}
