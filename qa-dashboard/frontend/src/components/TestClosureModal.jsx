import React, { useState, useEffect, useRef } from 'react';
import { 
  X, AlertTriangle, CheckCircle, Bug, FileText, Download,
  Calendar, Layers, ShieldCheck, Activity, Plus, Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import '../styles/MetricsCards.css';

const TestClosureModal = ({ isOpen, onClose, metrics, project, useBusiness, isDark }) => {
  // === Form States ===
  const [version, setVersion] = useState('');
  const [environment, setEnvironment] = useState('Préprod');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [decision, setDecision] = useState('GO_PRODUCTION');
  const [residualRisks, setResidualRisks] = useState('');
  const [signOffs, setSignOffs] = useState('');
  const [bugs, setBugs] = useState([{ id: 1, desc: '', severity: 'Majeur' }]);

  const [isExporting, setIsExporting] = useState(false);
  const pdfRefExec = useRef(null);
  const pdfRefDetails = useRef(null);

  // === Default Values Calculation (Version & Dates) ===
  useEffect(() => {
    if (isOpen && metrics && metrics.runs) {
      // 1. Version Logic
      const standardRuns = metrics.runs.filter(r => !r.isExploratory);
      if (standardRuns.length > 0) {
        // Extraire un pattern comme R06, R06j, R02, etc. depuis le nom du run
        const versionRegex = /R\d+[a-zA-Z]?/gi;
        let versionsFound = [];
        
        standardRuns.forEach(r => {
          const matches = r.name.match(versionRegex);
          if (matches) {
            versionsFound.push(...matches);
          } else {
            versionsFound.push(r.name);
          }
        });

        // Tri intelligent (lettres identiques = tri sur chiffres)
        versionsFound.sort((a, b) => {
          return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
        });
        
        const highestVersion = versionsFound.length > 0 ? versionsFound[versionsFound.length - 1] : '';
        setVersion(highestVersion);
      } else {
        setVersion('');
      }

      // 2. Dates Logic
      if (metrics.runs.length > 0) {
        // Start date: earliest run
        const allDates = metrics.runs
          .map(r => new Date(r.created_at))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a - b);
          
        if (allDates.length > 0) {
          setStartDate(allDates[0].toISOString().split('T')[0]);
        }

        // End date: last run with majority of test cases passed (passRate > 50)
        // Ensure standard Runs first if needed, but user says "dernier run une fois une majorité... passed"
        const runsMajorityPassed = metrics.runs
          .filter(r => r.passRate > 50)
          .map(r => new Date(r.created_at))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => b - a); // Descending

        if (runsMajorityPassed.length > 0) {
          setEndDate(runsMajorityPassed[0].toISOString().split('T')[0]);
        } else if (allDates.length > 0) {
          // Fallback: very last run overall
          setEndDate(allDates[allDates.length - 1].toISOString().split('T')[0]);
        }
      }
    }
  }, [isOpen, metrics]);

  if (!isOpen) return null;

  // === Bug List Handlers ===
  const addBug = () => setBugs([...bugs, { id: Date.now(), desc: '', severity: 'Majeur' }]);
  const removeBug = (id) => setBugs(bugs.filter(b => b.id !== id));
  const updateBug = (id, field, value) => {
    setBugs(bugs.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  // === Export Logic ===
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportPDF(pdfRefExec.current, `1_Executive_Summary_${project?.name}_${version}.pdf`);
      await exportPDF(pdfRefDetails.current, `2_Rapport_Detaille_${project?.name}_${version}.pdf`);
      onClose(); // Fermer après l'export
    } catch (error) {
      console.error("Erreur lors de l'export PDF:", error);
      alert("Erreur lors de la génération des PDF");
    } finally {
      setIsExporting(false);
    }
  };

  const exportPDF = async (element, filename) => {
    if (!element) return;
    
    // Rendre l'élément visible le temps de la capture
    const originalDisplay = element.style.display;
    element.style.display = 'block';
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#FFFFFF', // PDF toujours sur fond blanc
      logging: false
    });
    
    element.style.display = originalDisplay; // Restaurer

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    let heightLeft = pdfHeight;
    let position = 0;
    
    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pdf.internal.pageSize.getHeight();
    
    while (heightLeft >= 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();
    }
    
    pdf.save(filename);
  };

  const m = metrics || { completionRate: 0, passRate: 0, failureRate: 0, testEfficiency: 0 };
  
  // Style dynamique selon le thème et la décision
  const isGo = decision === 'GO_PRODUCTION';
  const isGoReserve = decision === 'GO_RESERVE';
  const decisionColor = isGo ? '#10B981' : isGoReserve ? '#F59E0B' : '#EF4444';

  const commonPDFStyle = {
    position: 'absolute', left: '-9999px', top: 0, width: '210mm', minHeight: '297mm',
    backgroundColor: '#FFFFFF', color: '#111827', padding: '20mm', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box'
  };

  return (
    <>
      <div className="closure-modal-overlay" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem'
      }}>
        <div className={`closure-modal-content ${isDark ? 'tv-dark-theme' : ''}`} style={{
          backgroundColor: 'var(--bg-color)', width: '100%', maxWidth: '850px',
          maxHeight: '90vh', overflowY: 'auto', borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column'
        }}>
          {/* HEADER */}
          <div style={{ padding: '1.2rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--card-bg)' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.4rem' }}>
              <FileText size={28} color="var(--color-primary)" />
              {useBusiness ? 'Bilan de Clôture de Test (ISTQB)' : 'Test Summary Report'}
            </h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={28} />
            </button>
          </div>

          {/* BODY */}
          <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* ROW 1: Context */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Version ({useBusiness ? 'Détectée' : 'Detected'})</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <Layers size={18} color="var(--text-muted)" />
                  <input type="text" value={version} onChange={e => setVersion(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '1rem', fontWeight: 600 }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Environnement</label>
                <input type="text" value={environment} onChange={e => setEnvironment(e.target.value)} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', outline: 'none', fontSize: '1rem' }} />
              </div>
            </div>

            {/* ROW 2: Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Date de début (1er run)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <Calendar size={18} color="var(--text-muted)" />
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '1rem' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>Date de fin (Dernier validé)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--card-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <Calendar size={18} color="var(--text-muted)" />
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--text-color)', width: '100%', outline: 'none', fontSize: '1rem' }} />
                </div>
              </div>
            </div>

            {/* Read-Only KPIs */}
            <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
              <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem', textTransform: 'uppercase' }}>Rappel des Métriques Globales</div>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Exécution</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: m.completionRate >= 90 ? '#10B981' : '#F59E0B' }}>{m.completionRate}%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Succès</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: m.passRate >= 95 ? '#10B981' : '#EF4444' }}>{m.passRate}%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Échecs</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 700, color: m.failureRate <= 5 ? '#10B981' : '#EF4444' }}>{m.failureRate}%</span>
                </div>
              </div>
            </div>

            {/* Bugs Restants */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bug size={18} color="#EF4444" /> Bugs Majeurs/Critiques restants (Known Issues)
                </label>
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

            {/* Décision GO/NOGO */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
                <ShieldCheck size={18} color={decisionColor} /> Recommandation Principale
              </label>
              <select value={decision} onChange={e => setDecision(e.target.value)} style={{ width: '100%', background: 'var(--card-bg)', border: `2px solid ${decisionColor}`, color: 'var(--text-color)', padding: '0.6rem 0.75rem', borderRadius: '6px', outline: 'none', fontSize: '1rem', fontWeight: 600 }}>
                <option value="GO_PRODUCTION">🟢 GO PRODUCTION (Pas de risques bloquants)</option>
                <option value="GO_RESERVE">🟠 GO SOUS RÉSERVE (Limites assumées)</option>
                <option value="NO_GO">🔴 NO-GO (Qualité insuffisante)</option>
              </select>
            </div>

            {/* Risques Résiduels */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>
                <AlertTriangle size={18} color="#F59E0B" /> Écarts & Risques Résiduels
              </label>
              <textarea 
                placeholder="Renseignez les impacts métier, les limitations de couverture, etc..."
                value={residualRisks} onChange={e => setResidualRisks(e.target.value)}
                style={{ width: '100%', minHeight: '80px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '0.6rem 0.75rem', borderRadius: '6px', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }} 
              />
            </div>

            {/* Sign-off */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '1rem' }}>Signatures & Parties Prenantes (Sign-off)</label>
              <textarea 
                placeholder={`Product Owner: Jane Doe\nTech Lead: John Smith\nQA Lead: Matou`}
                value={signOffs} onChange={e => setSignOffs(e.target.value)}
                style={{ width: '100%', minHeight: '80px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-color)', padding: '0.6rem 0.75rem', borderRadius: '6px', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }} 
              />
            </div>
          </div>

          {/* FOOTER ACTIONS */}
          <div style={{ padding: '1.2rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: 'var(--card-bg)' }}>
            <button onClick={onClose} disabled={isExporting} style={{ padding: '0.6rem 1.2rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-color)', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', opacity: isExporting ? 0.5 : 1 }}>
              Annuler
            </button>
            <button onClick={handleExport} disabled={isExporting} style={{ padding: '0.6rem 1.5rem', background: 'var(--color-primary)', border: 'none', color: 'white', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', opacity: isExporting ? 0.7 : 1 }}>
              {isExporting ? <Activity size={18} className="spinner" /> : <Download size={18} />}
              {isExporting ? 'Génération...' : 'Valider & Exporter (PDF)'}
            </button>
          </div>
        </div>
      </div>

      {/* =========================================
          PDF HIDDEN TEMPLATES 
          ========================================= */}
      
      {/* FORMAT 1: EXECUTIVE SUMMARY */}
      <div ref={pdfRefExec} style={{ ...commonPDFStyle, display: 'none' }}>
        <div style={{ borderBottom: '3px solid #111827', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24pt', color: '#111827' }}>Rapport Exécutif de Clôture</h1>
            <h2 style={{ margin: 0, fontSize: '14pt', color: '#4B5563', fontWeight: 'normal' }}>Projet: {project?.name} | Version: {version}</h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6B7280' }}>
            Date du rapport: {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>

        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#F3F4F6', borderRadius: '8px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '12pt', color: '#111827' }}>Contexte de Test</h3>
          <p style={{ margin: '0 0 5px 0', fontSize: '10pt' }}><strong>Environnement :</strong> {environment}</p>
          <p style={{ margin: '0 0 5px 0', fontSize: '10pt' }}><strong>Période :</strong> Du {startDate} au {endDate}</p>
        </div>

        <div style={{ marginBottom: '20px', backgroundColor: isGo ? '#ECFDF5' : isGoReserve ? '#FFFBEB' : '#FEF2F2', padding: '20px', borderRadius: '8px', borderLeft: `6px solid ${decisionColor}` }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '16pt', color: decisionColor }}>
            RECOMMANDATION : {decision.replace('_', ' ')}
          </h2>
          {residualRisks && (
            <div>
              <strong style={{ fontSize: '10pt' }}>Écarts & Risques Assumés :</strong>
              <p style={{ margin: '5px 0 0 0', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>{residualRisks}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>Taux d'Exécution</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.completionRate >= 90 ? '#10B981' : '#F59E0B' }}>{m.completionRate}%</div>
          </div>
          <div style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>Taux de Succès</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.passRate >= 95 ? '#10B981' : '#EF4444' }}>{m.passRate}%</div>
          </div>
          <div style={{ flex: 1, padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '10pt', color: '#6B7280', textTransform: 'uppercase' }}>Taux d'Échec</div>
            <div style={{ fontSize: '24pt', fontWeight: 'bold', color: m.failureRate <= 5 ? '#10B981' : '#EF4444' }}>{m.failureRate}%</div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', fontSize: '14pt' }}>Bugs Majeurs Restants ({bugs.filter(b => b.desc.trim()).length})</h3>
          {bugs.filter(b => b.desc.trim()).length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6B7280' }}>Aucune anomalie critique ou majeure ouverte.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>Sévérité</th>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {bugs.filter(b => b.desc.trim()).map(b => (
                  <tr key={b.id}>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', color: b.severity === 'Critique' ? '#EF4444' : '#F59E0B', fontWeight: 'bold' }}>{b.severity}</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{b.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '40px' }}>
          <h3 style={{ fontSize: '12pt', color: '#111827', marginBottom: '10px' }}>Sign-off / Approbations</h3>
          <div style={{ padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', minHeight: '80px', fontSize: '10pt', whiteSpace: 'pre-wrap' }}>
            {signOffs || "Non renseigné."}
          </div>
        </div>
      </div>

      {/* FORMAT 2: DETAILED REPORT */}
      <div ref={pdfRefDetails} style={{ ...commonPDFStyle, display: 'none' }}>
        <div style={{ borderBottom: '3px solid #111827', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ margin: '0 0 5px 0', fontSize: '24pt', color: '#111827' }}>Rapport Détaillé de Clôture</h1>
            <h2 style={{ margin: 0, fontSize: '14pt', color: '#4B5563', fontWeight: 'normal' }}>Projet: {project?.name} | Version: {version}</h2>
          </div>
          <div style={{ textAlign: 'right', fontSize: '10pt', color: '#6B7280' }}>
            Période : {startDate} - {endDate}
          </div>
        </div>

        {/* Détail des sessions/runs */}
        <h3 style={{ fontSize: '14pt', borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', marginTop: '20px', marginBottom: '15px' }}>Inventaire des Campagnes Exécutées</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ backgroundColor: '#F3F4F6' }}>
              <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>Nom de la Campagne</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>Type</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>Progression</th>
              <th style={{ padding: '8px', textAlign: 'center', border: '1px solid #E5E7EB' }}>Succès</th>
            </tr>
          </thead>
          <tbody>
            {(m.runs || []).map(r => (
              <tr key={r.id}>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{r.name}</td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>
                  {r.isExploratory ? 'Exploratoire' : 'Scénarisée'}
                </td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center' }}>{r.completionRate}%</td>
                <td style={{ padding: '8px', border: '1px solid #E5E7EB', textAlign: 'center', color: r.passRate >= 90 ? '#10B981' : '#EF4444' }}>{r.passRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Reprise de la grille des Bugs du rapport 1 */}
        <div style={{ marginTop: '30px', pageBreakInside: 'avoid' }}>
          <h3 style={{ borderBottom: '1px solid #E5E7EB', paddingBottom: '5px', fontSize: '14pt' }}>Bugs Majeurs Restants ({bugs.filter(b => b.desc.trim()).length})</h3>
          {bugs.filter(b => b.desc.trim()).length === 0 ? (
            <p style={{ fontSize: '10pt', color: '#6B7280' }}>Aucune anomalie critique ou majeure ouverte.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10pt' }}>
              <thead>
                <tr style={{ backgroundColor: '#F3F4F6' }}>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>Sévérité</th>
                  <th style={{ padding: '8px', textAlign: 'left', border: '1px solid #E5E7EB' }}>Description</th>
                </tr>
              </thead>
              <tbody>
                {bugs.filter(b => b.desc.trim()).map(b => (
                  <tr key={b.id}>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB', color: b.severity === 'Critique' ? '#EF4444' : '#F59E0B', fontWeight: 'bold' }}>{b.severity}</td>
                    <td style={{ padding: '8px', border: '1px solid #E5E7EB' }}>{b.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '30px', backgroundColor: isGo ? '#ECFDF5' : isGoReserve ? '#FFFBEB' : '#FEF2F2', padding: '15px', borderRadius: '8px', borderLeft: `6px solid ${decisionColor}`, pageBreakInside: 'avoid' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '14pt', color: decisionColor }}>
            RECOMMANDATION : {decision.replace('_', ' ')}
          </h2>
          <p style={{ margin: '0', fontSize: '9pt', whiteSpace: 'pre-wrap' }}>
            {residualRisks || "Pas de risques résiduels renseignés."}
          </p>
        </div>

        <div style={{ marginTop: '30px' }}>
          <h3 style={{ fontSize: '12pt', color: '#111827', marginBottom: '10px' }}>Approbations</h3>
          <div style={{ padding: '15px', border: '1px solid #E5E7EB', borderRadius: '8px', minHeight: '60px', fontSize: '9pt', whiteSpace: 'pre-wrap' }}>
            {signOffs || "Non renseigné."}
          </div>
        </div>

      </div>
    </>
  );
};

export default TestClosureModal;
