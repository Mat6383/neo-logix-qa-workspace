/**
 * ================================================
 * DASHBOARD 6 - Synchronisation GitLab → Testmo
 * ================================================
 * State container. UI is split across:
 *   D6SyncPreview  — aperçu des tickets avant sync
 *   D6SyncLog      — progression SSE + stats finales
 *   D6SyncHistory  — historique des runs
 *
 * Flow: idle → analyzing → preview → syncing → done
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  RefreshCw,
  Search,
  AlertCircle,
} from 'lucide-react';
import apiService from '../services/api.service';
import D6SyncPreview from './D6SyncPreview';
import D6SyncLog from './D6SyncLog';
import D6SyncHistory from './D6SyncHistory';
import '../styles/Dashboard6.css';

export default function Dashboard6({ isDark }) {
  const [state, setState] = useState('idle');
  const [projects, setProjects]         = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [iterations, setIterations]     = useState([]);
  const [iterSearch, setIterSearch]     = useState('');
  const [selectedIter, setSelectedIter] = useState('');
  const [loadingIters, setLoadingIters] = useState(false);
  const [preview, setPreview]           = useState(null);
  const [logLines, setLogLines]         = useState([]);
  const [finalStats, setFinalStats]     = useState(null);
  const [history, setHistory]           = useState([]);
  const [error, setError]               = useState(null);

  const [folderName, setFolderName]                   = useState('');
  const [statuses, setStatuses]                       = useState([]);
  const [selectedStatus, setSelectedStatus]           = useState('');
  const [versionsProd, setVersionsProd]               = useState([]);
  const [selectedVersionProd, setSelectedVersionProd] = useState('');
  const [versionsTest, setVersionsTest]               = useState([]);
  const [selectedVersionTest, setSelectedVersionTest] = useState('');
  const [loadingFilters, setLoadingFilters]           = useState(false);

  const logEndRef    = useRef(null);
  const iterTimerRef = useRef(null);

  useEffect(() => {
    loadProjects();
    loadHistory();
  }, []);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [logLines]);

  const loadProjects = async () => {
    try {
      const list = await apiService.getSyncProjects();
      setProjects(list);
      const first = list.find(p => p.configured);
      if (first) setSelectedProject(first.id);
    } catch (err) {
      setError('Impossible de charger les projets: ' + err.message);
    }
  };

  const loadHistory = async () => {
    try {
      const rows = await apiService.getSyncHistory();
      setHistory(rows || []);
    } catch (_) {}
  };

  const loadFilters = useCallback(async (projectId) => {
    if (!projectId) return;
    setLoadingFilters(true);
    try {
      const [statusList, prodList, testList] = await Promise.all([
        apiService.getSyncStatuses(projectId),
        apiService.getSyncFieldValues(projectId, 'Version Prod'),
        apiService.getSyncFieldValues(projectId, 'Version de test'),
      ]);
      setStatuses(statusList || []);
      setVersionsProd(prodList || []);
      setVersionsTest(testList || []);
    } catch (err) {
      console.warn('Impossible de charger les filtres:', err.message);
    } finally {
      setLoadingFilters(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProject) loadFilters(selectedProject);
  }, [selectedProject, loadFilters]);

  const loadIterations = useCallback(async (projectId, search) => {
    if (!projectId) return;
    const project = projects.find(p => p.id === projectId);
    if (!project?.configured) return;

    setLoadingIters(true);
    setIterations([]);
    setSelectedIter('');
    try {
      const list = await apiService.getSyncIterations(projectId, search);
      setIterations(list || []);
    } catch (err) {
      setError('Impossible de charger les itérations: ' + err.message);
    } finally {
      setLoadingIters(false);
    }
  }, [projects]);

  useEffect(() => {
    if (selectedProject) loadIterations(selectedProject, iterSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const handleIterSearchChange = (e) => {
    const val = e.target.value;
    setIterSearch(val);
    if (iterTimerRef.current) clearTimeout(iterTimerRef.current);
    iterTimerRef.current = setTimeout(() => loadIterations(selectedProject, val), 400);
  };

  const handleAnalyze = async () => {
    if (!selectedProject || !folderName.trim()) return;
    setError(null);
    setPreview(null);
    setState('analyzing');

    try {
      const filters = {};
      if (selectedIter)        filters.iterationName = selectedIter;
      if (selectedStatus)      filters.statusGid     = selectedStatus;
      if (selectedVersionProd) filters.versionProd   = selectedVersionProd;
      if (selectedVersionTest) filters.versionTest   = selectedVersionTest;

      const data = await apiService.previewSync(selectedProject, folderName, filters);
      setPreview(data);
      setState('preview');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  const handleExecute = () => {
    if (!selectedProject || !selectedIter) return;
    setError(null);
    setLogLines([]);
    setFinalStats(null);
    setState('syncing');

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    const ctrl = new AbortController();

    fetch(`${API_BASE}/sync/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId: selectedProject,
        folderName,
        ...(selectedIter        && { iterationName:  selectedIter }),
        ...(selectedStatus      && { statusGid:       selectedStatus }),
        ...(selectedVersionProd && { versionProd:     selectedVersionProd }),
        ...(selectedVersionTest && { versionTest:     selectedVersionTest }),
      }),
      signal: ctrl.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const json = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            setLogLines(prev => {
              const next = [...prev, event];
              return next.length > 500 ? next.slice(-500) : next;
            });

            if (event.type === 'done') {
              setFinalStats({
                created:  event.created  || 0,
                updated:  event.updated  || 0,
                skipped:  event.skipped  || 0,
                enriched: event.enriched || 0,
                errors:   event.errors   || 0,
                total:    event.total    || 0,
              });
              setState('done');
              loadHistory();
            }

            if (event.type === 'error') {
              setError(event.message || 'Erreur inconnue');
              setState('preview');
            }
          } catch (_) {}
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) { if (buffer) processChunk(''); break; }
        processChunk(decoder.decode(value, { stream: true }));
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        setError('Erreur connexion SSE: ' + err.message);
        setState('preview');
      }
    });
  };

  const handleReset = () => {
    setState('idle');
    setPreview(null);
    setLogLines([]);
    setFinalStats(null);
    setError(null);
    setSelectedStatus('');
    setSelectedVersionProd('');
    setSelectedVersionTest('');
    setFolderName('');
  };

  const currentProject = projects.find(p => p.id === selectedProject);
  const isConfigured   = currentProject?.configured === true;
  const hasAtLeastOneFilter = selectedIter || selectedStatus || selectedVersionProd || selectedVersionTest;
  const canAnalyze = isConfigured && hasAtLeastOneFilter && folderName.trim() && state === 'idle';
  const canExecute = isConfigured && hasAtLeastOneFilter && folderName.trim() && state === 'preview';

  const processedCount = logLines.filter(e =>
    ['case_created', 'case_updated', 'case_skipped', 'case_error'].includes(e.type)
  ).length;
  const totalFromPreview = preview?.summary?.total || 0;
  const liveProgress = totalFromPreview > 0
    ? Math.min(100, Math.round((processedCount / totalFromPreview) * 100))
    : null;

  return (
    <div className={`d6-container${isDark ? ' dark-theme' : ''}`}>

      <div className="d6-title">
        <Settings size={22} />
        SYNCHRONISATION GITLAB → TESTMO
      </div>

      {error && (
        <div className="d6-alert d6-alert-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} />
          {error}
          <button
            className="d6-btn d6-btn-ghost"
            style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.75rem' }}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ---- Configuration ---- */}
      <div className="d6-section">
        <div className="d6-section-header">
          <Settings size={14} />
          Configuration
        </div>
        <div className="d6-section-body">
          <div className="d6-config-row">
            <div className="d6-field">
              <label>Projet</label>
              <select
                className="d6-select"
                value={selectedProject || ''}
                onChange={e => setSelectedProject(e.target.value)}
                disabled={state === 'syncing' || state === 'analyzing'}
              >
                <option value="" disabled>Choisir un projet...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.label} {p.configured ? '' : '(non configuré)'}
                  </option>
                ))}
              </select>
            </div>

            {currentProject && (
              <div style={{ paddingTop: '1.2rem' }}>
                <span className={`d6-badge ${isConfigured ? 'd6-badge-configured' : 'd6-badge-unconfigured'}`}>
                  {isConfigured ? 'Configuré' : 'Non configuré'}
                </span>
              </div>
            )}
          </div>

          {currentProject && !isConfigured && (
            <div className="d6-alert d6-alert-warn" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={15} />
              Ce projet n'est pas encore configuré — accès GitLab manquant.
            </div>
          )}

          {isConfigured && (
            <>
              <div className="d6-config-row">
                <div className="d6-field">
                  <label>Rechercher une itération</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="d6-input"
                      placeholder="Ex: R14"
                      value={iterSearch}
                      onChange={handleIterSearchChange}
                      disabled={state === 'syncing' || state === 'analyzing'}
                      style={{ paddingLeft: '32px' }}
                    />
                    <Search
                      size={14}
                      style={{
                        position: 'absolute', left: '10px', top: '50%',
                        transform: 'translateY(-50%)', color: 'var(--text-muted)',
                      }}
                    />
                  </div>
                </div>

                <div className="d6-field">
                  <label>
                    Itération
                    {loadingIters && <RefreshCw size={11} className="d6-spinner" style={{ marginLeft: 6 }} />}
                  </label>
                  <select
                    className="d6-select"
                    value={selectedIter}
                    onChange={e => {
                      setSelectedIter(e.target.value);
                      if (!folderName) setFolderName(e.target.value);
                    }}
                    disabled={state === 'syncing' || state === 'analyzing' || loadingIters}
                  >
                    <option value="">Choisir une itération...</option>
                    {iterations.map(it => (
                      <option key={it.id} value={it.title}>{it.title}</option>
                    ))}
                  </select>
                </div>

                <div style={{ paddingTop: '1.2rem' }}>
                  <button
                    className="d6-btn d6-btn-ghost"
                    title="Recharger les itérations"
                    onClick={() => loadIterations(selectedProject, iterSearch)}
                    disabled={loadingIters || state === 'syncing' || state === 'analyzing'}
                  >
                    <RefreshCw size={14} className={loadingIters ? 'd6-spinner' : ''} />
                  </button>
                </div>
              </div>

              <div className="d6-config-row" style={{ flexWrap: 'wrap', gap: '0.75rem', marginTop: '0.5rem' }}>
                <div className="d6-field">
                  <label>
                    Status Work Item
                    {loadingFilters && <RefreshCw size={11} className="d6-spinner" style={{ marginLeft: 4 }} />}
                  </label>
                  <select
                    className="d6-select"
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    disabled={loadingFilters || state === 'syncing' || state === 'analyzing'}
                  >
                    <option value="">— Tous les statuts —</option>
                    {statuses.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="d6-field">
                  <label>Version Prod</label>
                  <select
                    className="d6-select"
                    value={selectedVersionProd}
                    onChange={e => setSelectedVersionProd(e.target.value)}
                    disabled={loadingFilters || state === 'syncing' || state === 'analyzing'}
                  >
                    <option value="">— Toutes les versions —</option>
                    {versionsProd.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="d6-field">
                  <label>Version de test</label>
                  <select
                    className="d6-select"
                    value={selectedVersionTest}
                    onChange={e => setSelectedVersionTest(e.target.value)}
                    disabled={loadingFilters || state === 'syncing' || state === 'analyzing'}
                  >
                    <option value="">— Toutes —</option>
                    {versionsTest.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>

                <div className="d6-field">
                  <label>
                    Nom du dossier Testmo <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="d6-input"
                    value={folderName}
                    onChange={e => setFolderName(e.target.value)}
                    placeholder="Ex : R14 - run 2"
                    disabled={state === 'syncing' || state === 'analyzing'}
                  />
                </div>
              </div>

              <div className="d6-btn-row">
                <button
                  className="d6-btn d6-btn-primary"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze}
                >
                  {state === 'analyzing'
                    ? <><RefreshCw size={14} className="d6-spinner" /> Analyse en cours...</>
                    : <><Search size={14} /> Analyser</>
                  }
                </button>

                {(state === 'preview' || state === 'done') && (
                  <button className="d6-btn d6-btn-ghost" onClick={handleReset}>
                    Recommencer
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---- Aperçu ---- */}
      {(state === 'preview' || state === 'syncing' || state === 'done') && (
        <D6SyncPreview
          preview={preview}
          state={state}
          folderName={folderName}
          currentProject={currentProject}
          canExecute={canExecute}
          onExecute={handleExecute}
        />
      )}

      {/* ---- Progression SSE ---- */}
      {(state === 'syncing' || state === 'done') && (
        <D6SyncLog
          state={state}
          logLines={logLines}
          liveProgress={liveProgress}
          finalStats={finalStats}
          selectedProject={selectedProject}
          selectedIter={selectedIter}
          isDark={isDark}
          logEndRef={logEndRef}
        />
      )}

      {/* ---- Historique ---- */}
      <D6SyncHistory history={history} onReload={loadHistory} />

    </div>
  );
}
