/**
 * ================================================
 * DASHBOARD 6 - Synchronisation GitLab → Testmo
 * ================================================
 * Interface de pilotage de la synchronisation des tickets GitLab
 * vers les cas de test Testmo.
 *
 * Flow:
 *   idle → analyzing → preview → syncing → done
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Settings,
  RefreshCw,
  Search,
  Play,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertCircle,
  Clock,
  FolderOpen,
  GitBranch,
  Zap,
  History,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import apiService from '../services/api.service';
import '../styles/Dashboard6.css';

// ============================================================
// Helpers
// ============================================================

/**
 * Formate une date ISO en dd/MM HH:mm
 */
function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) {
    return iso;
  }
}

// ============================================================
// Sous-composants
// ============================================================

/** Icône selon le statut d'un log line */
function LogIcon({ type }) {
  switch (type) {
    case 'case_created': return <CheckCircle2 size={13} className="d6-log-created" />;
    case 'case_updated': return <RefreshCw    size={13} className="d6-log-updated" />;
    case 'case_skipped': return <SkipForward  size={13} className="d6-log-skipped" />;
    case 'case_error':   return <XCircle      size={13} className="d6-log-error"   />;
    case 'folder':       return <FolderOpen   size={13} className="d6-log-info"    />;
    case 'start':        return <Zap          size={13} className="d6-log-info"    />;
    case 'done':         return <CheckCircle2 size={13} className="d6-log-done"    />;
    case 'error':        return <AlertCircle  size={13} className="d6-log-error"   />;
    default:             return <span style={{ width: 13 }} />;
  }
}

/** Classe CSS selon le statut d'un log line */
function logLineClass(type) {
  switch (type) {
    case 'case_created': return 'd6-log-created';
    case 'case_updated': return 'd6-log-updated';
    case 'case_skipped': return 'd6-log-skipped';
    case 'case_error':   return 'd6-log-error';
    case 'done':         return 'd6-log-done';
    case 'error':        return 'd6-log-error';
    default:             return 'd6-log-info';
  }
}

/** Texte d'une log line */
function LogLineText({ event }) {
  const { type, name, gitlabIid, gitlabUrl, testmoUrl, message, parent, child, created, updated, skipped, enriched, errors, total } = event;

  switch (type) {
    case 'start':
      return <span>Démarrage de la synchronisation...</span>;
    case 'folder':
      return (
        <span>
          Dossier prêt : <strong>{parent}</strong> <ChevronRight size={11} /> <strong>{child}</strong>
        </span>
      );
    case 'case_created':
      return (
        <span>
          Créé : <strong>#{gitlabIid}</strong> {name}
          {gitlabUrl && <a className="d6-log-link" href={gitlabUrl} target="_blank" rel="noreferrer"> [GitLab]</a>}
          {testmoUrl && <a className="d6-log-link" href={testmoUrl} target="_blank" rel="noreferrer"> [Testmo]</a>}
        </span>
      );
    case 'case_updated':
      return (
        <span>
          Mis à jour : <strong>#{gitlabIid}</strong> {name}
          {testmoUrl && <a className="d6-log-link" href={testmoUrl} target="_blank" rel="noreferrer"> [Testmo]</a>}
        </span>
      );
    case 'case_skipped':
      return <span>Ignoré (enrichi manuellement) : <strong>#{gitlabIid}</strong> {name}</span>;
    case 'case_error':
      return <span>Erreur sur <strong>#{gitlabIid}</strong> {name} : {message}</span>;
    case 'error':
      return <span>Erreur fatale : {message}</span>;
    case 'done':
      return (
        <span>
          Terminé — Créés: <strong>{created}</strong> | MàJ: <strong>{updated}</strong> |
          Ignorés: <strong>{skipped}</strong> | Erreurs: <strong>{errors}</strong> | Total: <strong>{total}</strong>
        </span>
      );
    default:
      return <span>{JSON.stringify(event)}</span>;
  }
}

// ============================================================
// Composant principal Dashboard6
// ============================================================

