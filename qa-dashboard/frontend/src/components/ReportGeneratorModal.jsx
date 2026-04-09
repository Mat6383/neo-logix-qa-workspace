import React, { useState, useEffect } from 'react';
import {
  X, FileText, Download, Plus, Trash2, Activity, CheckSquare,
  FileSpreadsheet, Globe, Pencil
} from 'lucide-react';
import apiService from '../services/api.service';
import '../styles/ReportGeneratorModal.css';

const DEFAULT_RECOMMENDATIONS = [
  { id: 1, category: 'Muda — Gaspillage', text: 'Revue de testabilité avant chaque campagne. Formaliser les critères d\'acceptation des cas de test.', type: 'Action corrective', priority: 'Haute' },
  { id: 2, category: 'Mura — Irrégularité', text: 'Processus Change Management (CAB) pour les modifications de processus automatisés.', type: 'Action corrective', priority: 'Haute' },
  { id: 3, category: 'Jidoka — Qualité intégrée', text: 'Renforcer les tests shift-left : revues de code et tests unitaires plus tôt dans le cycle.', type: 'Amélioration', priority: 'Moyenne' },
  { id: 4, category: 'Heijunka — Lissage', text: 'Répartir la charge de test : max 30 tests par run pour un suivi plus granulaire.', type: 'Opportunité', priority: 'Moyenne' },
];

