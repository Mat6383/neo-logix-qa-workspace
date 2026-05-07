import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TabBar from '../TabBar';

describe('TabBar', () => {
  it('rend les 7 tabs primaires', () => {
    render(<TabBar activeTab="principal" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Dashboard Principal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Standard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'TV' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Qualité' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tendances' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CrossTest' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comparaison' })).toBeInTheDocument();
  });

  it('le tab actif reçoit la classe tab-active', () => {
    render(<TabBar activeTab="quality" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Qualité' })).toHaveClass('tab-active');
    expect(screen.getByRole('button', { name: 'Standard' })).not.toHaveClass('tab-active');
  });

  it('click tab → onTabChange appelé avec le bon id', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="principal" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tendances' }));
    expect(onTabChange).toHaveBeenCalledWith('trends');
  });

  it('click Dashboard Principal → onTabChange("principal")', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="dashboard" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard Principal' }));
    expect(onTabChange).toHaveBeenCalledWith('principal');
  });

  it('bouton "Outils ⚙" est visible', () => {
    render(<TabBar activeTab="principal" onTabChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Outils/i })).toBeInTheDocument();
  });

  it('click "Outils ⚙" → sous-menu visible avec 4 items', () => {
    render(<TabBar activeTab="principal" onTabChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    expect(screen.getByRole('button', { name: 'Configuration des Cycles' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sync GitLab → Testmo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auto-Sync Testmo → GitLab' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gestionnaire de Runs' })).toBeInTheDocument();
  });

  it('click item sous-menu → onTabChange appelé + sous-menu fermé', () => {
    const onTabChange = vi.fn();
    render(<TabBar activeTab="principal" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Gestionnaire de Runs' }));
    expect(onTabChange).toHaveBeenCalledWith('runs-manage');
    expect(screen.queryByRole('button', { name: 'Gestionnaire de Runs' })).not.toBeInTheDocument();
  });

  it('click extérieur → sous-menu fermé', () => {
    render(
      <div>
        <TabBar activeTab="principal" onTabChange={vi.fn()} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: /Outils/i }));
    expect(screen.getByRole('button', { name: 'Configuration des Cycles' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('button', { name: 'Configuration des Cycles' })).not.toBeInTheDocument();
  });
});
