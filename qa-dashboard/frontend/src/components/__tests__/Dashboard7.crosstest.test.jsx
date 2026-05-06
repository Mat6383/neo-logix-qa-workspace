import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard7 from '../Dashboard7';
import apiService from '../../services/api.service';

vi.mock('../../services/api.service', () => ({
  default: {
    getCrosstestIterations: vi.fn(),
    getCrosstestComments: vi.fn(),
    getCrosstestIssues: vi.fn(),
    saveCrosstestComment: vi.fn(),
    deleteCrosstestComment: vi.fn(),
  },
}));

// useToast is consumed via React context — mock the hook directly
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const iterations = [
  { id: 10, title: 'R14 - Sprint 1', state: 'active' },
  { id: 11, title: 'R14 - Sprint 2', state: 'closed' },
];
const comments = {};
const issues = [
  {
    iid: 42,
    title: 'Bug login',
    url: 'https://gitlab.com/issues/42',
    labels: ['CrossTest::OK'],
    assignees: [],
    state: 'open',
  },
];

describe('Dashboard7 — CrossTest OK Tickets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getCrosstestIterations.mockResolvedValue(iterations);
    apiService.getCrosstestComments.mockResolvedValue(comments);
    apiService.getCrosstestIssues.mockResolvedValue(issues);
  });

  it("affiche le spinner de chargement au montage", () => {
    // Keep promises pending so loading state stays
    apiService.getCrosstestIterations.mockReturnValue(new Promise(() => {}));
    apiService.getCrosstestComments.mockReturnValue(new Promise(() => {}));
    render(<Dashboard7 isDark={false} />);
    expect(screen.getByText(/Chargement/i)).toBeInTheDocument();
  });

  it("appelle getCrosstestIterations au montage", async () => {
    render(<Dashboard7 isDark={false} />);
    await waitFor(() =>
      expect(apiService.getCrosstestIterations).toHaveBeenCalledTimes(1)
    );
  });

  it("peuple le sélecteur d'itérations avec les données chargées", async () => {
    render(<Dashboard7 isDark={false} />);
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      const sprint1 = options.find(o => o.textContent.includes('R14 - Sprint 1'));
      expect(sprint1).toBeTruthy();
    });
  });

  it("appelle getCrosstestIssues quand une itération est sélectionnée", async () => {
    render(<Dashboard7 isDark={false} />);
    // First iteration is auto-selected, so getCrosstestIssues is called immediately
    await waitFor(() =>
      expect(apiService.getCrosstestIssues).toHaveBeenCalledWith(10)
    );
    // Change to second iteration
    const select = await screen.findByRole('combobox');
    fireEvent.change(select, { target: { value: '11' } });
    await waitFor(() =>
      expect(apiService.getCrosstestIssues).toHaveBeenCalledWith(11)
    );
  });

  it("affiche les issues après sélection et fetch", async () => {
    render(<Dashboard7 isDark={false} />);
    await waitFor(() =>
      expect(screen.getByText('Bug login')).toBeInTheDocument()
    );
  });

  it("affiche l'état vide quand il n'y a pas d'issues", async () => {
    apiService.getCrosstestIssues.mockResolvedValue([]);
    render(<Dashboard7 isDark={false} />);
    await waitFor(() =>
      expect(screen.getByText(/Aucun ticket trouvé/i)).toBeInTheDocument()
    );
  });
});
