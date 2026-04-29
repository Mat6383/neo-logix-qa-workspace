import { renderHook, act } from '@testing-library/react';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { usePreferences } from '../usePreferences';

const wrapper = ({ children }) => <PreferencesProvider>{children}</PreferencesProvider>;

describe('usePreferences', () => {
  beforeEach(() => localStorage.clear());

  it('throws when used without PreferencesProvider', () => {
    expect(() => renderHook(() => usePreferences())).toThrow(
      'usePreferences must be used within PreferencesProvider'
    );
  });

  it('defaults tvMode to true when no localStorage entry', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.prefs.tvMode).toBe(true);
  });

  it('restores tvMode=false from localStorage', () => {
    localStorage.setItem('testmo_tvMode', 'false');
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.prefs.tvMode).toBe(false);
  });

  it('updatePref toggles tvMode and persists to localStorage', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.updatePref('tvMode', false));
    expect(result.current.prefs.tvMode).toBe(false);
    expect(localStorage.getItem('testmo_tvMode')).toBe('false');
  });

  it('defaults useBusinessTerms to true', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.prefs.useBusinessTerms).toBe(true);
  });

  it('updatePref changes useBusinessTerms and persists', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    act(() => result.current.updatePref('useBusinessTerms', false));
    expect(result.current.prefs.useBusinessTerms).toBe(false);
    expect(localStorage.getItem('testmo_useBusinessTerms')).toBe('false');
  });

  it('defaults showProductionSection to true', () => {
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.prefs.showProductionSection).toBe(true);
  });

  it('restores showProductionSection=false from localStorage', () => {
    localStorage.setItem('testmo_showProductionSection', 'false');
    const { result } = renderHook(() => usePreferences(), { wrapper });
    expect(result.current.prefs.showProductionSection).toBe(false);
  });
});
