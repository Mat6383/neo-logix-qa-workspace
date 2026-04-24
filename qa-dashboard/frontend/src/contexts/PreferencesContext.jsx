import { createContext, useState, useCallback } from 'react';

export const PreferencesContext = createContext(null);

const DEFAULTS = {
  tvMode: true,
  dashboardView: '1',
  useBusinessTerms: true,
  showProductionSection: true,
};

function loadPrefs() {
  return {
    tvMode: localStorage.getItem('testmo_tvMode') !== 'false',
    dashboardView: localStorage.getItem('testmo_dashboardView') || DEFAULTS.dashboardView,
    useBusinessTerms: localStorage.getItem('testmo_useBusinessTerms') !== 'false',
    showProductionSection: (() => {
      const saved = localStorage.getItem('testmo_showProductionSection');
      return saved !== null ? saved === 'true' : DEFAULTS.showProductionSection;
    })(),
  };
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  const updatePref = useCallback((key, value) => {
    const storageKey = `testmo_${key}`;
    localStorage.setItem(storageKey, typeof value === 'boolean' ? String(value) : value);
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref }}>
      {children}
    </PreferencesContext.Provider>
  );
}
