import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard6 from '../Dashboard6';
import apiService from '../../services/api.service';

vi.mock('../../services/api.service', () => ({
  default: {
    getSyncProjects: vi.fn(),
    getSyncHistory: vi.fn(),
    getSyncStatuses: vi.fn(),
    getSyncFieldValues: vi.fn(),
    getSyncIterations: vi.fn(),
    previewSync: vi.fn(),
    executeSync: vi.fn(),
    syncStatusToGitLab: vi.fn(),
  },
}));

vi.mock('../RunActionPanel', () => ({
  default: () => <div data-testid="run-action-panel" />,
}));

// Dashboard6 imports a CSS file — handled by Vitest's jsdom (no-op for CSS)

const projects = [{ id: 'neo-pilot', label: 'Neo-Pilot', configured: true }];
const history = [
  {
    id: 1,
    executed_at: '2026-05-01T10:00:00Z',
    project_name: 'Neo-Pilot',
    iteration_name: 'R14',
    mode: 'execute',
    created: 5,
    updated: 1,
    skipped: 2,
    errors: 0,
    total_issues: 8,
  },
];

describe('Dashboard6 — Synchronisation GitLab → Testmo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getSyncProjects.mockResolvedValue(projects);
    apiService.getSyncHistory.mockResolvedValue(history);
    apiService.getSyncStatuses.mockResolvedValue([]);
    apiService.getSyncFieldValues.mockResolvedValue([]);
    apiService.getSyncIterations.mockResolvedValue([]);
  });

  it('rend sans erreur au chargement initial', async () => {
    render(<Dashboard6 isDark={false} />);
    // The title is always rendered synchronously
    expect(screen.getByText(/SYNCHRONISATION GITLAB/i)).toBeInTheDocument();
  });

  it("appelle getSyncProjects et getSyncHistory au montage", async () => {
    render(<Dashboard6 isDark={false} />);
    await waitFor(() => {
      expect(apiService.getSyncProjects).toHaveBeenCalledTimes(1);
      expect(apiService.getSyncHistory).toHaveBeenCalledTimes(1);
    });
  });

  it("peuple le sélecteur de projet avec les noms de projets", async () => {
    render(<Dashboard6 isDark={false} />);
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      const neo = options.find(o => o.textContent.includes('Neo-Pilot'));
      expect(neo).toBeTruthy();
    });
  });

  it("affiche les entrées de l'historique après chargement", async () => {
    render(<Dashboard6 isDark={false} />);
    await waitFor(() =>
      expect(screen.getByText('R14')).toBeInTheDocument()
    );
    // "Neo-Pilot" appears in both the project selector option and the history table
    expect(screen.getAllByText('Neo-Pilot').length).toBeGreaterThanOrEqual(1);
  });

  it("affiche l'état vide quand les APIs retournent des tableaux vides", async () => {
    apiService.getSyncProjects.mockResolvedValue([]);
    apiService.getSyncHistory.mockResolvedValue([]);
    render(<Dashboard6 isDark={false} />);
    await waitFor(() =>
      expect(
        screen.getByText(/Aucun historique disponible/i)
      ).toBeInTheDocument()
    );
  });
});
