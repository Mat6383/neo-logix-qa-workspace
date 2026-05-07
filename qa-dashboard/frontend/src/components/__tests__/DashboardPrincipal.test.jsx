import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPrincipal from '../DashboardPrincipal';

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock('../ModalGroup', () => ({
  default: () => <div data-testid="modal-group" />,
}));

vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/png;base64,xxx',
    height: 100,
    width: 100,
  }),
}));

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 297, getHeight: () => 210 } },
    addImage: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock('lucide-react', () => ({
  Activity: () => <span data-testid="icon-activity" />,
  Database: () => <span data-testid="icon-database" />,
  CheckCircle: () => <span />,
  Bug: () => <span />,
  Download: () => <span />,
  Layers: () => <span />,
  CheckSquare: () => <span />,
  XCircle: () => <span />,
  BarChart3: () => <span />,
  TrendingUp: () => <span />,
  AlertTriangle: () => <span data-testid="icon-alert" />,
  Search: () => <span />,
  ShieldAlert: () => <span />,
  ShieldCheck: () => <span />,
}));

const makeMetrics = (overrides = {}) => ({
  completionRate: 92,
  passRate: 96,
  failureRate: 4,
  testEfficiency: 97,
  raw: { completed: 90, total: 100, passed: 86, failed: 4, wip: 5, blocked: 1, untested: 5 },
  runs: [
    { id: 1, name: 'Run R14', isExploratory: false, completionRate: 92, passRate: 96 },
    { id: 'session-2', name: 'Explo Session', isExploratory: true, completionRate: 80, passRate: 85, isClosed: false },
  ],
  qualityRates: {
    escapeRate: 2,
    detectionRate: 97,
    bugsInProd: 2,
    bugsInTest: 28,
    totalBugs: 30,
    prodMilestone: 'M6',
    preprodMilestone: 'M5',
  },
  slaStatus: { ok: true, alerts: [] },
  ...overrides,
});

const project = { id: 1, name: 'Neo-Pilot' };

describe('DashboardPrincipal — Vue globale', () => {
  beforeEach(() => vi.clearAllMocks());

  it('affiche le spinner quand metrics est null', () => {
    render(<DashboardPrincipal metrics={null} project={project} />);
    expect(screen.getByText(/Chargement des données ISTQB/i)).toBeInTheDocument();
  });

  it('affiche le spinner quand project est null', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={null} />);
    expect(screen.getByText(/Chargement des données ISTQB/i)).toBeInTheDocument();
  });

  it("affiche le nom du projet dans le titre", () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getByText('Neo-Pilot')).toBeInTheDocument();
  });

  it('affiche le nom du latestRun (premier run non-exploratoire)', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getAllByText('Run R14').length).toBeGreaterThanOrEqual(1);
  });

  it('affiche le taux de complétion', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getAllByText('92%').length).toBeGreaterThanOrEqual(1);
  });

  it('affiche le pass rate', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getAllByText('96%').length).toBeGreaterThanOrEqual(1);
  });

  it('affiche le taux d\'échec', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getByText('4%')).toBeInTheDocument();
  });

  it('affiche les campagnes actives', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getByText(/Campagnes Actives/i)).toBeInTheDocument();
  });

  it('affiche le run non-exploratoire et le run exploratory', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getAllByText('Run R14').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Explo Session')).toBeInTheDocument();
  });

  it('affiche l\'escape rate en section production', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getByText('2%')).toBeInTheDocument();
  });

  it('affiche le taux de détection en section production', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} />);
    expect(screen.getAllByText('97%').length).toBeGreaterThanOrEqual(1);
  });

  it('masque la section production quand showProductionSection=false', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} showProductionSection={false} />);
    expect(screen.queryByText('Taux d\'Échappement')).not.toBeInTheDocument();
  });

  it('affiche le sélecteur de projet quand projects et onProjectChange fournis', () => {
    const projects = [
      { id: 1, name: 'Neo-Pilot' },
      { id: 2, name: 'Other' },
    ];
    render(
      <DashboardPrincipal
        metrics={makeMetrics()}
        project={project}
        projects={projects}
        projectId={1}
        onProjectChange={vi.fn()}
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Neo-Pilot' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Other' })).toBeInTheDocument();
  });

  it('n\'affiche pas le sélecteur quand projects est vide', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} projects={[]} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('mode business : affiche les labels FR', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} useBusiness={true} />);
    expect(screen.getByText(/tests exécutés/i)).toBeInTheDocument();
  });

  it('mode technique : affiche les labels EN', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} useBusiness={false} />);
    expect(screen.getByText(/tests executed/i)).toBeInTheDocument();
  });

  it('bascule showAllRuns au clic du toggle', () => {
    render(<DashboardPrincipal metrics={makeMetrics()} project={project} useBusiness={true} />);
    const toggle = screen.getByText(/Tout afficher/i).closest('div');
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    // Après le clic le texte "Tout afficher" reste (même label dans ce composant)
    // On vérifie juste que le clic ne plante pas
    expect(screen.getByText(/Tout afficher/i)).toBeInTheDocument();
  });

  it('affiche une alerte SLA quand slaStatus non ok', () => {
    const metrics = makeMetrics({
      slaStatus: {
        ok: false,
        alerts: [{ metric: 'Pass Rate', severity: 'critical', message: 'Pass rate critique: 80%' }],
      },
    });
    render(<DashboardPrincipal metrics={metrics} project={project} />);
    expect(screen.getByTestId('icon-alert')).toBeInTheDocument();
  });

  it('remplace les labels d\'alerte en mode business', () => {
    const metrics = makeMetrics({
      slaStatus: {
        ok: false,
        alerts: [{ metric: 'Pass Rate', severity: 'warning', message: 'Pass rate en warning: 91%' }],
      },
    });
    render(<DashboardPrincipal metrics={metrics} project={project} useBusiness={true} />);
    expect(screen.getByText(/Attention :/)).toBeInTheDocument();
  });
});
