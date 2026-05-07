import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TestClosureModal from '../TestClosureModal';

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({ toDataURL: () => 'data:image/png;base64,abc' }),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    addImage: vi.fn(),
    addPage: vi.fn(),
    save: vi.fn(),
    internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
  })),
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  metrics: {
    passRate: 92,
    completionRate: 90,
    runs: [
      { id: 1, name: 'R14', passRate: 92, isExploratory: false, created_at: '2026-04-01T00:00:00Z' },
    ],
  },
  project: { id: 1, name: 'neo-pilot' },
};

describe('TestClosureModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = render(<TestClosureModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title when open (business mode)', () => {
    render(<TestClosureModal {...defaultProps} useBusiness={true} />);
    expect(screen.getByText(/Bilan de Clôture de Test/i)).toBeInTheDocument();
  });

  it('renders title when open (technical mode)', () => {
    render(<TestClosureModal {...defaultProps} useBusiness={false} />);
    expect(screen.getByText(/Test Summary Report/i)).toBeInTheDocument();
  });

  it('renders close button', () => {
    render(<TestClosureModal {...defaultProps} />);
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('shows decision select with GO option', () => {
    render(<TestClosureModal {...defaultProps} />);
    expect(screen.getByDisplayValue(/GO PRODUCTION/i)).toBeInTheDocument();
  });

  it('shows environment select', () => {
    render(<TestClosureModal {...defaultProps} />);
    expect(screen.getByDisplayValue('Préprod')).toBeInTheDocument();
  });

  it('renders add anomaly button', () => {
    render(<TestClosureModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Ajouter/i })).toBeInTheDocument();
  });
});
