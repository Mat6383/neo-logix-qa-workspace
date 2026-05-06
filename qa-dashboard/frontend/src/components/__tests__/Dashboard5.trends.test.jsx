import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard5 from '../Dashboard5';
import apiService from '../../services/api.service';

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
  Bar: () => <div data-testid="bar-chart" />,
}));

vi.mock('../MetricsTrendChart', () => ({
  default: () => <div data-testid="metrics-trend-chart" />,
}));

vi.mock('../../services/api.service', () => ({
  default: { getAnnualTrends: vi.fn() },
}));

const trendData = [
  { date: '2026-04-01', version: 'R13', passRate: 85, completionRate: 90, failureRate: 15, testEfficiency: 80, escapeRate: 2, detectionRate: 98, bugsInTest: 20, bugsInProd: 2, totalBugs: 22 },
  { date: '2026-05-01', version: 'R14', passRate: 90, completionRate: 95, failureRate: 10, testEfficiency: 88, escapeRate: 3, detectionRate: 97, bugsInTest: 30, bugsInProd: 2, totalBugs: 32 },
];

describe('Dashboard5 — Tendances annuelles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le spinner de chargement au démarrage', () => {
    apiService.getAnnualTrends.mockReturnValue(new Promise(() => {}));
    render(<Dashboard5 projectId={1} isDark={false} useBusiness={true} />);
    expect(screen.getByText(/Analyse des tendances historiques/i)).toBeInTheDocument();
  });

  it("affiche un message d'erreur quand l'API rejette", async () => {
    apiService.getAnnualTrends.mockRejectedValue(new Error('Network error'));
    render(<Dashboard5 projectId={1} isDark={false} useBusiness={true} />);
    await waitFor(() =>
      expect(screen.getByText(/Impossible de charger les tendances annuelles/i)).toBeInTheDocument()
    );
  });

  it('affiche le titre Tendances après un fetch réussi', async () => {
    apiService.getAnnualTrends.mockResolvedValue({ data: trendData });
    render(<Dashboard5 projectId={1} isDark={false} useBusiness={true} />);
    await waitFor(() =>
      expect(screen.getByText(/TENDANCES ANNUELLES DE QUALITÉ/i)).toBeInTheDocument()
    );
  });

  it("appelle getAnnualTrends avec le bon projectId", async () => {
    apiService.getAnnualTrends.mockResolvedValue({ data: trendData });
    render(<Dashboard5 projectId={42} isDark={false} useBusiness={true} />);
    await waitFor(() => expect(apiService.getAnnualTrends).toHaveBeenCalledWith(42));
  });

  it("affiche 0 versions analysées quand le tableau de tendances est vide", async () => {
    apiService.getAnnualTrends.mockResolvedValue({ data: [] });
    render(<Dashboard5 projectId={1} isDark={false} useBusiness={true} />);
    await waitFor(() =>
      expect(screen.getByText(/0 Versions analysées/i)).toBeInTheDocument()
    );
  });
});
