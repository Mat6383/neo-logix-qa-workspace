import { renderHook, act } from '@testing-library/react';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { useTheme } from '../useTheme';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('useTheme', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to light mode when no localStorage entry', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);
  });

  it('restores dark mode from localStorage', () => {
    localStorage.setItem('testmo_darkMode', 'true');
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(true);
  });

  it('toggles from light to dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(result.current.isDark).toBe(true);
  });

  it('persists theme preference in localStorage after toggle', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => result.current.toggleTheme());
    expect(localStorage.getItem('testmo_darkMode')).toBe('true');
  });

  it('throws when used without ThemeProvider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      'useTheme must be used within ThemeProvider'
    );
  });
});
