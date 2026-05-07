import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import RunsList from '../RunsList';

const makeRun = (overrides = {}) => ({
  id: 1,
  name: 'Run R14',
  passRate: 96,
  completionRate: 92,
  created_at: new Date().toISOString(),
  milestone: 'M1',
  ...overrides,
});

describe('RunsList', () => {
  it('shows empty state when no runs', () => {
    render(<RunsList metrics={{ runs: [], runsCount: 0 }} />);
    expect(screen.getByText(/Aucun run actif/i)).toBeInTheDocument();
  });

  it('shows empty state when metrics null', () => {
    render(<RunsList metrics={null} />);
    expect(screen.getByText(/Aucun run actif/i)).toBeInTheDocument();
  });

  it('renders run name', () => {
    render(<RunsList metrics={{ runs: [makeRun()], runsCount: 1 }} />);
    expect(screen.getByText('Run R14')).toBeInTheDocument();
  });

  it('renders run count in header', () => {
    render(<RunsList metrics={{ runs: [makeRun()], runsCount: 1 }} useBusiness />);
    expect(screen.getByText(/Campagnes Actives \(1\)/i)).toBeInTheDocument();
  });

  it('shows "Runs Actifs" in technical mode', () => {
    render(<RunsList metrics={{ runs: [makeRun()], runsCount: 1 }} useBusiness={false} />);
    expect(screen.getByText(/Runs Actifs \(1\)/i)).toBeInTheDocument();
  });

  it('renders multiple runs', () => {
    const runs = [makeRun({ id: 1, name: 'Run A' }), makeRun({ id: 2, name: 'Run B' })];
    render(<RunsList metrics={{ runs, runsCount: 2 }} />);
    expect(screen.getByText('Run A')).toBeInTheDocument();
    expect(screen.getByText('Run B')).toBeInTheDocument();
  });

  it('shows pass rate percentage', () => {
    render(<RunsList metrics={{ runs: [makeRun({ passRate: 96 })], runsCount: 1 }} />);
    expect(screen.getByText('96%')).toBeInTheDocument();
  });

  it('shows completion rate percentage', () => {
    render(<RunsList metrics={{ runs: [makeRun({ completionRate: 88 })], runsCount: 1 }} />);
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('shows milestone', () => {
    render(<RunsList metrics={{ runs: [makeRun({ milestone: 'Sprint 5' })], runsCount: 1 }} />);
    expect(screen.getByText(/Sprint 5/i)).toBeInTheDocument();
  });
});
