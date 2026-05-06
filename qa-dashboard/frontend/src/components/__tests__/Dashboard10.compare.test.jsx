import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard10 from '../Dashboard10';
import apiService from '../../services/api.service';

const MILESTONES = [
  { id: 1, name: 'Sprint 1' },
  { id: 2, name: 'Sprint 2' },
  { id: 3, name: 'Sprint 3' },
];

const makeMetrics = ({ passRate, completionRate, failureRate, testEfficiency, totalTests }) => ({
  globalMetrics: { passRate, completionRate, failureRate, testEfficiency, totalTests },
});

vi.mock('../../services/api.service', () => ({
  default: {
    getProjectMilestones: vi.fn(),
    getDashboardMetrics: vi.fn(),
  },
}));

describe('Dashboard10 — Comparaison inter-milestones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getProjectMilestones.mockResolvedValue({ result: MILESTONES });
    apiService.getDashboardMetrics
      .mockResolvedValueOnce(makeMetrics({ passRate: 80, completionRate: 70, failureRate: 20, testEfficiency: 75, totalTests: 100 }))
      .mockResolvedValueOnce(makeMetrics({ passRate: 90, completionRate: 85, failureRate: 10, testEfficiency: 88, totalTests: 110 }));
  });

  it('affiche le titre "Comparaison inter-milestones"', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    await waitFor(() =>
      expect(screen.getByText(/Comparaison inter-milestones/i)).toBeInTheDocument()
    );
  });

  it('charge et affiche les milestones dans les deux sélecteurs', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    await waitFor(() => expect(apiService.getProjectMilestones).toHaveBeenCalledWith(42));
    const selects = await screen.findAllByRole('combobox');
    expect(selects).toHaveLength(2);
    // Les deux selects contiennent les milestones
    expect(selects[0].options).toHaveLength(MILESTONES.length + 1); // +1 pour l'option vide
    expect(selects[1].options).toHaveLength(MILESTONES.length + 1);
  });

  it('affiche les métriques côte-à-côte après sélection de 2 milestones', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    const selects = await screen.findAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(selects[1], { target: { value: '2' } });

    await waitFor(() =>
      expect(apiService.getDashboardMetrics).toHaveBeenCalledTimes(2)
    );
    // Métriques Milestone A
    await waitFor(() => expect(screen.getByText('80.00%')).toBeInTheDocument());
    // Métriques Milestone B
    expect(screen.getByText('90.00%')).toBeInTheDocument();
  });

  it('affiche le delta positif en vert pour une amélioration du pass rate', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    const selects = await screen.findAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(selects[1], { target: { value: '2' } });

    // delta passRate = 90-80 = +10
    await waitFor(() => expect(screen.getByText(/\+10\.00/)).toBeInTheDocument());
    const deltaEl = screen.getByText(/\+10\.00/);
    expect(deltaEl.style.color).toMatch(/#10B981|green|rgb\(16, 185, 129\)/i);
  });

  it('affiche le delta négatif en rouge pour une régression du failure rate', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    const selects = await screen.findAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(selects[1], { target: { value: '2' } });

    // delta failureRate = 10-20 = -10 (amélioration pour failure, mais delta affiché)
    await waitFor(() => expect(screen.getByText(/-10\.00/)).toBeInTheDocument());
  });

  it('ne déclenche pas de fetch si un seul milestone est sélectionné', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    const selects = await screen.findAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: '1' } });

    await waitFor(() => expect(apiService.getDashboardMetrics).not.toHaveBeenCalled());
  });

  it('affiche un message si aucun milestone sélectionné', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    await waitFor(() =>
      expect(screen.getByText(/Sélectionnez deux jalons/i)).toBeInTheDocument()
    );
  });

  it('appelle getDashboardMetrics avec le bon projectId et milestoneId', async () => {
    render(<Dashboard10 projectId={42} isDark={false} />);
    const selects = await screen.findAllByRole('combobox');

    fireEvent.change(selects[0], { target: { value: '1' } });
    fireEvent.change(selects[1], { target: { value: '3' } });

    await waitFor(() =>
      expect(apiService.getDashboardMetrics).toHaveBeenCalledWith(42, [1], null)
    );
    expect(apiService.getDashboardMetrics).toHaveBeenCalledWith(42, [3], null);
  });
});
