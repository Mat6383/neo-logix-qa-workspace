import React from 'react';
import {
  CheckCircle2,
  RefreshCw,
  SkipForward,
  XCircle,
  FolderOpen,
  Zap,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import RunActionPanel from './RunActionPanel';

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

function LogLineText({ event }) {
  const { type, name, gitlabIid, gitlabUrl, testmoUrl, message, parent, child, created, updated, skipped, errors, total } = event;

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

export default function D6SyncLog({ state, logLines, liveProgress, finalStats, selectedProject, selectedIter, isDark, logEndRef }) {
  return (
    <div className="d6-section">
      <div className="d6-section-header">
        <Zap size={14} />
        {state === 'syncing' ? 'Progression en cours...' : 'Synchronisation terminée'}
      </div>
      <div className="d6-section-body">

        {liveProgress !== null && (
          <div className="d6-progress-bar-outer">
            <div
              className="d6-progress-bar-inner"
              style={{ width: `${liveProgress}%` }}
            />
          </div>
        )}

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

        {state === 'done' && selectedProject && selectedIter && (
          <RunActionPanel
            syncProjectId={selectedProject}
            iterationName={selectedIter}
            isDark={isDark}
          />
        )}
      </div>
    </div>
  );
}
