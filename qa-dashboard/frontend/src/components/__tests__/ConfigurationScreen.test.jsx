import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConfigurationScreen from '../ConfigurationScreen';
import apiService from '../../services/api.service';

vi.mock('../../services/api.service', () => ({
  default: { getProjectMilestones: vi.fn() },
}));

vi.mock('../Toast', () => ({
  default: ({ message }) => message ? <div data-testid="toast">{message}</div> : null,
}));

const milestones = [
  { id: 10, name: 'R13' },
  { id: 11, name: 'R14' },
  { id: 12, name: 'R15' },
];

describe('ConfigurationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getProjectMilestones.mockResolvedValue({ result: milestones });
  });

  it('shows loading state initially', () => {
    apiService.getProjectMilestones.mockReturnValue(new Promise(() => {}));
    render(<ConfigurationScreen projectId={1} onSaveSelection={vi.fn()} />);
    expect(screen.getByText(/Chargement des données/i)).toBeInTheDocument();
  });

  it('renders header after load', async () => {
    render(<ConfigurationScreen projectId={1} onSaveSelection={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Configuration des Cycles de Test/i)).toBeInTheDocument()
    );
  });

  it('renders milestone options', async () => {
    render(<ConfigurationScreen projectId={1} onSaveSelection={vi.fn()} />);
    await waitFor(() => {
      const options = screen.getAllByRole('option', { name: 'R13' });
      expect(options.length).toBeGreaterThan(0);
    });
  });

  it('save button calls onSaveSelection', async () => {
    const onSave = vi.fn();
    render(<ConfigurationScreen projectId={1} onSaveSelection={onSave} />);
    await waitFor(() => screen.getByRole('button', { name: /Appliquer la configuration/i }));

    fireEvent.click(screen.getByRole('button', { name: /Appliquer la configuration/i }));
    expect(onSave).toHaveBeenCalledWith([], []);
  });

  it('shows success toast after save', async () => {
    render(<ConfigurationScreen projectId={1} onSaveSelection={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /Appliquer la configuration/i }));

    fireEvent.click(screen.getByRole('button', { name: /Appliquer la configuration/i }));
    expect(screen.getByTestId('toast').textContent).toMatch(/sauvegardée avec succès/i);
  });

  it('reset button calls onSaveSelection with empty arrays', async () => {
    const onSave = vi.fn();
    render(<ConfigurationScreen projectId={1} onSaveSelection={onSave} />);
    await waitFor(() => screen.getByRole('button', { name: /Réinitialiser/i }));

    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/i }));
    expect(onSave).toHaveBeenCalledWith([], []);
  });

  it('shows reset toast after reset', async () => {
    render(<ConfigurationScreen projectId={1} onSaveSelection={vi.fn()} />);
    await waitFor(() => screen.getByRole('button', { name: /Réinitialiser/i }));

    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/i }));
    expect(screen.getByTestId('toast').textContent).toMatch(/réinitialisée/i);
  });

  it('calls getProjectMilestones with projectId', async () => {
    render(<ConfigurationScreen projectId={42} onSaveSelection={vi.fn()} />);
    await waitFor(() => expect(apiService.getProjectMilestones).toHaveBeenCalledWith(42));
  });

  it('initializes with provided milestone selections', async () => {
    render(
      <ConfigurationScreen
        projectId={1}
        onSaveSelection={vi.fn()}
        initialPreprodMilestones={[10]}
        initialProdMilestones={[11]}
      />
    );
    await waitFor(() =>
      expect(screen.getAllByText(/1 jalon\(s\) sélectionné\(s\)/i).length).toBeGreaterThan(0)
    );
  });
});
