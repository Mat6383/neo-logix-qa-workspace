import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportGeneratorModal from '../ReportGeneratorModal';

vi.mock('../../services/api.service', () => ({
  default: {
    generateReport: vi.fn().mockResolvedValue({
      html: '<html><body>Report</body></html>',
      pptxBase64: '',
    }),
  },
}));

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  metrics: {
    passRate: 90,
    completionRate: 88,
    runs: [{ id: 1, name: 'R14', passRate: 90, isExploratory: false }],
    sessionsByType: {},
  },
  project: { id: 1, name: 'neo-pilot' },
};

describe('ReportGeneratorModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when isOpen=false', () => {
    const { container } = render(<ReportGeneratorModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title when open', () => {
    render(<ReportGeneratorModal {...defaultProps} />);
    expect(screen.getByText(/Générer Rapport de Clôture/i)).toBeInTheDocument();
  });

  it('renders format checkboxes', () => {
    render(<ReportGeneratorModal {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
  });

  it('format text labels visible', () => {
    render(<ReportGeneratorModal {...defaultProps} />);
    expect(screen.getByText('HTML')).toBeInTheDocument();
    expect(screen.getByText('PowerPoint')).toBeInTheDocument();
  });

  it('format checkboxes checked by default', () => {
    render(<ReportGeneratorModal {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    const formatCheckboxes = checkboxes.slice(0, 2);
    formatCheckboxes.forEach(cb => expect(cb).toBeChecked());
  });

  it('renders default recommendations categories', () => {
    render(<ReportGeneratorModal {...defaultProps} />);
    expect(screen.getByDisplayValue(/Muda/i)).toBeInTheDocument();
  });

  it('renders add recommendation button', () => {
    render(<ReportGeneratorModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Ajouter/i })).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<ReportGeneratorModal {...defaultProps} onClose={onClose} />);
    const closeBtn = screen.getAllByRole('button').find(
      b => b.querySelector('svg') && !b.textContent.trim()
    );
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
