import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../ErrorBoundary';

const ThrowingChild = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('Test error message');
  return <div>Child OK</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(screen.getByText('Child OK')).toBeInTheDocument();
  });

  it('shows error UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Une erreur inattendue est survenue/i)).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('shows retry button in error state', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /Réessayer/i })).toBeInTheDocument();
  });

  it('retry button resets hasError state and attempts re-render', () => {
    const shouldThrowRef = { current: true };
    const Controlled = () => {
      if (shouldThrowRef.current) throw new Error('controlled');
      return <div>Recovered</div>;
    };
    render(<ErrorBoundary><Controlled /></ErrorBoundary>);

    shouldThrowRef.current = false;
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('shows fallback message when error has no message', () => {
    const ThrowNoMessage = () => { throw new Error(); };
    render(
      <ErrorBoundary>
        <ThrowNoMessage />
      </ErrorBoundary>
    );
    expect(screen.getByText('Erreur inconnue')).toBeInTheDocument();
  });
});
