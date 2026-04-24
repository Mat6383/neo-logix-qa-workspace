import { renderHook, act } from '@testing-library/react';
import { screen } from '@testing-library/react';
import { render } from '@testing-library/react';
import { ToastProvider } from '../../contexts/ToastContext';
import { useToast } from '../useToast';

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

describe('useToast', () => {
  it('throws when used without ToastProvider', () => {
    expect(() => renderHook(() => useToast())).toThrow(
      'useToast must be used within ToastProvider'
    );
  });

  it('exposes addToast and removeToast functions', () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current.addToast).toBe('function');
    expect(typeof result.current.removeToast).toBe('function');
  });

  it('addToast renders the message in the DOM', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      return <button onClick={() => addToast({ message: 'Test toast', type: 'success' })}>add</button>;
    };

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('add').click();
    });

    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('addToast applies the correct type class', () => {
    const TestComponent = () => {
      const { addToast } = useToast();
      return <button onClick={() => addToast({ message: 'Error msg', type: 'error' })}>add</button>;
    };

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => {
      screen.getByText('add').click();
    });

    expect(screen.getByText('Error msg').closest('.toast')).toHaveClass('toast-error');
  });

  it('removeToast removes the toast from the DOM', () => {
    const TestComponent = () => {
      const { addToast, removeToast } = useToast();
      return (
        <>
          <button onClick={() => addToast({ message: 'removable', type: 'info' })}>add</button>
          <button onClick={() => removeToast(1)}>remove</button>
        </>
      );
    };

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    act(() => { screen.getByText('add').click(); });
    expect(screen.getByText('removable')).toBeInTheDocument();

    act(() => { screen.getByText('removable').click(); });
    expect(screen.queryByText('removable')).not.toBeInTheDocument();
  });
});
