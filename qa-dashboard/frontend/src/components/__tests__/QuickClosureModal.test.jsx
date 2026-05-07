import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import QuickClosureModal from '../QuickClosureModal';

vi.mock('../../services/api.service', () => ({
  default: { getAnnualTrends: vi.fn().mockResolvedValue({ data: [] }) },
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../../utils/docxGenerator', () => ({
  generateQuickClosureDoc: vi.fn().mockResolvedValue(new Blob()),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  metrics: {
    passRate: 90,
    completionRate: 88,
    runs: [{ id: 1, name: 'R14', passRate: 90, created_at: '2026-04-01T00:00:00Z' }],
  },
  project: { id: 1, name: 'neo-pilot' },
};

describe('QuickClosureModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = render(<QuickClosureModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title when open', () => {
    render(<QuickClosureModal {...defaultProps} />);
    expect(screen.getByText(/Quick Clôture ISTQB/i)).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<QuickClosureModal {...defaultProps} />);
    const closeButtons = screen.getAllByRole('button');
    expect(closeButtons.length).toBeGreaterThan(0);
  });

  it('calls onClose when X button clicked', () => {
    const onClose = vi.fn();
    render(<QuickClosureModal {...defaultProps} onClose={onClose} />);
    const xButton = screen.getAllByRole('button').find(b => b.querySelector('svg'));
    fireEvent.click(xButton);
    expect(onClose).toHaveBeenCalled();
  });

  it('renders environment select', () => {
    render(<QuickClosureModal {...defaultProps} />);
    expect(screen.getByDisplayValue('Préprod')).toBeInTheDocument();
  });

  it('renders add bug button', () => {
    render(<QuickClosureModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Ajouter/i })).toBeInTheDocument();
  });
});
