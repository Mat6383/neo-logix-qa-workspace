import React, { useState } from 'react';
import { Layers, Settings2 } from 'lucide-react';
import RunActionPanel from './RunActionPanel';
import '../styles/Dashboard9.css';

const PROJECTS = [
  { id: 'neo-pilot',    label: 'Neo-Pilot' },
  { id: 'workshop-web', label: 'Workshop Web' },
  { id: 'workshop',     label: 'Workshop' },
  { id: 'link',         label: 'Link' },
];

export default function Dashboard9({ isDark }) {
  const [syncProjectId, setSyncProjectId] = useState('neo-pilot');
  const [iterationName, setIterationName] = useState('');
  const [showPanel, setShowPanel]         = useState(false);
  const [panelKey, setPanelKey]           = useState(0);

  const handleSearch = () => {
    if (!iterationName.trim()) return;
    setShowPanel(false);
    setTimeout(() => {
      setShowPanel(true);
      setPanelKey(k => k + 1);
    }, 0);
  };

  return (
    <div className={`d9-root${isDark ? ' dark' : ''}`}>
      <div className="d9-header">
        <h2><Layers size={22} /> Gestionnaire de Runs</h2>
        <p>Créez ou mettez à jour un run Testmo à partir d'un dossier d'itération existant</p>
      </div>

      <div className={`d9-card${isDark ? ' dark' : ''}`}>
        <div className="d9-card-title"><Settings2 size={16} /> Paramètres</div>

        <div className="d9-form-group">
          <label>Projet</label>
          <select
            className="d9-select"
            value={syncProjectId}
            onChange={e => { setSyncProjectId(e.target.value); setShowPanel(false); }}
          >
            {PROJECTS.map(p => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="d9-form-group">
          <label>Nom de l'itération (= nom du dossier Testmo)</label>
          <input
            className="d9-input"
            type="text"
            value={iterationName}
            placeholder="ex : R14 - run 1"
            onChange={e => { setIterationName(e.target.value); setShowPanel(false); }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <button
          className="d9-btn-primary"
          onClick={handleSearch}
          disabled={!iterationName.trim()}
        >
          Charger les cas
        </button>
      </div>

      {showPanel && (
        <RunActionPanel
          key={panelKey}
          syncProjectId={syncProjectId}
          iterationName={iterationName.trim()}
          isDark={isDark}
          onDone={() => {
            setShowPanel(false);
            setIterationName('');
          }}
        />
      )}
    </div>
  );
}
