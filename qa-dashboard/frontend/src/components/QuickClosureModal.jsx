import React, { useState, useEffect } from 'react';
import { X, FileText, Download, Activity, History, Calendar, Layers, Bug, Plus, Trash2 } from 'lucide-react';
import apiService from '../services/api.service';
import { generateQuickClosureDoc } from '../utils/docxGenerator';

const QuickClosureModal = ({ isOpen, onClose, metrics, project, useBusiness, isDark }) => {
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRuns, setSelectedRuns] = useState([]);
    const [isExporting, setIsExporting] = useState(false);

    // Form States
    const [environment, setEnvironment] = useState('Préprod');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [bugs, setBugs] = useState([{ id: 1, desc: '', severity: 'Majeur' }]);

    // Default Dates Calculation
    useEffect(() => {
        if (isOpen && metrics && metrics.runs) {
            if (metrics.runs.length > 0) {
                const allDates = metrics.runs
                    .map(r => new Date(r.created_at))
                    .filter(d => !isNaN(d.getTime()))
                    .sort((a, b) => a - b);
                
                if (allDates.length > 0) {
                    setStartDate(allDates[0].toISOString().split('T')[0]);
                }

                const runsMajorityPassed = metrics.runs
                    .filter(r => r.passRate > 50)
                    .map(r => new Date(r.created_at))
                    .filter(d => !isNaN(d.getTime()))
                    .sort((a, b) => b - a);

                if (runsMajorityPassed.length > 0) {
                    setEndDate(runsMajorityPassed[0].toISOString().split('T')[0]);
                } else if (allDates.length > 0) {
                    setEndDate(allDates[allDates.length - 1].toISOString().split('T')[0]);
                }
            }
        }
    }, [isOpen, metrics]);

    const addBug = () => setBugs([...bugs, { id: Date.now(), desc: '', severity: 'Majeur' }]);
    const removeBug = (id) => setBugs(bugs.filter(b => b.id !== id));
    const updateBug = (id, field, value) => {
        setBugs(bugs.map(b => b.id === id ? { ...b, [field]: value } : b));
    };

    useEffect(() => {
        if (isOpen && project && project.id) {
            const fetchTrends = async () => {
                try {
                    setLoading(true);
                    const response = await apiService.getAnnualTrends(project.id);
                    // On prend les runs, on peut inverser pour avoir les plus récents en premier
                    setTrends([...(response.data || [])].reverse());
                } catch (err) {
                    console.error('Erreur lors du chargement des tendances :', err);
                } finally {
                    setLoading(false);
                }
            };
            fetchTrends();
        }
    }, [isOpen, project]);

    if (!isOpen) return null;

    const handleToggleRun = (run) => {
        setSelectedRuns(prev => {
            if (prev.find(r => r.version === run.version)) {
                return prev.filter(r => r.version !== run.version);
            }
            if (prev.length >= 2) {
                // Remplacer le premier par le nouveau pour garder max 2, ou juste interdire
                return [prev[1], run];
            }
            return [...prev, run];
        });
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const blob = await generateQuickClosureDoc({
                currentMetrics: metrics,
                selectedPastRuns: selectedRuns,
                project: project,
                environment,
                startDate,
                endDate,
                bugs
            });

            // Déclencher le téléchargement
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const safeName = project?.name ? project.name.replace(/\s+/g, '_') : 'Projet';
            a.download = `Quick_Closure_${safeName}_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.docx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            onClose(); // Fermer après l'export
        } catch (error) {
            console.error("Erreur génération:", error);
            alert("Erreur lors de la génération du document DOCX.");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="closure-modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '2rem'
        }}>
            <div className={`closure-modal-content ${isDark ? 'tv-dark-theme' : ''}`} style={{
                backgroundColor: 'var(--bg-color)', width: '100%', maxWidth: '600px',
                maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column'
            }}>
                {/* HEADER */}
                <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--card-bg)' }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.4rem', color: 'var(--text-color)' }}>
                        <FileText size={28} color="#3B82F6" />
                        Quick Clôture ISTQB (DOCX)
                        {metrics?.preprodMilestone && (
                            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                – {metrics.preprodMilestone}
                            </span>
                        )}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                        <X size={28} />
                    </button>
                </div>

                {/* BODY */}
                <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-color)' }}>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        Génère un rapport de clôture de test conforme <strong>ISTQB Foundation v4.0</strong> : périmètre, résultats, critères de sortie, anomalies, risques résiduels, décision Go/No-Go, REX et archivage. Sélectionnez jusqu'à 2 campagnes historiques pour la consolidation LEAN.
                    </p>

                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Layers size={20} color="var(--text-muted)" />
                            Contexte ISTQB
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Environnement</label>
                                <input type="text" value={environment} onChange={e => setEnvironment(e.target.value)} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', outline: 'none', fontSize: '0.95rem' }} />
                            </div>
                            <div>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Date de début</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                    <Calendar size={18} color="var(--text-muted)" />
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '0.95rem' }} />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Date de fin</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                    <Calendar size={18} color="var(--text-muted)" />
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '0.95rem' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Bug size={20} color="#EF4444" />
                                Bugs Majeurs/Critiques Restants
                            </h3>
                            <button onClick={addBug} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', background: '#3B82F6', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                <Plus size={14} /> Ajouter
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: bugs.length > 0 ? '0.75rem' : '0' }}>
                            {bugs.length === 0 && <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun bug critique restant.</div>}
                            {bugs.map((b, i) => (
                                <div key={b.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', width: '20px' }}>{i + 1}.</span>
                                    <input type="text" placeholder="Description du ticket (JIRA/Testmo)..." value={b.desc} onChange={e => updateBug(b.id, 'desc', e.target.value)} style={{ flex: 1, background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '0.4rem 0.6rem', borderRadius: '4px', outline: 'none' }} />
                                    <select value={b.severity} onChange={e => updateBug(b.id, 'severity', e.target.value)} style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '0.4rem 0.6rem', borderRadius: '4px', outline: 'none', width: '120px' }}>
                                        <option value="Critique">Critique</option>
                                        <option value="Majeur">Majeur</option>
                                    </select>
                                    <button onClick={() => removeBug(b.id)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: '0.4rem' }} title="Supprimer">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <History size={20} color="var(--text-muted)" />
                            Historique des Campagnes (Optionnel)
                        </h3>

                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <Activity className="animate-spin" size={24} style={{ margin: '0 auto', display: 'block' }} />
                                <p>Chargement de l'historique...</p>
                            </div>
                        ) : trends.length === 0 ? (
                            <div style={{ padding: '1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Aucun historique trouvé pour ce projet.
                            </div>
                        ) : (
                            <div style={{ 
                                display: 'flex', flexDirection: 'column', gap: '0.5rem', 
                                maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' 
                            }}>
                                {trends.map((trend, idx) => {
                                    const isSelected = selectedRuns.find(r => r.version === trend.version);
                                    return (
                                        <div 
                                            key={idx}
                                            onClick={() => handleToggleRun(trend)}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                border: `2px solid ${isSelected ? '#3B82F6' : 'var(--border-color)'}`,
                                                borderRadius: '8px',
                                                backgroundColor: isSelected ? (isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF') : 'var(--card-bg)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 600, color: isSelected ? '#3B82F6' : 'var(--text-color)' }}>{trend.version}</span>
                                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date : {new Date(trend.date).toLocaleDateString()}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.85rem' }}>
                                                <span>DDP: <strong style={{color: '#10B981'}}>{trend.detectionRate}%</strong></span>
                                                <span>Bugs Test: <strong>{trend.bugsInTest}</strong></span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'right' }}>
                            {selectedRuns.length}/2 sélectionnés
                        </div>
                    </div>
                </div>

                {/* FOOTER ACTIONS */}
                <div style={{ padding: '1.2rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'var(--card-bg)' }}>
                    <button onClick={onClose} disabled={isExporting} style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', opacity: isExporting ? 0.5 : 1 }}>
                        Annuler
                    </button>
                    <button onClick={handleExport} disabled={isExporting} style={{ padding: '0.6rem 1.5rem', background: '#3B82F6', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', opacity: isExporting ? 0.7 : 1 }}>
                        {isExporting ? <Activity size={18} className="spinner" /> : <Download size={18} />}
                        {isExporting ? 'Génération...' : 'Générer DOCX'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuickClosureModal;
