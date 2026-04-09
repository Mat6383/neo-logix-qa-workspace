import React, { useRef } from 'react';
import {
    ShieldAlert, ShieldCheck, Activity, Database, CheckCircle, Bug,
    Download, Layers, CheckSquare, XCircle, BarChart3, TrendingUp, AlertTriangle, Search
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import TestClosureModal from './TestClosureModal';
import QuickClosureModal from './QuickClosureModal';
import ReportGeneratorModal from './ReportGeneratorModal';

const Dashboard4 = ({ metrics, project, projects = [], projectId, onProjectChange, isDark = false, useBusiness = true, setExportHandler, showProductionSection = true, onToggleProductionSection }) => {
    const dashboardRef = useRef(null);
    const [showAllRuns, setShowAllRuns] = React.useState(false);
    const [showClosureModal, setShowClosureModal] = React.useState(false);
    const [showQuickClosureModal, setShowQuickClosureModal] = React.useState(false);
    const [showReportGenerator, setShowReportGenerator] = React.useState(false);

    // Provide the export function to the parent component on mount
    React.useEffect(() => {
        if (setExportHandler) {
            setExportHandler(() => handleExportPDF);
        }
        return () => {
            if (setExportHandler) setExportHandler(null);
        };
    }, [setExportHandler]);

    if (!metrics || !project) {
        return (
            <div className="tv-loading">
                <Activity size={48} className="spinner" />
                <h2>Chargement des données ISTQB...</h2>
            </div>
        );
    }

    // --- Données Dashboard 1 (Métriques globales) ---
    const d1 = metrics;
    const raw = d1.raw || { completed: 0, total: 0, passed: 0, failed: 0, wip: 0, blocked: 0, untested: 0 };
    const runs = d1.runs || [];
    // Runs en premier, sessions exploratoires en dernier
    const sortedRuns = [...runs].sort((a, b) => (a.isExploratory ? 1 : 0) - (b.isExploratory ? 1 : 0));
    // Titre : projet + dernier run non-exploratoire actif
    const latestRun = runs.find(r => !r.isExploratory) || runs[0];
    // --- Données Dashboard 3 (Quality Rates) ---
    const rates = metrics.qualityRates || {
        escapeRate: 0, detectionRate: 0, bugsInProd: 0, bugsInTest: 0, totalBugs: 0,
        preprodMilestone: 'N/A', prodMilestone: 'N/A', message: 'Indisponible'
    };

    const escapeOk = rates.escapeRate < 5;
    const ddpOk = rates.detectionRate > 95;

    const getAlertForMetric = (metricName) => {
        if (!metrics.slaStatus || metrics.slaStatus.ok || !metrics.slaStatus.alerts) return null;
        return metrics.slaStatus.alerts.find(a => a.metric === metricName);
    };

    const getPassRateColor = (passRate) => {
        if (passRate >= 95) return '#10B981';
        if (passRate >= 90) return '#F59E0B';
        return '#EF4444';
    };

    const renderAlert = (alert) => {
        if (!alert) return null;
        return (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', backgroundColor: alert.severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '6px', color: alert.severity === 'warning' ? '#F59E0B' : '#EF4444' }}>
                <AlertTriangle size={16} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.4 }}>
                    {useBusiness ? (
                        alert.message.replace('Pass rate critique:', 'Critique :')
                            .replace('Pass rate en warning:', 'Attention :')
                            .replace('Trop de tests bloqués:', 'Blocages élevés :')
                            .replace('Avancement insuffisant:', 'Retard :')
                    ) : alert.message}
                </span>
            </div>
        );
    };

    const handleExportPDF = async () => {
        const element = dashboardRef.current;
        if (!element) return;

        try {
            // Configuration de html2canvas (pour capturer avec le bon rendu)
            const canvas = await html2canvas(element, {
                scale: 2, // Meilleure qualité
                useCORS: true,
                backgroundColor: isDark ? '#111827' : '#F9FAFB'
            });

            const imgData = canvas.toDataURL('image/png');

            // Configuration PDF
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`QA_Dashboard_${project.name}_${new Date().toLocaleDateString('fr-FR')}.pdf`);
        } catch (error) {
            console.error('Erreur lors de l\'export PDF:', error);
            alert('Erreur lors de la génération du PDF');
        }
    };

    return (
        <div style={{ padding: '0.5rem', width: '100%', margin: '0 auto' }}>

            {/* Sélecteur de projet — hors PDF */}
            {projects.length > 0 && onProjectChange && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-color)' }}>Projet :</span>
                    <select
                        value={projectId}
                        onChange={(e) => onProjectChange(parseInt(e.target.value))}
                        className="project-selector"
                        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}
                    >
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Conteneur principal à exporter en PDF */}
            <div
                ref={dashboardRef}
                className={`tv-dashboard ${isDark ? 'tv-dark-theme' : ''}`}
                style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--bg-color)',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                }}
            >
                <header style={{ display: 'none' }}>
                    {/* Ancien header masqué */}
                </header>

                {/* --- TITRE DYNAMIQUE : Projet — Itération — Run --- */}
                {(project || latestRun) && (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                        marginBottom: '1rem', padding: '0.75rem 1.5rem',
                        backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.06)',
                        borderRadius: '10px', border: '1px solid rgba(59,130,246,0.2)',
                        flexWrap: 'wrap', textAlign: 'center'
                    }}>
                        <span style={{ fontSize: '1.35rem', fontWeight: 700, color: '#3B82F6' }}>
                            {project?.name}
                        </span>
                        {latestRun && (
                            <>
                                <span style={{ color: 'var(--text-muted)', fontSize: '1.35rem' }}>—</span>
                                <span style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--text-color)' }}>
                                    {latestRun.name}
                                </span>
                                <span style={{
                                    padding: '0.2rem 0.65rem', borderRadius: '5px', fontSize: '0.95rem',
                                    fontWeight: 700, textTransform: 'uppercase',
                                    backgroundColor: 'rgba(16,185,129,0.12)', color: '#10B981'
                                }}>
                                    En cours
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* --- SECTION PRÉPRODUCTION --- */}
                <div style={{ marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--text-color)', margin: 0 }}>
                            {useBusiness ? 'PRÉPRODUCTION' : 'PREPROD'}
                        </h2>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={() => setShowClosureModal(true)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                    backgroundColor: '#3B82F6', color: 'white', border: 'none', 
                                    padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600, 
                                    cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#2563EB'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#3B82F6'}
                            >
                                <CheckSquare size={16} /> Clôture de Test
                            </button>
                            <button
                                onClick={() => setShowQuickClosureModal(true)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '0.5rem', 
                                    backgroundColor: '#10B981', color: 'white', border: 'none', 
                                    padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600, 
                                    cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#059669'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#10B981'}
                            >
                                <CheckSquare size={16} /> Quick Clôture DOCX
                            </button>
                            <button
                                onClick={() => setShowReportGenerator(true)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    backgroundColor: '#8B5CF6', color: 'white', border: 'none',
                                    padding: '0.4rem 0.8rem', borderRadius: '6px', fontWeight: 600,
                                    cursor: 'pointer', fontSize: '0.9rem', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.3)',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#7C3AED'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#8B5CF6'}
                            >
                                <CheckSquare size={16} /> Rapport HTML / PPTX
                            </button>
                        </div>
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                    </div>

                    {/* Grille principale Preprod */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>

                        {/* Bloc 1: Taux d'Exécution */}
                        <div className="metric-card" style={{ backgroundColor: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${d1.completionRate >= 90 ? '#10B981' : d1.completionRate >= 80 ? '#F59E0B' : '#EF4444'}`, borderLeftWidth: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                <Activity size={24} color={d1.completionRate >= 90 ? '#10B981' : d1.completionRate >= 80 ? '#F59E0B' : '#EF4444'} />
                                <span style={{ fontWeight: 600, fontSize: '1.4rem', color: 'var(--text-color)' }}>Taux d'Exécution</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: d1.completionRate >= 90 ? '#10B981' : d1.completionRate >= 80 ? '#F59E0B' : '#EF4444' }}>
                                    {d1.completionRate}%
                                </div>
                                <span style={{ fontSize: '1.75rem', color: d1.completionRate >= 90 ? '#10B981' : '#EF4444' }}>
                                    {d1.completionRate >= 90 ? '▲' : '▼'}
                                </span>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '1.05rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ padding: '0.2rem 0.6rem', backgroundColor: d1.completionRate >= 90 ? 'rgba(16,185,129,0.1)' : d1.completionRate >= 80 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: d1.completionRate >= 90 ? '#10B981' : d1.completionRate >= 80 ? '#F59E0B' : '#EF4444', borderRadius: '6px', fontWeight: 600 }}>
                                    {raw.completed} / {raw.total}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{useBusiness ? 'tests exécutés (Cible: ≥ 90%)' : 'tests executed (Target: ≥ 90%)'}</span>
                            </div>
                            {renderAlert(getAlertForMetric('Completion Rate'))}
                        </div>

                        {/* Bloc 2: Taux de Succès */}
                        <div className="metric-card" style={{ backgroundColor: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${d1.passRate >= 95 ? '#10B981' : d1.passRate >= 90 ? '#F59E0B' : '#EF4444'}`, borderLeftWidth: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                <CheckSquare size={24} color={d1.passRate >= 95 ? '#10B981' : d1.passRate >= 90 ? '#F59E0B' : '#EF4444'} />
                                <span style={{ fontWeight: 600, fontSize: '1.4rem', color: 'var(--text-color)' }}>Taux de Succès</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: d1.passRate >= 95 ? '#10B981' : d1.passRate >= 90 ? '#F59E0B' : '#EF4444' }}>
                                    {d1.passRate}%
                                </div>
                                <span style={{ fontSize: '1.75rem', color: d1.passRate >= 95 ? '#10B981' : '#EF4444' }}>
                                    {d1.passRate >= 95 ? '▲' : '▼'}
                                </span>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '1.05rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ padding: '0.2rem 0.6rem', backgroundColor: d1.passRate >= 95 ? 'rgba(16,185,129,0.1)' : d1.passRate >= 90 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: d1.passRate >= 95 ? '#10B981' : d1.passRate >= 90 ? '#F59E0B' : '#EF4444', borderRadius: '6px', fontWeight: 600 }}>
                                    {raw.passed}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{useBusiness ? 'tests réussis (Cible: ≥ 95%)' : 'tests passed (Target: ≥ 95%)'}</span>
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                {useBusiness ? '(Réussis / Total des tests terminés, bloqués ou ignorés)' : '(Passed / Total completed, blocked or skipped)'}
                            </div>
                            {renderAlert(getAlertForMetric('Pass Rate') || getAlertForMetric('Blocked Rate'))}
                        </div>

                        {/* Bloc 3: Taux d'Échec */}
                        <div className="metric-card" style={{ backgroundColor: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${d1.failureRate <= 5 ? '#10B981' : d1.failureRate <= 10 ? '#F59E0B' : '#EF4444'}`, borderLeftWidth: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                <XCircle size={24} color={d1.failureRate <= 5 ? '#10B981' : d1.failureRate <= 10 ? '#F59E0B' : '#EF4444'} />
                                <span style={{ fontWeight: 600, fontSize: '1.4rem', color: 'var(--text-color)' }}>Taux d'Échec</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: d1.failureRate <= 5 ? '#10B981' : d1.failureRate <= 10 ? '#F59E0B' : '#EF4444' }}>
                                    {d1.failureRate}%
                                </div>
                                <span style={{ fontSize: '1.75rem', color: d1.failureRate <= 5 ? '#10B981' : '#EF4444' }}>
                                    {d1.failureRate <= 5 ? '▼' : '▲'} {/* Inversé : Les échecs doivent descendre */}
                                </span>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '1.05rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ padding: '0.2rem 0.6rem', backgroundColor: d1.failureRate <= 5 ? 'rgba(16,185,129,0.1)' : d1.failureRate <= 10 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: d1.failureRate <= 5 ? '#10B981' : d1.failureRate <= 10 ? '#F59E0B' : '#EF4444', borderRadius: '6px', fontWeight: 600 }}>
                                    {raw.failed}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{useBusiness ? 'tests échoués (Cible: ≤ 5%)' : 'tests failed (Target: ≤ 5%)'}</span>
                            </div>
                            {renderAlert(getAlertForMetric('Failure Rate'))}
                        </div>

                        {/* Bloc 4: Efficience */}
                        <div className="metric-card" style={{ backgroundColor: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: `1px solid ${d1.testEfficiency >= 95 ? '#10B981' : d1.testEfficiency >= 90 ? '#F59E0B' : '#EF4444'}`, borderLeftWidth: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                <TrendingUp size={24} color={d1.testEfficiency >= 95 ? '#10B981' : d1.testEfficiency >= 90 ? '#F59E0B' : '#EF4444'} />
                                <span style={{ fontWeight: 600, fontSize: '1.4rem', color: 'var(--text-color)' }}>Efficience des tests</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                                <div style={{ fontSize: '3rem', fontWeight: 800, color: d1.testEfficiency >= 95 ? '#10B981' : d1.testEfficiency >= 90 ? '#F59E0B' : '#EF4444' }}>
                                    {d1.testEfficiency}%
                                </div>
                                <span style={{ fontSize: '1.75rem', color: d1.testEfficiency >= 95 ? '#10B981' : '#EF4444' }}>
                                    {d1.testEfficiency >= 95 ? '▲' : '▼'}
                                </span>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '1.05rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ padding: '0.2rem 0.6rem', backgroundColor: d1.testEfficiency >= 95 ? 'rgba(16,185,129,0.1)' : d1.testEfficiency >= 90 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', color: d1.testEfficiency >= 95 ? '#10B981' : d1.testEfficiency >= 90 ? '#F59E0B' : '#EF4444', borderRadius: '6px', fontWeight: 600 }}>
                                    {useBusiness ? 'Objectif' : 'Target'}
                                </span>
                                <span style={{ color: 'var(--text-muted)' }}>{useBusiness ? 'Approcher les 100% (≥ 95%)' : 'Approach 100% (≥ 95%)'}</span>
                            </div>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                {useBusiness ? '(Réussis / (Réussis + Échoués) purs)' : '(Passed / (Passed + Failed))'}
                            </div>
                            {renderAlert(getAlertForMetric('Test Efficiency'))}
                        </div>
                    </div>

                    {/* Ligne 2 Preprod : Répartition des statuts (Inliné sous les cards) */}
                    <div style={{ backgroundColor: 'var(--card-bg)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '1.5rem', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)', fontWeight: 600, fontSize: '1.3rem', marginRight: '1rem' }}>
                            <BarChart3 size={24} /> Répartition Globale
                        </div>
                        {[
                            { label: useBusiness ? 'Réussis' : 'Passed', val: raw.passed, color: '#10B981' },
                            { label: useBusiness ? 'Échoués' : 'Failed', val: raw.failed, color: '#EF4444' },
                            { label: useBusiness ? 'En cours' : 'WIP', val: raw.wip, color: '#3B82F6' },
                            { label: useBusiness ? 'Bloqués' : 'Blocked', val: raw.blocked, color: '#F59E0B' },
                            { label: useBusiness ? 'Non testés' : 'Untested', val: raw.untested, color: '#9CA3AF' }
                        ].map(stat => (
                            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: stat.color }}></div>
                                <span style={{ fontSize: '1.1rem', color: 'var(--text-color)' }}>{stat.label}:</span>
                                <span style={{ fontWeight: 800, fontSize: '1.35rem', color: 'var(--text-color)' }}>{stat.val}</span>
                            </div>
                        ))}
                    </div>

                    {/* Ligne 3 Preprod : Campagnes Actives */}
                    <div style={{ backgroundColor: 'var(--card-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--text-color)', fontSize: '1.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Database size={24} color="var(--color-primary)" /> Campagnes Actives (Préproduction)
                            </div>
                            
                            {/* Toggle Switch Premium */}
                            <div 
                                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }} 
                                onClick={() => setShowAllRuns(!showAllRuns)}
                            >
                                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: showAllRuns ? 'var(--color-primary)' : 'var(--text-muted)', transition: 'color 0.3s' }}>
                                    {useBusiness ? 'Tout afficher' : 'Show All'}
                                </span>
                                <div style={{ 
                                    width: '48px', 
                                    height: '24px', 
                                    backgroundColor: showAllRuns ? '#10B981' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'), 
                                    borderRadius: '12px', 
                                    position: 'relative',
                                    transition: 'background-color 0.3s ease',
                                    border: showAllRuns ? '1px solid #059669' : '1px solid var(--border-color)',
                                    boxShadow: showAllRuns ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{ 
                                        width: '18px', 
                                        height: '18px', 
                                        backgroundColor: 'white', 
                                        borderRadius: '50%', 
                                        position: 'absolute',
                                        top: '2px',
                                        left: showAllRuns ? '26px' : '2px',
                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        {showAllRuns && <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#10B981' }} />}
                                    </div>
                                </div>
                            </div>
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                            {sortedRuns.slice(0, showAllRuns ? sortedRuns.length : (sortedRuns.length <= 12 ? 12 : 8)).map(run => (
                                <div 
                                    key={run.id} 
                                    title={run.isExploratory ? `${useBusiness ? 'Session' : 'Session'} #${run.id.replace('session-', '')}: ${run.name}` : run.name}
                                    style={{ 
                                        padding: '1rem', 
                                        backgroundColor: run.isExploratory 
                                            ? (isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.05)')
                                            : 'var(--bg-color)', 
                                        borderRadius: '8px', 
                                        border: run.isExploratory 
                                            ? `1px solid ${isDark ? '#8B5CF6' : '#C4B5FD'}` 
                                            : '1px solid var(--border-color)',
                                        borderLeft: run.isExploratory ? `5px solid #8B5CF6` : `1px solid var(--border-color)`,
                                        display: 'flex', 
                                        flexDirection: 'column', 
                                        gap: '0.6rem',
                                        position: 'relative',
                                        boxShadow: run.isExploratory ? '0 4px 12px rgba(139, 92, 246, 0.1)' : 'none',
                                        transition: 'all 0.2s ease',
                                        cursor: run.isExploratory ? 'help' : 'default',
                                        transform: 'scale(1)'
                                    }}
                                    onMouseEnter={run.isExploratory ? (e => e.currentTarget.style.transform = 'scale(1.02)') : undefined}
                                    onMouseLeave={run.isExploratory ? (e => e.currentTarget.style.transform = 'scale(1)') : undefined}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                                        <div style={{ 
                                            fontSize: '1.1rem', 
                                            fontWeight: 600, 
                                            color: 'var(--text-color)', 
                                            whiteSpace: 'nowrap', 
                                            overflow: 'hidden', 
                                            textOverflow: 'ellipsis',
                                            flex: 1
                                        }}>
                                            {run.name}
                                        </div>
                                        {run.isExploratory ? (
                                            <div style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '0.3rem', 
                                                padding: '0.2rem 0.5rem', 
                                                backgroundColor: '#8B5CF6', 
                                                color: 'white', 
                                                borderRadius: '4px', 
                                                fontSize: '0.75rem', 
                                                fontWeight: 800,
                                                textTransform: 'uppercase'
                                            }}>
                                                <Search size={12} />
                                                <span>{useBusiness ? 'Explo' : 'Explo'}</span>
                                            </div>
                                        ) : (
                                            <Database size={16} color="var(--text-muted)" style={{ opacity: 0.5 }} />
                                        )}
                                    </div>
                                    
                                    {/* État de session pour Exploratoire */}
                                    {run.isExploratory && (
                                        <div style={{ fontSize: '0.8rem', color: run.isClosed ? 'var(--text-muted)' : '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: run.isClosed ? '#9CA3AF' : '#10B981' }}></div>
                                            {run.isClosed ? (useBusiness ? 'Session terminée' : 'Closed') : (useBusiness ? 'Session en cours' : 'Active')}
                                        </div>
                                    )}

                                    {/* Progression */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.95rem', marginTop: run.isExploratory ? '0' : '0.4rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Progression</span>
                                        <span style={{ fontWeight: 700, color: 'var(--text-color)' }}>{run.completionRate}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${run.completionRate}%`, height: '100%', backgroundColor: run.isExploratory ? '#8B5CF6' : (run.completionRate >= 90 ? '#10B981' : run.completionRate >= 80 ? '#F59E0B' : '#3B82F6') }}></div>
                                    </div>
 
                                    {/* Taux de succès */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>{useBusiness ? 'Taux de succès' : 'Pass Rate'}</span>
                                        <span style={{ fontWeight: 700, color: getPassRateColor(run.passRate) }}>{run.passRate}%</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${run.passRate}%`, height: '100%', backgroundColor: getPassRateColor(run.passRate) }}></div>
                                    </div>
                                </div>
                            ))}
                            {sortedRuns.length > 12 && !showAllRuns && (
                                <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '1.1rem', fontStyle: 'italic', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                                    + {sortedRuns.length - 8} {useBusiness ? 'autres campagnes...' : 'other campaigns...'}
                                </div>
                            )}
                        </div>
                    </div>
                </div> {/* Fin Section Preprod */}

                {/* --- SECTION PRODUCTION --- */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h2 style={{ fontSize: '1.35rem', color: 'var(--text-color)', margin: 0 }}>
                            {useBusiness ? 'PRODUCTION' : 'PRODUCTION'}
                        </h2>
                        {onToggleProductionSection && (
                            <div
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => onToggleProductionSection(!showProductionSection)}
                            >
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: showProductionSection ? '#10B981' : 'var(--text-muted)', transition: 'color 0.3s' }}>
                                    {showProductionSection ? 'Visible' : 'Masqué'}
                                </span>
                                <div style={{
                                    width: '44px',
                                    height: '22px',
                                    backgroundColor: showProductionSection ? '#10B981' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                                    borderRadius: '11px',
                                    position: 'relative',
                                    transition: 'background-color 0.3s ease',
                                    border: showProductionSection ? '1px solid #059669' : '1px solid var(--border-color)',
                                    boxShadow: showProductionSection ? '0 0 8px rgba(16, 185, 129, 0.3)' : 'inset 0 2px 4px rgba(0,0,0,0.05)'
                                }}>
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        backgroundColor: 'white',
                                        borderRadius: '50%',
                                        position: 'absolute',
                                        top: '2px',
                                        left: showProductionSection ? '24px' : '2px',
                                        transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                                    }} />
                                </div>
                            </div>
                        )}
                        <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
                    </div>

                    {showProductionSection && <>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.75rem', marginBottom: '0.5rem' }}>

                        {/* Escape Rate */}
                        <div style={{ 
                            backgroundColor: 'var(--card-bg)', 
                            padding: '1.25rem', 
                            borderRadius: '12px', 
                            border: `2px solid ${escapeOk ? '#10B981' : '#EF4444'}`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            borderLeftWidth: '8px'
                        }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)', fontSize: '1.25rem' }}>
                                    <ShieldAlert size={24} color={escapeOk ? '#10B981' : '#EF4444'} /> Taux d'Échappement
                                </h3>
                                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span>{useBusiness ? 'Jalon' : 'Milestone'}: <strong style={{ color: 'var(--text-color)' }}>{rates.prodMilestone}</strong></span>
                                    <span>{useBusiness ? 'Objectif' : 'Target'}: <strong style={{ color: escapeOk ? '#10B981' : '#EF4444' }}>&lt; 5%</strong></span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: escapeOk ? '#10B981' : '#EF4444', lineHeight: 1 }}>
                                    {rates.escapeRate}%
                                </div>
                                <div style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.25rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '4px' }}>
                                    {rates.bugsInProd} {useBusiness ? 'bugs prod' : 'prod bugs'}
                                </div>
                            </div>
                        </div>

                        {/* Detection Rate (DDP) */}
                        <div style={{ 
                            backgroundColor: 'var(--card-bg)', 
                            padding: '1.25rem', 
                            borderRadius: '12px', 
                            border: `2px solid ${ddpOk ? '#10B981' : '#EF4444'}`, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'space-between',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            borderLeftWidth: '8px'
                        }}>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-color)', fontSize: '1.25rem' }}>
                                    <ShieldCheck size={24} color={ddpOk ? '#10B981' : '#EF4444'} /> Taux de Détection
                                </h3>
                                <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                    <span>{useBusiness ? 'Lié' : 'Linked'}: <strong style={{ color: 'var(--text-color)' }}>{rates.prodMilestone}</strong></span>
                                    <span>{useBusiness ? 'Objectif' : 'Target'}: <strong style={{ color: ddpOk ? '#10B981' : '#EF4444' }}>&gt; 95%</strong></span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: ddpOk ? '#10B981' : '#EF4444', lineHeight: 1 }}>
                                    {rates.detectionRate}%
                                </div>
                                <div style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '0.25rem', padding: '0.2rem 0.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '4px' }}>
                                    {rates.bugsInTest} {useBusiness ? 'bugs test' : 'test bugs'}
                                </div>
                            </div>
                        </div>
                    </div>

                    </>}
                </div> {/* Fin Section Prod */}
            </div>
            
            {/* Modal de Clôture */}
            <TestClosureModal
                isOpen={showClosureModal}
                onClose={() => setShowClosureModal(false)}
                metrics={metrics}
                project={project}
                useBusiness={useBusiness}
                isDark={isDark}
            />

            <QuickClosureModal
                isOpen={showQuickClosureModal}
                onClose={() => setShowQuickClosureModal(false)}
                metrics={metrics}
                project={project}
                useBusiness={useBusiness}
                isDark={isDark}
            />

            <ReportGeneratorModal
                isOpen={showReportGenerator}
                onClose={() => setShowReportGenerator(false)}
                metrics={metrics}
                project={project}
                isDark={isDark}
            />
        </div>
    );
};

export default Dashboard4;
