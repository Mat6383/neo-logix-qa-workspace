import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Dashboard9 from '../Dashboard9';

vi.mock('../RunActionPanel', () => ({
  default: ({ syncProjectId, iterationName, onDone }) => (
    <div data-testid="run-action-panel">
      <span data-testid="rap-project">{syncProjectId}</span>
      <span data-testid="rap-iteration">{iterationName}</span>
      <button onClick={onDone}>done</button>
    </div>
  ),
}));

describe('Dashboard9 — Gestionnaire de Runs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('affiche le titre et le formulaire', () => {
    render(<Dashboard9 isDark={false} />);
    expect(screen.getByText(/Gestionnaire de Runs/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ex : R14/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Charger les cas/i })).toBeInTheDocument();
  });

  it('bouton désactivé si iteration vide', () => {
    render(<Dashboard9 isDark={false} />);
    expect(screen.getByRole('button', { name: /Charger les cas/i })).toBeDisabled();
  });

  it("bouton activé dès que l'itération est renseignée", () => {
    render(<Dashboard9 isDark={false} />);
    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R14 - run 1' } });
    expect(screen.getByRole('button', { name: /Charger les cas/i })).not.toBeDisabled();
  });

  it('affiche RunActionPanel avec les bons props après clic', async () => {
    render(<Dashboard9 isDark={false} />);
    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R14 - run 1' } });
    fireEvent.click(screen.getByRole('button', { name: /Charger les cas/i }));

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.getByTestId('run-action-panel')).toBeInTheDocument();
    expect(screen.getByTestId('rap-project').textContent).toBe('neo-pilot');
    expect(screen.getByTestId('rap-iteration').textContent).toBe('R14 - run 1');
  });

  it('appui sur Entrée déclenche le chargement', async () => {
    render(<Dashboard9 isDark={false} />);
    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R15' } });
    fireEvent.keyDown(screen.getByPlaceholderText(/ex : R14/i), { key: 'Enter' });

    await act(async () => {
      vi.runAllTimers();
    });

    expect(screen.getByTestId('run-action-panel')).toBeInTheDocument();
  });

  it('changer le projet masque le panel', async () => {
    render(<Dashboard9 isDark={false} />);
    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R14' } });
    fireEvent.click(screen.getByRole('button', { name: /Charger les cas/i }));

    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByTestId('run-action-panel')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'workshop-web' } });
    expect(screen.queryByTestId('run-action-panel')).not.toBeInTheDocument();
  });

  it("changer l'itération masque le panel", async () => {
    render(<Dashboard9 isDark={false} />);
    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R14' } });
    fireEvent.click(screen.getByRole('button', { name: /Charger les cas/i }));

    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByTestId('run-action-panel')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R15' } });
    expect(screen.queryByTestId('run-action-panel')).not.toBeInTheDocument();
  });

  it("onDone masque le panel et vide l'itération", async () => {
    render(<Dashboard9 isDark={false} />);
    fireEvent.change(screen.getByPlaceholderText(/ex : R14/i), { target: { value: 'R14' } });
    fireEvent.click(screen.getByRole('button', { name: /Charger les cas/i }));

    await act(async () => { vi.runAllTimers(); });
    expect(screen.getByTestId('run-action-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'done' }));
    expect(screen.queryByTestId('run-action-panel')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ex : R14/i).value).toBe('');
  });

  it('affiche le projet sélectionné dans le select', () => {
    render(<Dashboard9 isDark={false} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'link' } });
    expect(select.value).toBe('link');
  });

  it('applique la classe dark si isDark=true', () => {
    const { container } = render(<Dashboard9 isDark={true} />);
    expect(container.querySelector('.d9-root.dark')).toBeInTheDocument();
  });
});
