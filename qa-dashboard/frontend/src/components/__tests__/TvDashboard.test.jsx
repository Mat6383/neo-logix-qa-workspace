import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TvDashboard from '../TvDashboard';

const baseMetrics = {
  passRate: 96,
  lean: { wipTotal: 5, activeRuns: 3 },
  itil: { changeFailRate: 5, mttr: 24 },
  istqb: {
    avgPassRate: 96,
    passRateTarget: 95,
    milestonesCompleted: 8,
    milestonesTotal: 10,
  },
};

describe('TvDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading when no metrics', () => {
    render(<TvDashboard metrics={null} project={null} />);
    expect(screen.getByText(/Chargement des données TV/i)).toBeInTheDocument();
  });

  it('renders project name', () => {
    render(<TvDashboard metrics={baseMetrics} project={{ name: 'Neo-Pilot' }} />);
    expect(screen.getByText('Neo-Pilot')).toBeInTheDocument();
  });

  it('shows OK state when pass rate >= 90 and no critical indicators', () => {
    render(<TvDashboard metrics={baseMetrics} project={{ name: 'Neo-Pilot' }} />);
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
  });

  it('shows WARNING when pass rate is between 80 and 90', () => {
    const metrics = { ...baseMetrics, passRate: 85, istqb: { ...baseMetrics.istqb, avgPassRate: 85 } };
    render(<TvDashboard metrics={metrics} project={{ name: 'Neo-Pilot' }} />);
    expect(screen.getAllByText('ATTENTION').length).toBeGreaterThan(0);
  });

  it('shows CRITICAL when pass rate < 80', () => {
    const metrics = { ...baseMetrics, passRate: 75, istqb: { ...baseMetrics.istqb, avgPassRate: 75 } };
    render(<TvDashboard metrics={metrics} project={{ name: 'Neo-Pilot' }} />);
    expect(screen.getByText('CRITIQUE')).toBeInTheDocument();
  });

  it('shows CRITICAL when wipTotal > 20', () => {
    const metrics = { ...baseMetrics, lean: { ...baseMetrics.lean, wipTotal: 25 } };
    render(<TvDashboard metrics={metrics} project={{ name: 'Neo-Pilot' }} />);
    expect(screen.getByText('CRITIQUE')).toBeInTheDocument();
  });

  it('applies dark theme class', () => {
    const { container } = render(<TvDashboard metrics={baseMetrics} project={{ name: 'N' }} isDark={true} />);
    expect(container.querySelector('.tv-dashboard.tv-dark-theme')).toBeInTheDocument();
  });

  it('shows ÉTAT GLOBAL QA label', () => {
    render(<TvDashboard metrics={baseMetrics} project={{ name: 'N' }} />);
    expect(screen.getByText(/ÉTAT GLOBAL QA/i)).toBeInTheDocument();
  });

  it('shows ISTQB section', () => {
    render(<TvDashboard metrics={baseMetrics} project={{ name: 'N' }} />);
    expect(screen.getByText('ISTQB')).toBeInTheDocument();
  });

  it('shows milestone progress', () => {
    render(<TvDashboard metrics={baseMetrics} project={{ name: 'N' }} />);
    expect(screen.getByText('8/10')).toBeInTheDocument();
  });

  it('shows business label for pass rate', () => {
    render(<TvDashboard metrics={baseMetrics} project={{ name: 'N' }} useBusiness={true} />);
    expect(screen.getByText(/Taux Succès Moy/i)).toBeInTheDocument();
  });
});
