/**
 * ================================================
 * DASHBOARD 8 — Auto-Sync Control Panel
 * ================================================
 * State container. UI split across:
 *   D8ConfigForm    — formulaire config run actif
 *   D8AlertsSection — alertes Slack
 *
 * Flow: idle ↔ live sync / dry-run (SSE)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock, Play, Eye, Save, RefreshCw,
  CheckCircle2, XCircle, AlertCircle,
  ToggleLeft, ToggleRight, Terminal, Zap,
} from 'lucide-react';
import apiService from '../services/api.service';
import D8ConfigForm from './D8ConfigForm';
import D8AlertsSection from './D8AlertsSection';
import '../styles/Dashboard8.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function StatusBadge({ enabled }) {
  return enabled
    ? <span className="d8-badge d8-badge--on"><CheckCircle2 size={13} /> Actif</span>
    : <span className="d8-badge d8-badge--off"><XCircle size={13} /> Inactif</span>;
}

function LogLine({ entry }) {
  const cls = {
    info:           'd8-log-info',
    warn:           'd8-log-warn',
    error:          'd8-log-error',
    updated:        'd8-log-updated',
    'would-update': 'd8-log-would',
    skip:           'd8-log-skip',
    done:           'd8-log-done',
  }[entry.type] || 'd8-log-info';

  let text = '';
  if (entry.message)           text = entry.message;
  else if (entry.type === 'updated')
    text = `✓ #${entry.issueIid} "${entry.caseName}" → status:${entry.newStatus}`;
  else if (entry.type === 'would-update')
    text = `[DRY] #${entry.issueIid} "${entry.caseName}" : ${entry.currentStatus || '∅'} → ${entry.newStatus}`;
  else if (entry.type === 'skip')
    text = `⊘ "${entry.caseName}" — ${entry.reason}`;
  else if (entry.type === 'error')
    text = `✗ #${entry.issueIid} "${entry.caseName}": ${entry.error}`;
  else if (entry.type === 'done')
    text = `Terminé — updated=${entry.updated} skipped=${entry.skipped} errors=${entry.errors} total=${entry.total}`;
  else text = JSON.stringify(entry);

  return <div className={`d8-log-line ${cls}`}>{text}</div>;
}

export default function Dashboard8({ isDark }) {
  const [config, setConfig]         = useState(null);
  const [form, setForm]             = useState({ runId: '', iterationName: '', gitlabProjectId: '', version: '' });
  const [saveStatus, setSaveStatus] = useState(null);
  const [loadError, setLoadError]   = useState(null);
  const [logs, setLogs]             = useState([]);
  const [running, setRunning]       = useState(false);
  const [runMode, setRunMode]       = useState(null);
  const logEndRef = useRef(null);
  const abortRef  = useRef(null);

  const [alertsCfg, setAlertsCfg]              = useState(null);
  const [alertsForm, setAlertsForm]            = useState(null);
  const [alertsSaveStatus, setAlertsSaveStatus] = useState(null);
  const [alertsTestStatus, setAlertsTestStatus] = useState(null);
  const [showWebhook, setShowWebhook]          = useState(false);
  const [alertsOpen, setAlertsOpen]            = useState(false);

  const loadConfig = useCallback(async () => {
    try {
      setLoadError(null);
      const data = await apiService.getAutoSyncConfig();
      setConfig(data);
      setForm({
        runId:           String(data.runId ?? ''),
        iterationName:   data.iterationName ?? '',
        gitlabProjectId: String(data.gitlabProjectId ?? ''),
        version:         data.version ?? '',
      });
    } catch (err) {
      setLoadError('Impossible de charger la config : ' + err.message);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(() => {
    apiService.getAlertsConfig()
      .then(cfg => { setAlertsCfg(cfg); setAlertsForm(cfg); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const patch = {
        runId:           parseInt(form.runId),
        iterationName:   form.iterationName.trim(),
        gitlabProjectId: form.gitlabProjectId.trim(),
        version:         form.version.trim() || undefined,
      };
      if (!patch.runId || !patch.iterationName || !patch.gitlabProjectId) {
        setSaveStatus('error');
        return;
      }
      const updated = await apiService.updateAutoSyncConfig(patch);
      setConfig(updated);
      setSaveStatus('ok');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleToggleEnabled = async () => {
    try {
      const updated = await apiService.updateAutoSyncConfig({ enabled: !config.enabled });
      setConfig(updated);
    } catch { /* non-critical */ }
  };

  const handleRun = async (dryRun = false) => {
    if (running) return;
    setLogs([]);
    setRunning(true);
    setRunMode(dryRun ? 'dryrun' : 'live');

    const pushLog = entry => setLogs(prev => [...prev, entry]);
    const { runId, iterationName, gitlabProjectId, version } = config;

    if (!runId || !iterationName || !gitlabProjectId) {
      pushLog({ type: 'error', message: "Config incomplète — sauvegardez d'abord les paramètres." });
      setRunning(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/sync/status-to-gitlab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, iterationName, gitlabProjectId, dryRun, version: version || undefined }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        pushLog({ type: 'error', message: err.error || 'Erreur HTTP ' + res.status });
        setRunning(false);
        return;
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try { pushLog(JSON.parse(line.slice(6))); } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        pushLog({ type: 'error', message: 'Erreur connexion SSE : ' + err.message });
      }
    } finally {
      setRunning(false);
      setRunMode(null);
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
    setRunning(false);
    setRunMode(null);
  };

  const nextCronInfo = () => {
    const now = new Date();
    const day = now.getDay();
    const h   = now.getHours();
    const m   = now.getMinutes();
    if (day >= 1 && day <= 5 && h >= 8 && h < 18) {
      const nextMin = m - (m % 5) + 5;
      if (nextMin < 60) return `Aujourd'hui à ${h}h${String(nextMin).padStart(2, '0')}`;
      return `Aujourd'hui à ${h + 1}h00`;
    }
    return 'Lun-Ven entre 8h et 18h';
  };

  const handleAlertsSave = async () => {
    setAlertsSaveStatus('saving');
    try {
      const updated = await apiService.updateAlertsConfig(alertsForm);
      setAlertsCfg(updated);
      setAlertsForm(updated);
      setAlertsSaveStatus('ok');
      setTimeout(() => setAlertsSaveStatus(null), 3000);
    } catch {
      setAlertsSaveStatus('error');
    }
  };

  const handleAlertsTest = async () => {
    setAlertsTestStatus('testing');
    try {
      const result = await apiService.testSlackAlert();
      setAlertsTestStatus(result.ok ? 'ok' : 'error');
      setTimeout(() => setAlertsTestStatus(null), 4000);
    } catch {
      setAlertsTestStatus('error');
    }
  };

  if (loadError) {
    return (
      <div className={`d8-root ${isDark ? 'dark' : ''}`}>
        <div className="d8-error-banner">
          <AlertCircle size={18} /> {loadError}
          <button className="d8-btn-ghost" onClick={loadConfig}>Réessayer</button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`d8-root ${isDark ? 'dark' : ''}`}>
        <div className="d8-loading"><RefreshCw size={24} className="spinning" /> Chargement…</div>
      </div>
    );
  }

  return (
    <div className={`d8-root ${isDark ? 'dark' : ''}`}>

      <div className="d8-header">
        <div className="d8-header-title">
          <Zap size={22} className="d8-header-icon" />
          <h2>Auto-Sync Testmo → GitLab</h2>
        </div>
        <p className="d8-header-sub">
          Synchronisation automatique des statuts et commentaires — cron lun-ven 8h-18h toutes les 5 min
        </p>
      </div>

      <div className="d8-grid">

        {/* ── Statut cron ── */}
        <div className="d8-card d8-card--status">
          <div className="d8-card-title"><Clock size={16} /> Statut du cron</div>

          <div className="d8-status-row">
            <span>État</span>
            <StatusBadge enabled={config.enabled} />
          </div>
          <div className="d8-status-row">
            <span>Prochaine exécution</span>
            <span className="d8-value">{config.enabled ? nextCronInfo() : '—'}</span>
          </div>
          <div className="d8-status-row">
            <span>Dernière mise à jour config</span>
            <span className="d8-value">
              {config.updatedAt
                ? new Date(config.updatedAt).toLocaleString('fr-FR')
                : 'Valeurs initiales (.env)'}
            </span>
          </div>

          <button
            className={`d8-btn-toggle ${config.enabled ? 'd8-btn-toggle--on' : 'd8-btn-toggle--off'}`}
            onClick={handleToggleEnabled}
          >
            {config.enabled
              ? <><ToggleRight size={18} /> Désactiver le cron</>
              : <><ToggleLeft  size={18} /> Activer le cron</>}
          </button>
        </div>

        {/* ── Config form ── */}
        <D8ConfigForm
          config={config}
          form={form}
          setForm={setForm}
          saveStatus={saveStatus}
          onSave={handleSave}
        />

        {/* ── Déclenchement manuel ── */}
        <div className="d8-card d8-card--run">
          <div className="d8-card-title"><Terminal size={16} /> Déclenchement manuel</div>

          <div className="d8-run-actions">
            <button
              className="d8-btn-primary"
              onClick={() => handleRun(false)}
              disabled={running}
            >
              {running && runMode === 'live'
                ? <><RefreshCw size={14} className="spinning" /> Sync en cours…</>
                : <><Play size={14} /> Lancer la sync</>}
            </button>

            <button
              className="d8-btn-secondary"
              onClick={() => handleRun(true)}
              disabled={running}
            >
              {running && runMode === 'dryrun'
                ? <><RefreshCw size={14} className="spinning" /> Dry-run…</>
                : <><Eye size={14} /> Dry-run (preview)</>}
            </button>

            {running && (
              <button className="d8-btn-danger" onClick={handleStop}>
                <XCircle size={14} /> Arrêter
              </button>
            )}
          </div>

          <p className="d8-run-hint">
            Le <strong>dry-run</strong> affiche ce qui serait fait sans modifier GitLab.
          </p>

          {logs.length > 0 && (
            <div className="d8-log-container">
              {logs.map((entry, i) => <LogLine key={i} entry={entry} />)}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* ── Alertes Slack ── */}
        <D8AlertsSection
          alertsForm={alertsForm}
          setAlertsForm={setAlertsForm}
          alertsSaveStatus={alertsSaveStatus}
          alertsTestStatus={alertsTestStatus}
          showWebhook={showWebhook}
          setShowWebhook={setShowWebhook}
          alertsOpen={alertsOpen}
          setAlertsOpen={setAlertsOpen}
          onSave={handleAlertsSave}
          onTest={handleAlertsTest}
        />

      </div>
    </div>
  );
}
