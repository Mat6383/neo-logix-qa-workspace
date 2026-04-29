/**
 * ================================================
 * DASHBOARD 7 - CrossTest OK — Tickets Validés
 * ================================================
 * Liste les issues GitLab avec label CrossTest::OK
 * pour une itération sélectionnée.
 * Commentaires persistants en SQLite (full CRUD inline).
 *
 * @author Matou - Neo-Logix QA Lead
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../hooks/useToast';
import apiService from '../services/api.service';
import {
  Link2,
  RefreshCw,
  ExternalLink,
  MessageSquare,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  ChevronDown
} from 'lucide-react';
import '../styles/Dashboard7.css';

/* =========================================
   Sous-composant: cellule Commentaires
   ========================================= */
function CommentCell({ issue, comment, milestoneTitle, onSaved, onDeleted }) {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  // Ouvrir le formulaire d'édition
  const openEdit = () => {
    setDraft(comment ? comment.comment : '');
    setEditing(true);
    // Focus le textarea au prochain tick
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const handleSave = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    try {
      const saved = await apiService.saveCrosstestComment(issue.iid, text, milestoneTitle);
      onSaved(issue.iid, saved);
      setEditing(false);
      setDraft('');
    } catch (err) {
      console.error('Erreur sauvegarde commentaire:', err);
      addToast({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer le commentaire pour #${issue.iid} ?`)) return;
    setSaving(true);
    try {
      await apiService.deleteCrosstestComment(issue.iid);
      onDeleted(issue.iid);
    } catch (err) {
      console.error('Erreur suppression commentaire:', err);
      addToast({ message: `Erreur: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Formulaire inline (nouveau ou édition)
  if (editing) {
    return (
      <div className="d7-comment-form">
        <textarea
          ref={textareaRef}
          className="d7-comment-textarea"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Saisir un commentaire..."
          rows={3}
          disabled={saving}
          onKeyDown={e => {
            if (e.key === 'Escape') cancelEdit();
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
          }}
        />
        <div className="d7-comment-form-actions">
          <button
            className="d7-comment-save-btn"
            onClick={handleSave}
            disabled={saving || !draft.trim()}
          >
            {saving ? <RefreshCw size={12} className="d7-spinner" /> : null}
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
          <button
            className="d7-comment-cancel-btn"
            onClick={cancelEdit}
            disabled={saving}
          >
            Annuler
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Ctrl+Entrée pour sauvegarder
          </span>
        </div>
      </div>
    );
  }

  // Affichage commentaire existant
  if (comment) {
    return (
      <div className="d7-comment-view">
        <span className="d7-comment-text">{comment.comment}</span>
        <div className="d7-comment-actions">
          <button
            className="d7-icon-btn edit"
            title="Modifier le commentaire"
            onClick={openEdit}
            disabled={saving}
          >
            <Pencil size={13} />
          </button>
          <button
            className="d7-icon-btn del"
            title="Supprimer le commentaire"
            onClick={handleDelete}
            disabled={saving}
          >
            {saving ? <RefreshCw size={13} className="d7-spinner" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>
    );
  }

  // Pas encore de commentaire
  return (
    <button className="d7-comment-add-btn" onClick={openEdit} disabled={saving}>
      <Plus size={12} />
      Ajouter un commentaire...
    </button>
  );
}

/* =========================================
   Composant principal Dashboard7
   ========================================= */
export default function Dashboard7({ isDark }) {
  const [iterations, setIterations] = useState([]);
  const [selectedIteration, setSelectedIteration] = useState(null);
  const [issues, setIssues] = useState([]);
  const [comments, setComments] = useState({});   // { [iid]: row }
  const [filter, setFilter] = useState('');

  const [loadingIterations, setLoadingIterations] = useState(true);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [iterationsError, setIterationsError] = useState(null);
  const [issuesError, setIssuesError] = useState(null);

  /* ---- Chargement initial: itérations + commentaires ---- */
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoadingIterations(true);
      setIterationsError(null);
      try {
        const [iters, cmts] = await Promise.all([
          apiService.getCrosstestIterations(),
          apiService.getCrosstestComments()
        ]);
        if (cancelled) return;
        setIterations(iters || []);
        setComments(cmts || {});
        // Sélectionner automatiquement la première itération
        if (iters && iters.length > 0 && !selectedIteration) {
          setSelectedIteration(iters[0]);
        }
      } catch (err) {
        if (cancelled) return;
        setIterationsError(err.message);
      } finally {
        if (!cancelled) setLoadingIterations(false);
      }
    }

    loadAll();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Chargement des issues quand l'itération change ---- */
  useEffect(() => {
    if (!selectedIteration) return;
    let cancelled = false;

    async function loadIssues() {
      setLoadingIssues(true);
      setIssuesError(null);
      setFilter('');
      try {
        const data = await apiService.getCrosstestIssues(selectedIteration.id);
        if (!cancelled) setIssues(data || []);
      } catch (err) {
        if (!cancelled) setIssuesError(err.message);
      } finally {
        if (!cancelled) setLoadingIssues(false);
      }
    }

    loadIssues();
    return () => { cancelled = true; };
  }, [selectedIteration]);

  /* ---- Rafraîchir les commentaires (après changement de milestone) ---- */
  const refreshComments = useCallback(async () => {
    try {
      const cmts = await apiService.getCrosstestComments();
      setComments(cmts || {});
    } catch (err) {
      console.error('Erreur rechargement commentaires:', err);
    }
  }, []);

  /* ---- Rafraîchir les issues ---- */
  const handleRefresh = useCallback(async () => {
    if (!selectedIteration) return;
    setLoadingIssues(true);
    setIssuesError(null);
    try {
      const [data, cmts] = await Promise.all([
        apiService.getCrosstestIssues(selectedIteration.id),
        apiService.getCrosstestComments()
      ]);
      setIssues(data || []);
      setComments(cmts || {});
    } catch (err) {
      setIssuesError(err.message);
    } finally {
      setLoadingIssues(false);
    }
  }, [selectedIteration]);

  /* ---- Callbacks commentaires ---- */
  const handleCommentSaved = useCallback((iid, row) => {
    setComments(prev => ({ ...prev, [iid]: row }));
  }, []);

  const handleCommentDeleted = useCallback((iid) => {
    setComments(prev => {
      const next = { ...prev };
      delete next[iid];
      return next;
    });
  }, []);

  /* ---- Filtrage ---- */
  const filteredIssues = filter
    ? issues.filter(issue => {
        const q = filter.toLowerCase();
        return (
          String(issue.iid).includes(q) ||
          issue.title.toLowerCase().includes(q) ||
          issue.assignees.join(' ').toLowerCase().includes(q) ||
          issue.labels.join(' ').toLowerCase().includes(q)
        );
      })
    : issues;

  /* ---- Rendu ---- */
  return (
    <div className="d7-container">
      {/* Titre */}
      <div className="d7-header">
        <Link2 size={22} />
        CROSSTEST OK — TICKETS VALIDÉS
      </div>

      {/* Barre de contrôles */}
      <div className="d7-controls">
        <span className="d7-label">Itération :</span>

        {loadingIterations ? (
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            <RefreshCw size={14} className="d7-spinner" style={{ display: 'inline', marginRight: 4 }} />
            Chargement...
          </span>
        ) : iterationsError ? (
          <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>
            Erreur: {iterationsError}
          </span>
        ) : (
          <select
            className="d7-select"
            value={selectedIteration?.id ?? ''}
            onChange={e => {
              const found = iterations.find(it => String(it.id) === e.target.value);
              setSelectedIteration(found || null);
            }}
          >
            {iterations.length === 0 && (
              <option value="">Aucune itération disponible</option>
            )}
            {iterations.map(it => (
              <option key={it.id} value={it.id}>
                {it.title}
                {it.state === 'closed' ? ' (terminée)' : ''}
              </option>
            ))}
          </select>
        )}

        <button
          className="d7-btn"
          onClick={handleRefresh}
          disabled={loadingIssues || !selectedIteration}
          title="Rafraîchir les issues"
        >
          <RefreshCw size={14} className={loadingIssues ? 'd7-spinner' : ''} />
          Rafraîchir
        </button>

        <div className="d7-spacer" />

        <input
          type="text"
          className="d7-filter-input"
          placeholder="Filtrer par titre, assigné, label..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      {/* Résumé */}
      {selectedIteration && !loadingIssues && !issuesError && (
        <p className="d7-summary">
          <strong>{filteredIssues.length}</strong>
          {filter
            ? ` ticket${filteredIssues.length !== 1 ? 's' : ''} correspondant au filtre (sur ${issues.length})`
            : ` ticket${issues.length !== 1 ? 's' : ''}`
          }
          {' '}avec <strong>CrossTest::OK</strong> pour <strong>{selectedIteration.title}</strong>
        </p>
      )}

      {/* Section tableau */}
      <div className="d7-table-section">
        {/* États: chargement / erreur / vide / itération non sélectionnée */}
        {!selectedIteration && !loadingIterations && (
          <div className="d7-state-box">
            <ChevronDown size={36} />
            <p className="d7-state-title">Sélectionnez une itération</p>
            <p className="d7-state-desc">Choisissez une itération dans le menu déroulant pour afficher les tickets.</p>
          </div>
        )}

        {loadingIssues && (
          <div className="d7-state-box">
            <RefreshCw size={36} className="d7-spinner" />
            <p className="d7-state-title">Chargement des tickets...</p>
            <p className="d7-state-desc">Interrogation de l'API GitLab pour <strong>{selectedIteration?.title}</strong>.</p>
          </div>
        )}

        {issuesError && !loadingIssues && (
          <div className="d7-state-box d7-state-error">
            <AlertCircle size={36} />
            <p className="d7-state-title">Erreur de chargement</p>
            <p className="d7-state-desc">{issuesError}</p>
            <button className="d7-btn d7-btn-primary" onClick={handleRefresh}>
              <RefreshCw size={14} /> Réessayer
            </button>
          </div>
        )}

        {!loadingIssues && !issuesError && selectedIteration && issues.length === 0 && (
          <div className="d7-state-box">
            <MessageSquare size={36} />
            <p className="d7-state-title">Aucun ticket trouvé</p>
            <p className="d7-state-desc">
              Aucune issue avec le label <strong>CrossTest::OK</strong> pour l'itération <strong>{selectedIteration.title}</strong>.
            </p>
          </div>
        )}

        {!loadingIssues && !issuesError && filteredIssues.length === 0 && issues.length > 0 && (
          <div className="d7-state-box">
            <MessageSquare size={36} />
            <p className="d7-state-title">Aucun résultat</p>
            <p className="d7-state-desc">Aucun ticket ne correspond au filtre "{filter}".</p>
          </div>
        )}

        {/* Tableau principal */}
        {!loadingIssues && !issuesError && filteredIssues.length > 0 && (
          <div className="d7-table-wrapper">
            <table className="d7-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ticket</th>
                  <th>Assigné(s)</th>
                  <th>Statut</th>
                  <th>Commentaires</th>
                </tr>
              </thead>
              <tbody>
                {filteredIssues.map(issue => (
                  <tr key={issue.iid}>
                    {/* IID */}
                    <td>{issue.iid}</td>

                    {/* Titre + lien + labels */}
                    <td>
                      <a
                        className="d7-issue-link"
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Ouvrir #${issue.iid} dans GitLab`}
                      >
                        <span className="d7-issue-iid">#{issue.iid}</span>
                        {issue.title}
                        <ExternalLink size={12} style={{ flexShrink: 0 }} />
                      </a>
                      {issue.labels && issue.labels.length > 0 && (
                        <div className="d7-labels">
                          {issue.labels.map(label => (
                            <span key={label} className="d7-label-chip">{label}</span>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Assignés */}
                    <td>
                      {issue.assignees && issue.assignees.length > 0
                        ? issue.assignees.join(', ')
                        : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Non assigné</span>
                      }
                    </td>

                    {/* Statut */}
                    <td>
                      {issue.state === 'closed' ? (
                        <span className="d7-badge d7-badge-closed">
                          <CheckCircle2 size={11} />
                          Fermé
                        </span>
                      ) : (
                        <span className="d7-badge d7-badge-open">
                          <Clock size={11} />
                          Ouvert
                        </span>
                      )}
                    </td>

                    {/* Commentaires */}
                    <td className="d7-comment-cell">
                      <CommentCell
                        issue={issue}
                        comment={comments[issue.iid] || null}
                        milestoneTitle={selectedIteration?.title}
                        onSaved={handleCommentSaved}
                        onDeleted={handleCommentDeleted}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
