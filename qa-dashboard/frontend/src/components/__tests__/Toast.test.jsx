import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Toast from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders message', () => {
    render(<Toast message="Une erreur" onClose={vi.fn()} />);
    expect(screen.getByText('Une erreur')).toBeInTheDocument();
  });

  it('renders nothing when no message', () => {
    const { container } = render(<Toast message="" onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose after duration', async () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} duration={1000} />);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1000 + 300);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<Toast message="Test" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button'));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('uses red background for error type', () => {
    const { container } = render(<Toast message="Error" type="error" onClose={vi.fn()} />);
    const toast = container.firstChild;
    expect(toast.style.backgroundColor).toBe('rgb(239, 68, 68)');
  });

  it('uses green background for success type', () => {
    const { container } = render(<Toast message="OK" type="success" onClose={vi.fn()} />);
    const toast = container.firstChild;
    expect(toast.style.backgroundColor).toBe('rgb(16, 185, 129)');
  });
});
