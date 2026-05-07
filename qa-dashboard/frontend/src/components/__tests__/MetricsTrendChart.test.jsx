import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MetricsTrendChart from '../MetricsTrendChart';
import apiService from '../../services/api.service';

vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart" />,
}));

vi.mock('../../services/api.service', () => ({
  default: { getMetricsHistory: vi.fn() },
}));

const snapshots = [
  { snapshot_date: '2026-04-01', pass_rate: 88, completion_rate: 90, test_efficiency: 80 },
  { snapshot_date: '2026-05-01', pass_rate: 92, completion_rate: 93, test_efficiency: 85 },
];

describe('MetricsTrendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading initially', () => {
    apiService.getMetricsHistory.mockReturnValue(new Promise(() => {}));
    render(<MetricsTrendChart projectId={1} />);
    expect(screen.getByText(/Chargement de l'historique/i)).toBeInTheDocument();
  });

  it('shows error on failure', async () => {
    apiService.getMetricsHistory.mockRejectedValue(new Error('network'));
    render(<MetricsTrendChart projectId={1} />);
    await waitFor(() =>
      expect(screen.getByText(/Impossible de charger/i)).toBeInTheDocument()
    );
  });

  it('shows empty message when no snapshots', async () => {
    apiService.getMetricsHistory.mockResolvedValue({ data: [] });
    render(<MetricsTrendChart projectId={1} />);
    await waitFor(() =>
      expect(screen.getByText(/Aucun historique disponible/i)).toBeInTheDocument()
    );
  });

  it('shows single snapshot message', async () => {
    apiService.getMetricsHistory.mockResolvedValue({ data: [snapshots[0]] });
    render(<MetricsTrendChart projectId={1} />);
    await waitFor(() =>
      expect(screen.getByText(/Un seul snapshot disponible/i)).toBeInTheDocument()
    );
  });

  it('renders chart with 2+ snapshots', async () => {
    apiService.getMetricsHistory.mockResolvedValue({ data: snapshots });
    render(<MetricsTrendChart projectId={1} />);
    await waitFor(() =>
      expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    );
  });

  it('shows snapshot count in header', async () => {
    apiService.getMetricsHistory.mockResolvedValue({ data: snapshots });
    render(<MetricsTrendChart projectId={1} />);
    await waitFor(() =>
      expect(screen.getByText(/2 snapshots/i)).toBeInTheDocument()
    );
  });

  it('calls getMetricsHistory with projectId and limit', async () => {
    apiService.getMetricsHistory.mockResolvedValue({ data: snapshots });
    render(<MetricsTrendChart projectId={42} limit={15} />);
    await waitFor(() => expect(apiService.getMetricsHistory).toHaveBeenCalledWith(42, 15));
  });

  it('does not call API when no projectId', () => {
    render(<MetricsTrendChart projectId={null} />);
    expect(apiService.getMetricsHistory).not.toHaveBeenCalled();
  });

  it('refresh button reloads data', async () => {
    apiService.getMetricsHistory.mockResolvedValue({ data: snapshots });
    render(<MetricsTrendChart projectId={1} />);
    await waitFor(() => expect(screen.getByTestId('line-chart')).toBeInTheDocument());

    fireEvent.click(screen.getByTitle('Rafraîchir'));
    expect(apiService.getMetricsHistory).toHaveBeenCalledTimes(2);
  });
});
