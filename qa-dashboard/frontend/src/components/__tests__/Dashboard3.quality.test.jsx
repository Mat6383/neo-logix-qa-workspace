import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Dashboard3 from '../Dashboard3';

const project = { id: 1, name: 'Neo-Pilot' };
const metrics = {
  qualityRates: {
    escapeRate: 3,
    detectionRate: 97,
    bugsInProd: 2,
    bugsInTest: 30,
    totalBugs: 32,
    preprodMilestone: 'R14',
    prodMilestone: 'R13',
    message: null,
  },
};

describe('Dashboard3 — Quality Rates', () => {
  it('affiche le spinner de chargement quand metrics est null', () => {
    render(<Dashboard3 metrics={null} project={project} isDark={false} useBusiness={true} />);
    expect(screen.getByText(/Chargement des données ISTQB/i)).toBeInTheDocument();
  });

  it('affiche le spinner de chargement quand project est null', () => {
    render(<Dashboard3 metrics={metrics} project={null} isDark={false} useBusiness={true} />);
    expect(screen.getByText(/Chargement des données ISTQB/i)).toBeInTheDocument();
  });

  it("affiche un message quand totalBugs === 0", () => {
    const metricsZero = {
      qualityRates: {
        escapeRate: 0,
        detectionRate: 0,
        bugsInProd: 0,
        bugsInTest: 0,
        totalBugs: 0,
        preprodMilestone: 'N/A',
        prodMilestone: 'N/A',
        message: 'Aucun bug enregistré',
      },
    };
    render(<Dashboard3 metrics={metricsZero} project={project} isDark={false} useBusiness={true} />);
    expect(screen.getByText(/Aucun bug enregistré/i)).toBeInTheDocument();
    expect(screen.getByText(/Information/i)).toBeInTheDocument();
  });

  it('affiche les valeurs du taux d\'échappement et du taux de détection', () => {
    render(<Dashboard3 metrics={metrics} project={project} isDark={false} useBusiness={true} />);
    // escapeRate = 3, detectionRate = 97 — rendered as "{value}%" in metric cards and breakdown
    expect(screen.getAllByText('3%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('97%').length).toBeGreaterThanOrEqual(1);
  });

  it('affiche le libellé français quand useBusiness=true', () => {
    render(<Dashboard3 metrics={metrics} project={project} isDark={false} useBusiness={true} />);
    expect(screen.getByText(/Métrique de Qualité \(ISTQB\)/i)).toBeInTheDocument();
  });

  it('affiche le libellé anglais quand useBusiness=false', () => {
    render(<Dashboard3 metrics={metrics} project={project} isDark={false} useBusiness={false} />);
    expect(screen.getByText(/Quality Rates/i)).toBeInTheDocument();
  });
});
