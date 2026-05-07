import React, { useState, useEffect, useRef } from 'react';
import '../styles/TabBar.css';

const PRIMARY_TABS = [
  { id: 'principal', label: 'Dashboard Principal' },
  { id: 'dashboard', label: 'Standard' },
  { id: 'tv', label: 'TV' },
  { id: 'quality', label: 'Qualité' },
  { id: 'trends', label: 'Tendances' },
  { id: 'crosstest', label: 'CrossTest' },
  { id: 'compare', label: 'Comparaison' },
];

const TOOLS_ITEMS = [
  { id: 'config', label: 'Configuration des Cycles' },
  { id: 'sync-gitlab', label: 'Sync GitLab → Testmo' },
  { id: 'autosync', label: 'Auto-Sync Testmo → GitLab' },
  { id: 'runs-manage', label: 'Gestionnaire de Runs' },
];

const TabBar = ({ activeTab, onTabChange }) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isToolsActive = TOOLS_ITEMS.some((t) => t.id === activeTab);

  return (
    <nav className="tab-bar">
      {PRIMARY_TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item${activeTab === tab.id ? ' tab-active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}

      <div className="tab-tools" ref={toolsRef}>
        <button
          className={`tab-item tab-tools-trigger${isToolsActive ? ' tab-active' : ''}`}
          onClick={() => setToolsOpen((o) => !o)}
        >
          Outils ⚙
        </button>
        {toolsOpen && (
          <div className="tab-tools-menu">
            {TOOLS_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`tab-tools-item${activeTab === item.id ? ' tab-tools-item-active' : ''}`}
                onClick={() => {
                  onTabChange(item.id);
                  setToolsOpen(false);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
};

export default TabBar;
