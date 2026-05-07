import React from 'react';
import {
  Bell, Eye, EyeOff, Save, RefreshCw,
  CheckCircle2, XCircle, ToggleLeft, ToggleRight, Zap,
} from 'lucide-react';

const METRICS = [
  { key: 'passRate_critical',       label: 'Pass Rate critique (< 85%)' },
  { key: 'passRate_warning',        label: 'Pass Rate warning (< 90%)' },
  { key: 'completionRate_warning',  label: 'Completion Rate warning (< 80%)' },
  { key: 'blockedRate_warning',     label: 'Blocked Rate warning (> 5%)' },
];

export default function D8AlertsSection({
  alertsForm,
  setAlertsForm,
  alertsSaveStatus,
  alertsTestStatus,
  showWebhook,
  setShowWebhook,
  alertsOpen,
  setAlertsOpen,
  onSave,
  onTest,
}) {
  if (!alertsForm) return null;

  return (
    <div className="d8-card d8-card--alerts">
      <div
        className="d8-card-title d8-card-title--collapsible"
        onClick={() => setAlertsOpen(o => !o)}
      >
        <Bell size={16} /> Alertes Slack
        <span className="d8-collapse-arrow">{alertsOpen ? '▲' : '▼'}</span>
      </div>

      {alertsOpen && (
        <div className="d8-alerts-body">
          <div className="d8-field">
            <label>Notifications</label>
            <button
              className={`d8-toggle ${alertsForm.enabled ? 'd8-toggle--on' : ''}`}
              onClick={() => setAlertsForm(f => ({ ...f, enabled: !f.enabled }))}
            >
              {alertsForm.enabled
                ? <><ToggleRight size={18} /> Activé</>
                : <><ToggleLeft  size={18} /> Désactivé</>}
            </button>
          </div>

          <div className="d8-field">
            <label>Webhook URL</label>
            <div className="d8-input-row">
              <input
                type={showWebhook ? 'text' : 'password'}
                className="d8-input"
                placeholder="https://hooks.slack.com/services/..."
                value={alertsForm.slack_webhook_url}
                onChange={e => setAlertsForm(f => ({ ...f, slack_webhook_url: e.target.value }))}
                disabled={!alertsForm.enabled}
              />
              <button className="d8-btn-icon" onClick={() => setShowWebhook(v => !v)}>
                {showWebhook ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div className="d8-field">
            <label>Cooldown (heures)</label>
            <input
              type="number"
              className="d8-input d8-input--small"
              min={1}
              max={168}
              value={alertsForm.cooldown_hours}
              onChange={e => setAlertsForm(f => ({ ...f, cooldown_hours: Number(e.target.value) }))}
              disabled={!alertsForm.enabled}
            />
          </div>

          <div className="d8-field">
            <label>Métriques surveillées</label>
            <div className="d8-checkboxes">
              {METRICS.map(({ key, label }) => (
                <label key={key} className="d8-checkbox-label">
                  <input
                    type="checkbox"
                    checked={alertsForm.metrics[key]}
                    onChange={e => setAlertsForm(f => ({
                      ...f,
                      metrics: { ...f.metrics, [key]: e.target.checked },
                    }))}
                    disabled={!alertsForm.enabled}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="d8-alerts-actions">
            <button
              className="d8-btn-primary"
              onClick={onSave}
              disabled={alertsSaveStatus === 'saving'}
            >
              {alertsSaveStatus === 'saving'
                ? <><RefreshCw size={14} className="spinning" /> Sauvegarde…</>
                : <><Save size={14} /> Sauvegarder</>}
            </button>
            <button
              className="d8-btn-secondary"
              onClick={onTest}
              disabled={alertsTestStatus === 'testing' || !alertsForm.slack_webhook_url}
            >
              {alertsTestStatus === 'testing'
                ? <><RefreshCw size={14} className="spinning" /> Test…</>
                : <><Zap size={14} /> Tester la connexion</>}
            </button>
          </div>

          {alertsSaveStatus === 'ok' && (
            <p className="d8-feedback d8-feedback--ok"><CheckCircle2 size={13} /> Config sauvegardée</p>
          )}
          {alertsSaveStatus === 'error' && (
            <p className="d8-feedback d8-feedback--error"><XCircle size={13} /> Erreur lors de la sauvegarde</p>
          )}
          {alertsTestStatus === 'ok' && (
            <p className="d8-feedback d8-feedback--ok"><CheckCircle2 size={13} /> Message Slack envoyé ✅</p>
          )}
          {alertsTestStatus === 'error' && (
            <p className="d8-feedback d8-feedback--error"><XCircle size={13} /> Échec — vérifier le webhook URL</p>
          )}
        </div>
      )}
    </div>
  );
}
