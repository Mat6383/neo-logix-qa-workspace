import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard8 from '../Dashboard8';
import apiService from '../../services/api.service';

vi.mock('../../services/api.service', () => ({
  default: {
    getAutoSyncConfig: vi.fn().mockResolvedValue({
      enabled: false,
      runId: null,
      iterationName: '',
      gitlabProjectId: '',
      version: '',
    }),
    getAlertsConfig: vi.fn().mockResolvedValue({
      enabled: false,
      slack_webhook_url: 'https://hooks.slack.com/services/test',
      cooldown_hours: 4,
      metrics: {
        passRate_critical: true,
        passRate_warning: false,
        completionRate_warning: true,
        blockedRate_warning: true,
      },
    }),
    updateAlertsConfig: vi.fn().mockResolvedValue({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
      metrics: {
        passRate_critical: true,
        passRate_warning: false,
        completionRate_warning: true,
        blockedRate_warning: true,
      },
    }),
    testSlackAlert: vi.fn().mockResolvedValue({ ok: true }),
    updateAutoSyncConfig: vi.fn().mockResolvedValue({ enabled: false }),
  },
}));

describe('Dashboard8 — section Alertes Slack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mock implementations after clearAllMocks
    apiService.getAutoSyncConfig.mockResolvedValue({
      enabled: false,
      runId: null,
      iterationName: '',
      gitlabProjectId: '',
      version: '',
    });
    apiService.getAlertsConfig.mockResolvedValue({
      enabled: false,
      slack_webhook_url: 'https://hooks.slack.com/services/test',
      cooldown_hours: 4,
      metrics: {
        passRate_critical: true,
        passRate_warning: false,
        completionRate_warning: true,
        blockedRate_warning: true,
      },
    });
    apiService.updateAlertsConfig.mockResolvedValue({
      enabled: true,
      slack_webhook_url: 'https://hooks.slack.com/x',
      cooldown_hours: 4,
      metrics: {
        passRate_critical: true,
        passRate_warning: false,
        completionRate_warning: true,
        blockedRate_warning: true,
      },
    });
    apiService.testSlackAlert.mockResolvedValue({ ok: true });
    apiService.updateAutoSyncConfig.mockResolvedValue({ enabled: false });
  });

  it('affiche le titre "Alertes Slack" après chargement', async () => {
    render(<Dashboard8 isDark={false} />);
    await waitFor(() => expect(screen.getByText(/Alertes Slack/i)).toBeInTheDocument());
  });

  it('ouvre la section au clic sur le titre', async () => {
    render(<Dashboard8 isDark={false} />);
    await waitFor(() => screen.getByText(/Alertes Slack/i));
    fireEvent.click(screen.getByText(/Alertes Slack/i).closest('div'));
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/hooks\.slack\.com/i)).toBeInTheDocument()
    );
  });

  it('bouton Tester appelle testSlackAlert et affiche feedback ok', async () => {
    render(<Dashboard8 isDark={false} />);
    await waitFor(() => screen.getByText(/Alertes Slack/i));
    fireEvent.click(screen.getByText(/Alertes Slack/i).closest('div'));
    await waitFor(() => screen.getByText(/Tester la connexion/i));
    fireEvent.click(screen.getByText(/Tester la connexion/i));
    await waitFor(() =>
      expect(screen.getByText(/Message Slack envoyé/i)).toBeInTheDocument()
    );
    expect(apiService.testSlackAlert).toHaveBeenCalledTimes(1);
  });
});
