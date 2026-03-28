import React, { useState, useEffect } from 'react';
import { Settings, Save, Info, Filter } from 'lucide-react';
import apiService from '../services/api.service';
import Toast from './Toast';

const ConfigurationScreen = ({ projectId, isDark, onSaveSelection, initialPreprodMilestones, initialProdMilestones }) => {
    const [milestones, setMilestones] = useState([]);
    const [loading, setLoading] = useState(true);

    // State for selected milestones
    const [selectedPreprodMilestones, setSelectedPreprodMilestones] = useState(initialPreprodMilestones || []);
    const [selectedProdMilestones, setSelectedProdMilestones] = useState(initialProdMilestones || []);

    const [toastMessage, setToastMessage] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [milestonesData] = await Promise.all([
                    apiService.getProjectMilestones(projectId)
                ]);

                setMilestones(milestonesData.result || []);
            } catch (e) {
                console.error("Error fetching data for configuration:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [projectId]);

    const handlePreprodMilestonesChange = (e) => {
        const options = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
        if (options.length > 2) {
            setToastMessage('Vous ne pouvez sélectionner que 2 jalons maximum pour la préproduction.');
            return;
        }
        setSelectedPreprodMilestones(options);
    };

    const handleProdMilestonesChange = (e) => {
        const options = Array.from(e.target.selectedOptions).map(opt => parseInt(opt.value));
        if (options.length > 2) {
            setToastMessage('Vous ne pouvez sélectionner que 2 jalons maximum pour la production.');
            return;
        }
        setSelectedProdMilestones(options);
    };

    const handleSave = () => {
        onSaveSelection(selectedPreprodMilestones, selectedProdMilestones);
        setToastMessage('Configuration sauvegardée avec succès !');
    };

    const clearSelection = () => {
        setSelectedPreprodMilestones([]);
        setSelectedProdMilestones([]);
        onSaveSelection([], []);
        setToastMessage('Configuration réinitialisée au fonctionnement par défaut.');
    };

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement des données...</div>;

    const selectStyle = {
        width: '100%',
        height: '300px',
        padding: '0.5rem',
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-color)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        fontSize: '0.9rem'
    };

    const filterSelectStyle = {
        width: '100%',
        padding: '0.5rem',
        marginBottom: '1rem',
        backgroundColor: 'var(--card-bg)',
        color: 'var(--text-color)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        fontSize: '0.9rem'
    };

    return (
        <div className={`tv-dashboard ${isDark ? 'dark' : ''}`} style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <Toast message={toastMessage} onClose={() => setToastMessage('')} type={toastMessage.includes('succès') || toastMessage.includes('réinitialisée') ? 'success' : 'error'} />

            <header className="tv-header" style={{ marginBottom: '2rem' }}>
                <div className="tv-title" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <Settings size={40} color="var(--primary-color)" />
                    <div>
                        <h1 style={{ margin: 0 }}>Configuration des Cycles de Test</h1>
                        <h2 style={{ margin: 0, opacity: 0.8, fontSize: '1.2rem', fontWeight: 400 }}>Personnalisation Préproduction / Production</h2>
                    </div>
                </div>
            </header>

            <div style={{ backgroundColor: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '2rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', color: '#3B82F6' }}>
                    <Info size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                        <p style={{ margin: '0 0 0.5rem 0' }}><strong>Fonctionnement par défaut (sans configuration) :</strong> La préproduction prend en compte tous les runs de la version. La production prend les runs contenant <i>"patch", "retour de prod", "retour", ou "prod"</i> (peu importe les majuscules).</p>
                        <p style={{ margin: 0 }}><strong>Sélection personnalisée :</strong> Vous pouvez filtrer par Milestone (Jalon) (Max 2 par liste). La production nécessitera toujours la présence d'un des mots-clés ci-dessus dans le nom du run.</p>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                    {/* Préproduction */}
                    <div>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#3B82F6' }}></div>
                            Runs Préproduction (Max 2)
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Filter size={16} color="var(--text-color)" style={{ opacity: 0.7 }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtrer par Jalon</span>
                        </div>
                        <select
                            multiple
                            value={selectedPreprodMilestones.map(String)}
                            onChange={handlePreprodMilestonesChange}
                            style={{ ...filterSelectStyle, height: '100px' }}
                        >
                            {milestones.map(m => (
                                <option key={m.id} value={m.id} style={{ padding: '4px' }}>{m.name}</option>
                            ))}
                        </select>
                        <div style={{ marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
                            {selectedPreprodMilestones.length} jalon(s) sélectionné(s) sur 2 max
                        </div>
                    </div>

                    {/* Production */}
                    <div>
                        <h3 style={{ marginBottom: '1rem', color: 'var(--text-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#10B981' }}></div>
                            Runs Production (Max 2)
                        </h3>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Filter size={16} color="var(--text-color)" style={{ opacity: 0.7 }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filtrer par Jalon</span>
                        </div>
                        <select
                            multiple
                            value={selectedProdMilestones.map(String)}
                            onChange={handleProdMilestonesChange}
                            style={{ ...filterSelectStyle, height: '100px' }}
                        >
                            {milestones.map(m => (
                                <option key={m.id} value={m.id} style={{ padding: '4px' }}>{m.name}</option>
                            ))}
                        </select>
                        <div style={{ marginTop: '-0.5rem', marginBottom: '1rem', fontSize: '0.8rem', opacity: 0.7 }}>
                            {selectedProdMilestones.length} jalon(s) sélectionné(s) sur 2 max
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <button
                        onClick={clearSelection}
                        style={{ padding: '0.75rem 1.5rem', backgroundColor: 'transparent', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)' }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                        Réinitialiser par défaut
                    </button>
                    <button
                        onClick={handleSave}
                        style={{ padding: '0.75rem 1.5rem', backgroundColor: '#3B82F6', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'opacity 0.2s', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)' }}
                        onMouseOver={(e) => { e.currentTarget.style.opacity = '0.9' }}
                        onMouseOut={(e) => { e.currentTarget.style.opacity = '1' }}
                    >
                        <Save size={18} />
                        Appliquer la configuration
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationScreen;
