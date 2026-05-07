import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StatusChart from '../StatusChart';

vi.mock('react-chartjs-2', () => ({
  Doughnut: ({ data }) => <div data-testid="doughnut-chart">{data.labels.join(',')}</div>,
  Bar: ({ data }) => <div data-testid="bar-chart">{data.labels.join(',')}</div>,
}));

const metrics = {
  statusDistribution: {
    labels: ['Passed', 'Failed', 'WIP'],
    values: [80, 10, 10],
    colors: ['#10B981', '#EF4444', '#F59E0B'],
  },
};

describe('StatusChart', () => {
  it('shows loading when no metrics', () => {
    render(<StatusChart metrics={null} />);
    expect(screen.getByText(/Chargement des graphiques/i)).toBeInTheDocument();
  });

  it('shows loading when no statusDistribution', () => {
    render(<StatusChart metrics={{}} />);
    expect(screen.getByText(/Chargement des graphiques/i)).toBeInTheDocument();
  });

  it('renders doughnut chart by default', () => {
    render(<StatusChart metrics={metrics} />);
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
  });

  it('renders bar chart when chartType=bar', () => {
    render(<StatusChart metrics={metrics} chartType="bar" />);
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('does not render bar when chartType=doughnut', () => {
    render(<StatusChart metrics={metrics} chartType="doughnut" />);
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('renders status labels in chart', () => {
    render(<StatusChart metrics={metrics} />);
    expect(screen.getByTestId('doughnut-chart').textContent).toContain('Passed');
    expect(screen.getByTestId('doughnut-chart').textContent).toContain('Failed');
  });

  it('renders status items list', () => {
    render(<StatusChart metrics={metrics} />);
    expect(screen.getByText('Passed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('WIP')).toBeInTheDocument();
  });

  it('shows values for each status', () => {
    render(<StatusChart metrics={metrics} />);
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getAllByText('10').length).toBeGreaterThan(0);
  });

  it('shows details title in business mode', () => {
    render(<StatusChart metrics={metrics} useBusiness={true} />);
    expect(screen.getByText(/Détails par Statut/i)).toBeInTheDocument();
  });
});
