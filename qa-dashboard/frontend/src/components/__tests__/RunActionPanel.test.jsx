import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RunActionPanel from '../RunActionPanel';
import apiService from '../../services/api.service';

vi.mock('../../services/api.service', () => ({
  default: {
    getFolderCases: vi.fn(),
    getProjectRunsList: vi.fn(),
    createTestRun: vi.fn(),
    getRunMergePreview: vi.fn(),
    mergeRunCases: vi.fn(),
  },
}));

const CASE_IDS = [101, 102, 103];
const RUNS = [
  { id: 42, name: 'R14 - Sprint 1' },
  { id: 43, name: 'R14 - Sprint 2' },
];
const PREVIEW = {
  toAdd: [201, 202],
  testedInRun: [101],
  pristineInRun: [102],
  inRunNotInSync: [],
};

describe('RunActionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getFolderCases.mockResolvedValue({ caseIds: CASE_IDS });
    apiService.getProjectRunsList.mockResolvedValue(RUNS);
    apiService.createTestRun.mockResolvedValue({ id: 99, name: 'Nouveau run' });
    apiService.getRunMergePreview.mockResolvedValue(PREVIEW);
    apiService.mergeRunCases.mockResolvedValue({ added: 2, preserved: 3 });
  });

  it('retourne null si syncProjectId absent', () => {
    const { container } = render(<RunActionPanel iterationName="R14" isDark={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('retourne null si iterationName absent', () => {
    const { container } = render(<RunActionPanel syncProjectId="neo-pilot" isDark={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche la phase idle avec bouton Préparer le run', () => {
    render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
    expect(screen.getByRole('button', { name: /Préparer le run/i })).toBeInTheDocument();
    expect(screen.getByText(/R14/)).toBeInTheDocument();
  });

  describe('phase no_run — aucun run existant', () => {
    beforeEach(() => {
      apiService.getProjectRunsList.mockResolvedValue([]);
    });

    it('affiche le bouton Créer le run après chargement', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: /Créer le run de test/i })).toBeInTheDocument()
      );
      expect(screen.getByText(/3 cas/)).toBeInTheDocument();
    });

    it('annuler depuis no_run repasse en idle', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Créer le run de test/i }));
      fireEvent.click(screen.getByRole('button', { name: /Annuler/i }));

      expect(screen.getByRole('button', { name: /Préparer le run/i })).toBeInTheDocument();
    });
  });

  describe('phase run_found — runs existants', () => {
    it('affiche la liste des runs et le bouton Créer un nouveau run', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('combobox'));
      expect(screen.getByRole('combobox').options).toHaveLength(RUNS.length + 1);
      expect(screen.getByRole('button', { name: /Créer un nouveau run/i })).toBeInTheDocument();
    });

    it("bouton Mettre à jour absent tant qu'aucun run n'est sélectionné", async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('combobox'));
      expect(screen.queryByRole('button', { name: /Mettre à jour ce run/i })).not.toBeInTheDocument();
    });

    it('bouton Mettre à jour apparaît après sélection', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('combobox'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '42' } });
      expect(screen.getByRole('button', { name: /Mettre à jour ce run/i })).toBeInTheDocument();
    });
  });

  describe('phase confirm_create — modal création', () => {
    it('ouvre la modal avec le nom de run pré-rempli', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Créer un nouveau run/i }));
      fireEvent.click(screen.getByRole('button', { name: /Créer un nouveau run/i }));

      await waitFor(() => screen.getByRole('heading', { name: /Créer le run de test/i }));
      const input = screen.getByPlaceholderText(/Nom du run/i);
      expect(input.value).toMatch(/R14/);
    });

    it('bouton Créer désactivé si nom vide', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Créer un nouveau run/i }));
      fireEvent.click(screen.getByRole('button', { name: /Créer un nouveau run/i }));

      await waitFor(() => screen.getByPlaceholderText(/Nom du run/i));
      fireEvent.change(screen.getByPlaceholderText(/Nom du run/i), { target: { value: '' } });
      expect(screen.getByRole('button', { name: /^Créer$/i })).toBeDisabled();
    });

    it('crée le run et affiche le message de succès', async () => {
      const onDone = vi.fn();
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} onDone={onDone} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Créer un nouveau run/i }));
      fireEvent.click(screen.getByRole('button', { name: /Créer un nouveau run/i }));

      await waitFor(() => screen.getByRole('button', { name: /^Créer$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Créer$/i }));

      await waitFor(() =>
        expect(screen.getByText(/Run #99 créé/i)).toBeInTheDocument()
      );
      expect(apiService.createTestRun).toHaveBeenCalledWith('neo-pilot', expect.any(String), CASE_IDS);
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ type: 'created' }));
    });
  });

  describe('phase confirm_merge — modal merge', () => {
    it('affiche le preview de merge avec stats', async () => {
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('combobox'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '42' } });
      fireEvent.click(screen.getByRole('button', { name: /Mettre à jour ce run/i }));

      await waitFor(() => screen.getByRole('heading', { name: /Mise à jour du run #42/i }));
      expect(screen.getByText(/Nouveaux cas à ajouter/i)).toBeInTheDocument();
      expect(screen.getByText(/Cas déjà testés/i)).toBeInTheDocument();
      expect(apiService.getRunMergePreview).toHaveBeenCalledWith(42, CASE_IDS);
    });

    it('merge le run et affiche le succès', async () => {
      const onDone = vi.fn();
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} onDone={onDone} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('combobox'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '42' } });
      fireEvent.click(screen.getByRole('button', { name: /Mettre à jour ce run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Mettre à jour/i, exact: false }));
      const mergeBtn = screen.getAllByRole('button', { name: /Mettre à jour/i }).find(b => !b.disabled);
      fireEvent.click(mergeBtn);

      await waitFor(() =>
        expect(screen.getByText(/2 cas ajoutés/i)).toBeInTheDocument()
      );
      expect(apiService.mergeRunCases).toHaveBeenCalledWith(42, CASE_IDS);
      expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ type: 'merged' }));
    });

    it('bouton Mettre à jour désactivé si toAdd vide', async () => {
      apiService.getRunMergePreview.mockResolvedValue({ ...PREVIEW, toAdd: [] });
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('combobox'));
      fireEvent.change(screen.getByRole('combobox'), { target: { value: '42' } });
      fireEvent.click(screen.getByRole('button', { name: /Mettre à jour ce run/i }));

      await waitFor(() => screen.getByText(/Rien à ajouter/i));
      expect(screen.getByText(/Rien à ajouter/i).closest('button')).toBeDisabled();
    });
  });

  describe('phase error', () => {
    it('affiche le message erreur si getFolderCases rejette', async () => {
      apiService.getFolderCases.mockRejectedValue(new Error('Testmo unreachable'));
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() =>
        expect(screen.getByText(/Testmo unreachable/i)).toBeInTheDocument()
      );
      expect(screen.getByRole('button', { name: /Réessayer/i })).toBeInTheDocument();
    });

    it('Réessayer repasse en idle', async () => {
      apiService.getFolderCases.mockRejectedValue(new Error('oops'));
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Réessayer/i }));
      fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));

      expect(screen.getByRole('button', { name: /Préparer le run/i })).toBeInTheDocument();
    });
  });

  describe('phase done', () => {
    it('Recommencer repasse en idle', async () => {
      apiService.getProjectRunsList.mockResolvedValue([]);
      render(<RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={false} />);
      fireEvent.click(screen.getByRole('button', { name: /Préparer le run/i }));

      await waitFor(() => screen.getByRole('button', { name: /Créer le run de test/i }));
      fireEvent.click(screen.getByRole('button', { name: /Créer le run de test/i }));
      await waitFor(() => screen.getByRole('button', { name: /^Créer$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Créer$/i }));

      await waitFor(() => screen.getByRole('button', { name: /Recommencer/i }));
      fireEvent.click(screen.getByRole('button', { name: /Recommencer/i }));

      expect(screen.getByRole('button', { name: /Préparer le run/i })).toBeInTheDocument();
    });
  });

  it('applique la classe dark', () => {
    const { container } = render(
      <RunActionPanel syncProjectId="neo-pilot" iterationName="R14" isDark={true} />
    );
    expect(container.querySelector('.rap-root.dark')).toBeInTheDocument();
  });
});
