import React, { useState, useCallback } from 'react';
import { PlayCircle, RefreshCw, CheckCircle2, AlertCircle, GitMerge, Plus } from 'lucide-react';
import apiService from '../services/api.service';
import '../styles/RunActionPanel.css';

export default function RunActionPanel({ syncProjectId, iterationName, isDark, onDone }) {
  const [phase, setPhase]                 = useState('idle');
  const [caseIds, setCaseIds]             = useState([]);
  const [runs, setRuns]                   = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [runName, setRunName]             = useState('');
  const [preview, setPreview]             = useState(null);
  const [result, setResult]               = useState(null);
  const [errorMsg, setErrorMsg]           = useState('');

  const defaultRunName = iterationName
    ? `Run — ${iterationName} — ${new Date().toLocaleDateString('fr-FR')}`
    : '';

  const reset = () => {
    setPhase('idle');
    setCaseIds([]);
    setRuns([]);
    setSelectedRunId('');
    setRunName('');
    setPreview(null);
    setResult(null);
    setErrorMsg('');
  };

  const handleStart = useCallback(async () => {
    setErrorMsg('');
    setPhase('loading_cases');
    try {
      const data = await apiService.getFolderCases(syncProjectId, iterationName);
      setCaseIds(data.caseIds);
      setPhase('checking_runs');
      const runsList = await apiService.getProjectRunsList(syncProjectId, true);
      setRuns(runsList);
      setPhase(runsList.length > 0 ? 'run_found' : 'no_run');
      setRunName(defaultRunName);
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  }, [syncProjectId, iterationName, defaultRunName]);

  const handleConfirmCreate = () => setPhase('confirm_create');

  const handleCreate = async () => {
    setPhase('creating');
    try {
      const created = await apiService.createTestRun(syncProjectId, runName, caseIds);
      setResult({ type: 'created', run: created });
      setPhase('done');
      onDone?.({ type: 'created', run: created });
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const handleLoadMergePreview = async () => {
    if (!selectedRunId) return;
    setPhase('loading_preview');
    try {
      const p = await apiService.getRunMergePreview(parseInt(selectedRunId), caseIds);
      setPreview(p);
      setPhase('confirm_merge');
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  const handleMerge = async () => {
    setPhase('merging');
    try {
      const res = await apiService.mergeRunCases(parseInt(selectedRunId), caseIds);
      setResult({ type: 'merged', ...res });
      setPhase('done');
      onDone?.({ type: 'merged', ...res });
    } catch (err) {
      setErrorMsg(err.message);
      setPhase('error');
    }
  };

  if (!syncProjectId || !iterationName) return null;

  const isLoading = ['loading_cases', 'checking_runs', 'loading_preview', 'creating', 'merging'].includes(phase);

  return (
    <div className={`rap-root${isDark ? ' dark' : ''}`}>
      <div className="rap-title">
        <GitMerge size={18} />
        Étape suivante — Gestion du run de test
      </div>

      {phase === 'idle' && (
        <>
          <p className="rap-hint">
            Sync terminée pour <strong>{iterationName}</strong>.
            Créez ou mettez à jour un run Testmo avec les cas synchronisés.
          </p>
          <div className="rap-actions">
            <button className="rap-btn-primary" onClick={handleStart}>
              <PlayCircle size={15} /> Préparer le run
            </button>
          </div>
        </>
      )}

      {isLoading && (
        <p className="rap-hint">
          <RefreshCw size={14} style={{ display: 'inline', animation: 'spin 1s linear infinite' }} />{' '}
          {phase === 'loading_cases'   && 'Récupération des cas Testmo…'}
          {phase === 'checking_runs'   && 'Vérification des runs existants…'}
          {phase === 'loading_preview' && 'Calcul du preview de merge…'}
          {phase === 'creating'        && 'Création du run…'}
          {phase === 'merging'         && 'Mise à jour du run…'}
        </p>
      )}

      {phase === 'no_run' && (
        <>
          <p className="rap-hint">
            Aucun run actif trouvé. <strong>{caseIds.length} cas</strong> prêts à inclure.
          </p>
          <div className="rap-actions">
            <button className="rap-btn-primary" onClick={handleConfirmCreate}>
              <Plus size={15} /> Créer le run de test
            </button>
            <button className="rap-btn-ghost" onClick={reset}>Annuler</button>
          </div>
        </>
      )}

      {phase === 'run_found' && (
        <>
          <p className="rap-hint">
            <strong>{caseIds.length} cas</strong> récupérés.
            Choisissez un run à mettre à jour ou créez-en un nouveau.
          </p>
          <select
            className="rap-run-select"
            value={selectedRunId}
            onChange={e => setSelectedRunId(e.target.value)}
          >
            <option value="">— Sélectionner un run existant —</option>
            {runs.map(r => (
              <option key={r.id} value={r.id}>#{r.id} — {r.name}</option>
            ))}
          </select>
          <div className="rap-actions">
            {selectedRunId && (
              <button className="rap-btn-primary" onClick={handleLoadMergePreview}>
                <GitMerge size={15} /> Mettre à jour ce run
              </button>
            )}
            <button className="rap-btn-secondary" onClick={handleConfirmCreate}>
              <Plus size={15} /> Créer un nouveau run
            </button>
            <button className="rap-btn-ghost" onClick={reset}>Annuler</button>
          </div>
        </>
      )}

      {phase === 'confirm_create' && (
        <div className="rap-modal-overlay">
          <div className="rap-modal">
            <h3>Créer le run de test</h3>
            <input
              className="rap-run-name-input"
              type="text"
              value={runName}
              onChange={e => setRunName(e.target.value)}
              placeholder="Nom du run…"
            />
            <div className="rap-modal-stats">
              <div className="rap-stat-row rap-stat-add">
                <span>Cas à inclure</span><strong>{caseIds.length}</strong>
              </div>
            </div>
            <div className="rap-modal-actions">
              <button
                className="rap-btn-ghost"
                onClick={() => setPhase(runs.length > 0 ? 'run_found' : 'no_run')}
              >
                Annuler
              </button>
              <button
                className="rap-btn-primary"
                onClick={handleCreate}
                disabled={!runName.trim()}
              >
                <Plus size={14} /> Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'confirm_merge' && preview && (
        <div className="rap-modal-overlay">
          <div className="rap-modal">
            <h3>Mise à jour du run #{selectedRunId}</h3>
            <div className="rap-modal-stats">
              <div className="rap-stat-row rap-stat-add">
                <span>Nouveaux cas à ajouter</span>
                <strong>{preview.toAdd.length}</strong>
              </div>
              <div className="rap-stat-row rap-stat-tested">
                <span>Cas déjà testés (préservés)</span>
                <strong>{preview.testedInRun.length}</strong>
              </div>
              <div className="rap-stat-row rap-stat-preserve">
                <span>Cas dans le run, vierges</span>
                <strong>{preview.pristineInRun.length}</strong>
              </div>
              {preview.inRunNotInSync.length > 0 && (
                <div className="rap-stat-row rap-stat-extra">
                  <span>Cas dans le run absents du sync</span>
                  <strong>{preview.inRunNotInSync.length}</strong>
                </div>
              )}
            </div>
            <div className="rap-modal-actions">
              <button className="rap-btn-ghost" onClick={() => setPhase('run_found')}>
                Annuler
              </button>
              <button
                className="rap-btn-primary"
                onClick={handleMerge}
                disabled={preview.toAdd.length === 0}
              >
                <GitMerge size={14} />
                {preview.toAdd.length === 0 ? 'Rien à ajouter' : 'Mettre à jour'}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="rap-success">
          <CheckCircle2 size={16} />
          {result.type === 'created'
            ? `Run #${result.run?.id} créé avec ${caseIds.length} cas.`
            : `Run mis à jour — ${result.added} cas ajoutés, ${result.preserved} préservés.`}
          <button className="rap-btn-ghost" onClick={reset}>Recommencer</button>
        </div>
      )}

      {phase === 'error' && (
        <div className="rap-error">
          <AlertCircle size={16} /> {errorMsg}
          <button className="rap-btn-ghost" onClick={reset}>Réessayer</button>
        </div>
      )}
    </div>
  );
}