export default function Dashboard6({ isDark }) {
  // ---- State ----------------------------------------------------
  const [state, setState] = useState('idle'); // idle | analyzing | preview | syncing | done
  const [projects, setProjects]         = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [iterations, setIterations]     = useState([]);
  const [iterSearch, setIterSearch]     = useState('');
  const [selectedIter, setSelectedIter] = useState('');
  const [loadingIters, setLoadingIters] = useState(false);
  const [preview, setPreview]           = useState(null);   // { iteration, folder, issues, summary }
  const [logLines, setLogLines]         = useState([]);     // événements SSE
  const [finalStats, setFinalStats]     = useState(null);
  const [history, setHistory]           = useState([]);
  const [error, setError]               = useState(null);

  const logEndRef  = useRef(null);
  const iterTimerRef = useRef(null);

  // ---- Chargement initial ----------------------------------------
  useEffect(() => {
    loadProjects();
    loadHistory();
  }, []);

  // Auto-scroll du log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logLines]);

  // ---- Chargement des projets ------------------------------------
  const loadProjects = async () => {
    try {
      const list = await apiService.getSyncProjects();
      setProjects(list);
      // Pré-sélectionner le premier projet configuré
      const firstConfigured = list.find(p => p.configured);
      if (firstConfigured) setSelectedProject(firstConfigured.id);
    } catch (err) {
      setError('Impossible de charger les projets: ' + err.message);
    }
  };

  const loadHistory = async () => {
    try {
      const rows = await apiService.getSyncHistory();
      setHistory(rows || []);
    } catch (_) {
      // Historique non critique
    }
  };

  // ---- Chargement des itérations (avec debounce) -----------------
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

  // Recharger les itérations quand le projet change
  useEffect(() => {
    if (selectedProject) {
      loadIterations(selectedProject, iterSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  // Debounce sur la recherche d'itération
  const handleIterSearchChange = (e) => {
    const val = e.target.value;
    setIterSearch(val);
    if (iterTimerRef.current) clearTimeout(iterTimerRef.current);
    iterTimerRef.current = setTimeout(() => {
      loadIterations(selectedProject, val);
    }, 400);
  };

  // ---- Analyse (preview) -----------------------------------------
  const handleAnalyze = async () => {
    if (!selectedProject || !selectedIter) return;
    setError(null);
    setPreview(null);
    setState('analyzing');

    try {
      const data = await apiService.previewSync(selectedProject, selectedIter);
      setPreview(data);
      setState('preview');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  // ---- Exécution avec SSE ----------------------------------------
  const handleExecute = () => {
    if (!selectedProject || !selectedIter) return;
    setError(null);
    setLogLines([]);
    setFinalStats(null);
    setState('syncing');

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

    // SSE via EventSource ne supporte pas POST nativement.
    // On utilise fetch + ReadableStream pour simuler SSE avec POST.
    const ctrl = new AbortController();

    fetch(`${API_BASE}/sync/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: selectedProject, iterationName: selectedIter }),
      signal: ctrl.signal
    }).then(async (response) => {
      if (!response.ok) {
        const json = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processChunk = (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // garder le fragment incomplet

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              setLogLines(prev => [...prev, event]);

              if (event.type === 'done') {
                setFinalStats({
                  created: event.created || 0,
                  updated: event.updated || 0,
                  skipped: event.skipped || 0,
                  enriched: event.enriched || 0,
                  errors:  event.errors  || 0,
                  total:   event.total   || 0
                });
                setState('done');
                loadHistory();
              }

              if (event.type === 'error') {
                setError(event.message || 'Erreur inconnue');
                setState('preview');
              }
            } catch (_) {
              // Ligne non-JSON (heartbeat :ping), on ignore
            }
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer) processChunk('');
          break;
        }
        processChunk(decoder.decode(value, { stream: true }));
      }
    }).catch((err) => {
      if (err.name !== 'AbortError') {
        setError('Erreur connexion SSE: ' + err.message);
        setState('preview');
      }
    });
  };

  // ---- Reset -------------------------------------------------------
  const handleReset = () => {
    setState('idle');
    setPreview(null);
    setLogLines([]);
    setFinalStats(null);
    setError(null);
  };

  // ---- Helpers UI --------------------------------------------------
  const currentProject = projects.find(p => p.id === selectedProject);
  const isConfigured   = currentProject?.configured === true;
  const canAnalyze     = isConfigured && selectedIter && state === 'idle';
  const canExecute     = isConfigured && selectedIter && state === 'preview';
  const progressPct    = finalStats && finalStats.total > 0
    ? Math.round(((finalStats.created + finalStats.updated + finalStats.skipped + finalStats.errors) / finalStats.total) * 100)
    : (state === 'syncing' ? null : 0);

  // Calcul du % de progression pendant le sync
  const processedCount = logLines.filter(e =>
    ['case_created', 'case_updated', 'case_skipped', 'case_error'].includes(e.type)
  ).length;
  const totalFromPreview = preview?.summary?.total || 0;
  const liveProgress = totalFromPreview > 0
    ? Math.min(100, Math.round((processedCount / totalFromPreview) * 100))
    : null;

  // ---- Rendu -------------------------------------------------------
  return (
    <div className={`d6-container${isDark ? ' dark-theme' : ''}`}>

      {/* Titre */}
      <div className="d6-title">
        <Settings size={22} />
        SYNCHRONISATION GITLAB → TESTMO
      </div>

      {/* Message d'erreur global */}
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

      {/* ---- Section Configuration ---- */}
      <div className="d6-section">
        <div className="d6-section-header">
          <Settings size={14} />
          Configuration
        </div>
        <div className="d6-section-body">
          <div className="d6-config-row">

            {/* Sélecteur de projet */}
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

            {/* Statut projet */}
            {currentProject && (
              <div style={{ paddingTop: '1.2rem' }}>
                <span className={`d6-badge ${isConfigured ? 'd6-badge-configured' : 'd6-badge-unconfigured'}`}>
                  {isConfigured ? 'Configuré' : 'Non configuré'}
                </span>
              </div>
            )}
          </div>

          {/* Message si projet non configuré */}
          {currentProject && !isConfigured && (
            <div className="d6-alert d6-alert-warn" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={15} />
              Ce projet n'est pas encore configuré — accès GitLab manquant.
            </div>
          )}

          {/* Sélecteur d'itération (uniquement si projet configuré) */}
          {isConfigured && (
            <>
              <div className="d6-config-row">
                {/* Recherche itération */}
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
                        transform: 'translateY(-50%)', color: 'var(--text-muted)'
                      }}
                    />
                  </div>
                </div>

                {/* Dropdown itération */}
                <div className="d6-field">
                  <label>
                    Itération
                    {loadingIters && <RefreshCw size={11} className="d6-spinner" style={{ marginLeft: 6 }} />}
                  </label>
                  <select
                    className="d6-select"
                    value={selectedIter}
                    onChange={e => setSelectedIter(e.target.value)}
                    disabled={state === 'syncing' || state === 'analyzing' || loadingIters}
                  >
                    <option value="">Choisir une itération...</option>
                    {iterations.map(it => (
                      <option key={it.id} value={it.title}>{it.title}</option>
                    ))}
                  </select>
                </div>

                {/* Bouton reload itérations */}
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

              {/* Boutons d'action */}
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

      {/* ---- Section Aperçu ---- */}
      {(state === 'preview' || state === 'syncing' || state === 'done') && preview && (
        <div className="d6-section">
          <div className="d6-section-header">
            <Search size={14} />
            Aperçu — {preview.iteration?.name}
          </div>
          <div className="d6-section-body">

            {/* Chemin du dossier */}
            <div className="d6-preview-path">
              <FolderOpen size={13} />
              <span>{currentProject?.label}</span>
              <span className="d6-preview-path-sep"><ArrowRight size={11} /></span>
              <span>{preview.folder?.parent}</span>
              <span className="d6-preview-path-sep"><ArrowRight size={11} /></span>
              <span>{preview.folder?.child}</span>
              {preview.folder?.exists && (
                <span className="d6-badge d6-badge-configured" style={{ marginLeft: 6 }}>existe déjà</span>
              )}
            </div>

            {/* Chips résumé */}
            <div className="d6-preview-summary">
              <div className="d6-summary-chip d6-chip-create">
                <CheckCircle2 size={13} />
                {preview.summary?.toCreate} à créer
              </div>
              <div className="d6-summary-chip d6-chip-update">
                <RefreshCw size={13} />
                {preview.summary?.toUpdate} à mettre à jour
              </div>
              <div className="d6-summary-chip d6-chip-skip">
                <SkipForward size={13} />
                {preview.summary?.toSkip} à ignorer
              </div>
              <div className="d6-summary-chip d6-chip-total">
                <GitBranch size={13} />
                {preview.summary?.total} au total
              </div>
            </div>

            {/* Liste des tickets */}
            {preview.issues && preview.issues.length > 0 && (
              <ul className="d6-issue-list">
                {preview.issues.map(issue => (
                  <li key={issue.iid} className="d6-issue-item">
                    <span className="d6-issue-iid">
                      {issue.url
                        ? <a href={issue.url} target="_blank" rel="noreferrer" className="d6-log-link">#{issue.iid}</a>
                        : `#${issue.iid}`
                      }
                    </span>
                    <span className="d6-issue-title" title={issue.title}>{issue.title}</span>
                    <span className={`d6-issue-status ${
                      issue.status === 'create'        ? 'd6-status-create' :
                      issue.status === 'update'        ? 'd6-status-update' :
                      'd6-status-skip'
                    }`}>
                      {issue.status === 'create'       ? 'CRÉER'         :
                       issue.status === 'update'       ? 'MAJ'           :
                       'IGNORÉ'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {preview.issues?.length === 0 && (
              <div className="d6-alert d6-alert-info">
                <AlertCircle size={14} />
                Aucun ticket trouvé pour cette itération.
              </div>
            )}

            {/* Bouton exécuter */}
            {state === 'preview' && (
              <div className="d6-btn-row">
                <button
                  className="d6-btn d6-btn-success"
                  onClick={handleExecute}
                  disabled={!canExecute || preview.summary?.total === 0}
                >
                  <Play size={14} />
                  Confirmer et Synchroniser
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Section Progression (SSE) ---- */}
      {(state === 'syncing' || state === 'done') && (
        <div className="d6-section">
          <div className="d6-section-header">
            <Zap size={14} />
            {state === 'syncing' ? 'Progression en cours...' : 'Synchronisation terminée'}
          </div>
          <div className="d6-section-body">

            {/* Barre de progression */}
            {liveProgress !== null && (
              <div className="d6-progress-bar-outer">
                <div
                  className="d6-progress-bar-inner"
                  style={{ width: `${liveProgress}%` }}
                />
              </div>
            )}

            {/* Log SSE */}
            <div className="d6-log">
              {logLines.map((event, i) => (
                <div key={i} className={`d6-log-line ${logLineClass(event.type)}`}>
                  <span className="d6-log-icon">
                    <LogIcon type={event.type} />
                  </span>
                  <span className="d6-log-text">
                    <LogLineText event={event} />
                  </span>
                </div>
              ))}
              {state === 'syncing' && (
                <div className="d6-log-line d6-log-info">
                  <span className="d6-log-icon">
                    <RefreshCw size={13} className="d6-spinner" />
                  </span>
                  <span className="d6-log-text">Synchronisation en cours...</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>

            {/* Stats finales */}
            {state === 'done' && finalStats && (
              <div className="d6-stats-row">
                <div className="d6-stat-card">
                  <div className="d6-stat-number d6-stat-created">{finalStats.created}</div>
                  <div className="d6-stat-label">Créés</div>
                </div>
                <div className="d6-stat-card">
                  <div className="d6-stat-number d6-stat-updated">{finalStats.updated}</div>
                  <div className="d6-stat-label">Mis à jour</div>
                </div>
                <div className="d6-stat-card">
                  <div className="d6-stat-number d6-stat-skipped">{finalStats.skipped}</div>
                  <div className="d6-stat-label">Ignorés</div>
                </div>
                <div className="d6-stat-card">
                  <div className="d6-stat-number d6-stat-errors">{finalStats.errors}</div>
                  <div className="d6-stat-label">Erreurs</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Section Historique ---- */}
      <div className="d6-section">
        <div className="d6-section-header">
          <History size={14} />
          Historique (50 derniers runs)
          <button
            className="d6-btn d6-btn-ghost"
            style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.7rem', color: '#CBD5E1' }}
            onClick={loadHistory}
          >
            <RefreshCw size={11} />
          </button>
        </div>

        {history.length === 0 ? (
          <div className="d6-section-body">
            <div className="d6-alert d6-alert-info">
              <Clock size={14} />
              Aucun historique disponible — lancez votre première synchronisation.
            </div>
          </div>
        ) : (
          <table className="d6-history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Projet</th>
                <th>Itération</th>
                <th>Mode</th>
                <th style={{ textAlign: 'center' }}>Créés</th>
                <th style={{ textAlign: 'center' }}>MàJ</th>
                <th style={{ textAlign: 'center' }}>Ignorés</th>
                <th style={{ textAlign: 'center' }}>Erreurs</th>
                <th style={{ textAlign: 'center' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {history.map(row => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {formatDate(row.executed_at)}
                  </td>
                  <td><strong>{row.project_name}</strong></td>
                  <td>{row.iteration_name}</td>
                  <td>
                    <span className={row.mode === 'execute' ? 'd6-mode-execute' : 'd6-mode-preview'}>
                      {row.mode === 'execute' ? 'Exécution' : 'Aperçu'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--color-success)', fontWeight: 700 }}>{row.created}</td>
                  <td style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: 700 }}>{row.updated}</td>
                  <td style={{ textAlign: 'center', color: 'var(--color-gray-500)' }}>{row.skipped}</td>
                  <td style={{ textAlign: 'center', color: row.errors > 0 ? 'var(--color-danger)' : 'inherit' }}>{row.errors}</td>
                  <td style={{ textAlign: 'center' }}>{row.total_issues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
