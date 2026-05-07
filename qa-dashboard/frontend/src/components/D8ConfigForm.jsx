import React from 'react';
import { Save, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

export default function D8ConfigForm({ config, form, setForm, saveStatus, onSave }) {
  const formDirty =
    String(form.runId)           !== String(config.runId ?? '')           ||
    form.iterationName            !== (config.iterationName ?? '')         ||
    String(form.gitlabProjectId)  !== String(config.gitlabProjectId ?? '') ||
    form.version                  !== (config.version ?? '');

  const handleCancel = () => setForm({
    runId:           String(config.runId ?? ''),
    iterationName:   config.iterationName ?? '',
    gitlabProjectId: String(config.gitlabProjectId ?? ''),
    version:         config.version ?? '',
  });

  return (
    <div className="d8-card d8-card--config">
      <div className="d8-card-title"><Save size={16} /> Configuration du run actif</div>

      <div className="d8-form-group">
        <label>ID du run Testmo</label>
        <input
          type="number"
          className="d8-input"
          value={form.runId}
          placeholder="ex : 279"
          onChange={e => setForm(f => ({ ...f, runId: e.target.value }))}
        />
      </div>

      <div className="d8-form-group">
        <label>Nom de l'itération GitLab</label>
        <input
          type="text"
          className="d8-input"
          value={form.iterationName}
          placeholder="ex : R14 - run 1"
          onChange={e => setForm(f => ({ ...f, iterationName: e.target.value }))}
        />
      </div>

      <div className="d8-form-group">
        <label>ID du projet GitLab</label>
        <input
          type="text"
          className="d8-input"
          value={form.gitlabProjectId}
          placeholder="ex : 63"
          onChange={e => setForm(f => ({ ...f, gitlabProjectId: e.target.value }))}
        />
      </div>

      <div className="d8-form-group">
        <label>Version (champ custom GitLab, optionnel)</label>
        <input
          type="text"
          className="d8-input"
          value={form.version}
          placeholder="ex : 1.2.3"
          onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
        />
      </div>

      <div className="d8-form-actions">
        <button
          className={`d8-btn-primary ${!formDirty ? 'd8-btn--disabled' : ''}`}
          onClick={onSave}
          disabled={!formDirty || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? <><RefreshCw size={14} className="spinning" /> Enregistrement…</>
           : saveStatus === 'ok'   ? <><CheckCircle2 size={14} /> Enregistré !</>
           : saveStatus === 'error'? <><XCircle size={14} /> Erreur — vérifiez les champs</>
           : <><Save size={14} /> Enregistrer</>}
        </button>

        {formDirty && (
          <button className="d8-btn-ghost" onClick={handleCancel}>
            Annuler
          </button>
        )}
      </div>

      <div className="d8-config-summary">
        <div className="d8-summary-row">
          <span>Run actif</span>
          <strong>#{config.runId ?? '—'}</strong>
        </div>
        <div className="d8-summary-row">
          <span>Itération</span>
          <strong>{config.iterationName || '—'}</strong>
        </div>
        <div className="d8-summary-row">
          <span>Projet GitLab</span>
          <strong>#{config.gitlabProjectId || '—'}</strong>
        </div>
        <div className="d8-summary-row">
          <span>Version</span>
          <strong>{config.version || '—'}</strong>
        </div>
      </div>
    </div>
  );
}
