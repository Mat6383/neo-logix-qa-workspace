import React from 'react';
import { History, RefreshCw, Clock, AlertCircle } from 'lucide-react';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) {
    return iso;
  }
}

export default function D6SyncHistory({ history, onReload }) {
  return (
    <div className="d6-section">
      <div className="d6-section-header">
        <History size={14} />
        Historique (50 derniers runs)
        <button
          className="d6-btn d6-btn-ghost"
          style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.7rem', color: '#CBD5E1' }}
          onClick={onReload}
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
  );
}
