import { createContext, useState, useCallback } from 'react';

export const PreferencesContext = createContext(null);

function loadPrefs() {
  return {
    tvMode: localStorage.getItem('testmo_tvMode') !== 'false',
    useBusinessTerms: localStorage.getItem('testmo_useBusinessTerms') !== 'false',
    showProductionSection: (() => {
      const saved = localStorage.getItem('testmo_showProductionSection');
      return saved !== null ? saved === 'true' : true;
    })(),
  };
}

export function PreferencesProvider({ children }) {
  const [prefs, setPrefs] = useState(loadPrefs);

  const updatePref = useCallback((key, value) => {
    localStorage.setItem(`testmo_${key}`, typeof value === 'boolean' ? String(value) : value);
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  return (
    <PreferencesContext.Provider value={{ prefs, updatePref }}>
      {children}
    </PreferencesContext.Provider>
  );
}