const ReportGeneratorModal = ({ isOpen, onClose, metrics, project, isDark }) => {
  const [formats, setFormats] = useState({ html: true, pptx: true });
  const [recommendations, setRecommendations] = useState([...DEFAULT_RECOMMENDATIONS]);
  const [complement, setComplement] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);
  const [nextId, setNextId] = useState(DEFAULT_RECOMMENDATIONS.length + 1);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGenerating(false);
      setGenerated(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Extract milestone info from metrics
  const runs = metrics?.runs || [];
  const milestoneName = (() => {
    const standardRuns = runs.filter(r => !r.isExploratory);
    if (standardRuns.length > 0) {
      const match = standardRuns[0]?.name?.match(/R\d+[a-zA-Z]?/i);
      return match ? match[0] : 'Release';
    }
    return 'Release';
  })();

  const milestoneId = runs[0]?.milestone || null;
  const projectId = project?.id || 1;

  const totalTests = runs.reduce((s, r) => s + (r.total || 0), 0);
  const totalPassed = runs.reduce((s, r) => s + (r.passed || 0), 0);
  const totalFailed = runs.reduce((s, r) => s + (r.failed || 0), 0);

  // Recommendations handlers
  const updateReco = (id, field, value) => {
    setRecommendations(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const deleteReco = (id) => {
    setRecommendations(prev => prev.filter(r => r.id !== id));
  };

  const addReco = () => {
    setRecommendations(prev => [...prev, {
      id: nextId,
      category: '',
      text: '',
      type: 'Action corrective',
      priority: 'Moyenne',
    }]);
    setNextId(n => n + 1);
  };

  // Download helper
  const downloadBase64 = (base64, filename, mimeType) => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Generate
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const response = await apiService.generateReport({
        projectId,
        milestoneId,
        formats,
        recommendations: recommendations.filter(r => r.text.trim()),
        complement: complement.trim(),
      });
      setGenerated(response.data || response);
    } catch (err) {
      setError(err.message || 'Erreur lors de la génération');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rgm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`rgm-modal ${isDark ? 'dark-theme' : ''}`}>
        {/* Header */}
        <div className="rgm-header">
          <h2><FileText size={20} /> Générer Rapport de Clôture</h2>
          <button className="rgm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="rgm-body">
          {/* === STEP 1: Milestone & Runs === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">1</span>
              Périmètre — {milestoneName}
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              <span><strong>{runs.length}</strong> runs</span>
              <span style={{ color: '#10b981' }}><strong>{totalPassed}</strong> réussis</span>
              <span style={{ color: '#ef4444' }}><strong>{totalFailed}</strong> échoués</span>
              <span><strong>{totalTests}</strong> tests au total</span>
            </div>
            <div className="rgm-runs-grid">
              {runs.map((run, i) => {
                const passed = run.success_count || run.passed || 0;
                const failed = run.failure_count || run.failed || 0;
                const total = run.total_count || run.total || 0;
                const rate = total > 0 ? Math.round(passed / total * 100) : 0;
                return (
                  <div key={run.id || i} className="rgm-run-card">
                    <strong>{run.name}</strong>
                    <div className="rgm-run-stats">
                      <span className="pass">{passed}P</span>
                      {failed > 0 && <span className="fail">{failed}F</span>}
                      <span>{rate}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* === STEP 2: Format selection === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">2</span>
              Formats de sortie
            </div>
            <div className="rgm-formats">
              <label className={`rgm-format-option ${formats.html ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={formats.html}
                  onChange={(e) => setFormats(f => ({ ...f, html: e.target.checked }))}
                />
                <div>
                  <div className="rgm-format-label"><Globe size={14} style={{ display: 'inline', marginRight: 4 }} />HTML</div>
                  <div className="rgm-format-desc">Page imprimable en PDF</div>
                </div>
              </label>
              <label className={`rgm-format-option ${formats.pptx ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={formats.pptx}
                  onChange={(e) => setFormats(f => ({ ...f, pptx: e.target.checked }))}
                />
                <div>
                  <div className="rgm-format-label"><FileSpreadsheet size={14} style={{ display: 'inline', marginRight: 4 }} />PowerPoint</div>
                  <div className="rgm-format-desc">Présentation réunion de clôture</div>
                </div>
              </label>
            </div>
          </div>

          {/* === STEP 3: Recommendations editor === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">3</span>
              Recommandations <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)' }}>(LEAN / ITIL)</span>
            </div>
            <div className="rgm-reco-list">
              {recommendations.map((reco) => (
                <div key={reco.id} className="rgm-reco-item">
                  <div className="rgm-reco-inputs">
                    <div className="rgm-reco-row">
                      <input
                        className="rgm-reco-cat"
                        value={reco.category}
                        onChange={(e) => updateReco(reco.id, 'category', e.target.value)}
                        placeholder="Catégorie..."
                      />
                      <select
                        className="rgm-reco-priority"
                        value={reco.type || 'Action corrective'}
                        onChange={(e) => updateReco(reco.id, 'type', e.target.value)}
                        title="Type / Statut"
                      >
                        <option value="Opportunité">Opportunité</option>
                        <option value="Action corrective">Action corrective</option>
                        <option value="Amélioration">Amélioration</option>
                        <option value="Risque">Risque</option>
                        <option value="Information">Information</option>
                      </select>
                      <select
                        className="rgm-reco-priority"
                        value={reco.priority}
                        onChange={(e) => updateReco(reco.id, 'priority', e.target.value)}
                        title="Priorité"
                      >
                        <option value="Haute">Haute</option>
                        <option value="Moyenne">Moyenne</option>
                        <option value="Faible">Faible</option>
                      </select>
                    </div>
                    <textarea
                      className="rgm-reco-text"
                      value={reco.text}
                      onChange={(e) => updateReco(reco.id, 'text', e.target.value)}
                      placeholder="Constat et recommandation..."
                      rows={2}
                    />
                  </div>
                  <div className="rgm-reco-actions">
                    <button
                      className="rgm-btn-icon"
                      onClick={() => deleteReco(reco.id)}
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              <button className="rgm-add-btn" onClick={addReco}>
                <Plus size={16} /> Ajouter une recommandation
              </button>
            </div>
          </div>

          {/* === STEP 4: Complément d'information === */}
          <div className="rgm-step">
            <div className="rgm-step-title">
              <span className="rgm-step-num">4</span>
              Complément d'information
              <span style={{ fontWeight: 400, fontSize: '0.8rem', color: 'var(--text-muted, #64748b)', marginLeft: '0.5rem' }}>(optionnel — section 5 du rapport)</span>
            </div>
            <textarea
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
              placeholder="Contexte supplémentaire, observations, notes de campagne, points d'attention particuliers…"
              rows={5}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #e2e8f0)',
                backgroundColor: 'var(--bg-color, #f8fafc)',
                color: 'var(--text-color, #1e293b)',
                fontSize: '0.9rem',
                lineHeight: '1.6',
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #94a3b8)', marginTop: '0.35rem' }}>
              {complement.length > 0 ? `${complement.length} caractères` : 'Laissez vide pour ne pas inclure cette section dans le rapport.'}
            </div>
          </div>

          {/* === Generation progress / results === */}
          {generating && (
            <div className="rgm-progress">
              <Activity size={36} className="spinner" color="#3b82f6" />
              <p style={{ color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                Collecte des données et génération en cours...
              </p>
            </div>
          )}

          {error && (
            <div style={{ padding: '0.75rem', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: 8, color: '#991b1b', fontSize: '0.85rem', marginBottom: '1rem' }}>
              <strong>Erreur :</strong> {error}
            </div>
          )}

          {generated && (
            <div>
              <div className="rgm-success">
                <CheckSquare size={18} style={{ display: 'inline', marginRight: 6 }} />
                Rapport {generated.summary?.milestone} généré — Verdict : <strong>{generated.summary?.verdict}</strong>
                <br />
                <span style={{ fontSize: '0.8rem', fontWeight: 400 }}>
                  {generated.summary?.totalTests} tests | Pass Rate : {generated.summary?.passRate}% | {generated.summary?.failedTests} échecs
                </span>
              </div>
              <div className="rgm-downloads">
                {generated.files?.html && (
                  <button
                    className="rgm-dl-btn"
                    onClick={() => downloadBase64(generated.files.html, generated.files.htmlFilename, 'text/html')}
                  >
                    <Download size={16} /> Télécharger HTML
                  </button>
                )}
                {generated.files?.pptx && (
                  <button
                    className="rgm-dl-btn"
                    onClick={() => downloadBase64(generated.files.pptx, generated.files.pptxFilename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')}
                  >
                    <Download size={16} /> Télécharger PPTX
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {!generated && (
          <div className="rgm-footer">
            <button className="rgm-btn-cancel" onClick={onClose}>Annuler</button>
            <button
              className="rgm-btn-generate"
              onClick={handleGenerate}
              disabled={generating || (!formats.html && !formats.pptx)}
            >
              {generating ? (
                <><Activity size={16} className="spinner" /> Génération...</>
              ) : (
                <><FileText size={16} /> Générer le rapport</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportGeneratorModal;
