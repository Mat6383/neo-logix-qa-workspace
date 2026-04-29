import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import MetricsCards from '../MetricsCards';

const mockMetrics = {
  completionRate: 92,
  passRate: 97,
  failureRate: 3,
  testEfficiency: 97,
  raw: { completed: 92, total: 100, passed: 89, failed: 3, blocked: 0, skipped: 0 },
  slaStatus: { ok: true, alerts: [] },
};

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('MetricsCards', () => {
  it('renders without crashing with valid metrics', () => {
    expect(() =>
      render(<MetricsCards metrics={mockMetrics} useBusiness={false} />, { wrapper })
    ).not.toThrow();
  });

  it('renders loading state when metrics is null', () => {
    render(<MetricsCards metrics={null} useBusiness={false} />, { wrapper });
    expect(screen.getByText('Chargement des métriques...')).toBeInTheDocument();
  });

  it('displays ISTQB metric labels in English when useBusiness=false', () => {
    render(<MetricsCards metrics={mockMetrics} useBusiness={false} />, { wrapper });
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('Pass Rate')).toBeInTheDocument();
  });

  it('displays business labels in French when useBusiness=true', () => {
    render(<MetricsCards metrics={mockMetrics} useBusiness={true} />, { wrapper });
    expect(screen.getByText("Taux d'Exécution")).toBeInTheDocument();
    expect(screen.getByText('Taux de Succès')).toBeInTheDocument();
  });

  it('displays correct percentage values', () => {
    render(<MetricsCards metrics={mockMetrics} useBusiness={false} />, { wrapper });
    expect(screen.getByText('92%')).toBeInTheDocument();
    // 97% apparaît deux fois (passRate + testEfficiency) — getAllByText vérifie la présence
    expect(screen.getAllByText('97%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('3%')).toBeInTheDocument();
  });
});
