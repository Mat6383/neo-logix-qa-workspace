import React from 'react';
import {
  Search,
  FolderOpen,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  SkipForward,
  GitBranch,
  AlertCircle,
  Play,
} from 'lucide-react';

export default function D6SyncPreview({ preview, state, folderName, currentProject, canExecute, onExecute }) {
  if (!preview) return null;

  return (
    <div className="d6-section">
      <div className="d6-section-header">
        <Search size={14} />
        Aperçu — {folderName}
        {preview.filters?.iterationName && (
          <span style={{ marginLeft: 6, opacity: 0.65, fontSize: '0.8em' }}>
            ({preview.filters.iterationName})
          </span>
        )}
      </div>
      <div className="d6-section-body">

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
                  issue.status === 'create' ? 'd6-status-create' :
                  issue.status === 'update' ? 'd6-status-update' :
                  'd6-status-skip'
                }`}>
                  {issue.status === 'create' ? 'CRÉER' :
                   issue.status === 'update' ? 'MAJ' :
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

        {state === 'preview' && (
          <div className="d6-btn-row">
            <button
              className="d6-btn d6-btn-success"
              onClick={onExecute}
              disabled={!canExecute || preview.summary?.total === 0}
            >
              <Play size={14} />
              Confirmer et Synchroniser
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
