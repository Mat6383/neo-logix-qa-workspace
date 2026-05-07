import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ModalGroup from '../ModalGroup';

vi.mock('../TestClosureModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? <div data-testid="test-closure-modal"><button onClick={onClose}>close-tcm</button></div> : null,
}));

vi.mock('../QuickClosureModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? <div data-testid="quick-closure-modal"><button onClick={onClose}>close-qcm</button></div> : null,
}));

vi.mock('../ReportGeneratorModal', () => ({
  default: ({ isOpen, onClose }) =>
    isOpen ? <div data-testid="report-generator-modal"><button onClick={onClose}>close-rgm</button></div> : null,
}));

const defaultProps = {
  metrics: { passRate: 90 },
  project: { id: 1, name: 'neo-pilot' },
};

describe('ModalGroup', () => {
  it('renders 3 trigger buttons', () => {
    render(<ModalGroup {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Clôture de Test/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Quick Clôture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rapport HTML/i })).toBeInTheDocument();
  });

  it('modals initially closed', () => {
    render(<ModalGroup {...defaultProps} />);
    expect(screen.queryByTestId('test-closure-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('quick-closure-modal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('report-generator-modal')).not.toBeInTheDocument();
  });

  it('opens TestClosureModal on click', () => {
    render(<ModalGroup {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Clôture de Test/i }));
    expect(screen.getByTestId('test-closure-modal')).toBeInTheDocument();
  });

  it('opens QuickClosureModal on click', () => {
    render(<ModalGroup {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Quick Clôture/i }));
    expect(screen.getByTestId('quick-closure-modal')).toBeInTheDocument();
  });

  it('opens ReportGeneratorModal on click', () => {
    render(<ModalGroup {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Rapport HTML/i }));
    expect(screen.getByTestId('report-generator-modal')).toBeInTheDocument();
  });

  it('closes TestClosureModal via onClose', () => {
    render(<ModalGroup {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Clôture de Test/i }));
    fireEvent.click(screen.getByRole('button', { name: 'close-tcm' }));
    expect(screen.queryByTestId('test-closure-modal')).not.toBeInTheDocument();
  });

  it('closes QuickClosureModal via onClose', () => {
    render(<ModalGroup {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Quick Clôture/i }));
    fireEvent.click(screen.getByRole('button', { name: 'close-qcm' }));
    expect(screen.queryByTestId('quick-closure-modal')).not.toBeInTheDocument();
  });

  it('closes ReportGeneratorModal via onClose', () => {
    render(<ModalGroup {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /Rapport HTML/i }));
    fireEvent.click(screen.getByRole('button', { name: 'close-rgm' }));
    expect(screen.queryByTestId('report-generator-modal')).not.toBeInTheDocument();
  });
});
