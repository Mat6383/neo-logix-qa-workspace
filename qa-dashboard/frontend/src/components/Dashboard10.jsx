import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Loader2, AlertCircle } from 'lucide-react';
import apiService from '../services/api.service';

const METRICS = [
  { key: 'passRate', label: 'Pass Rate', higherIsBetter: true },
  { key: 'completionRate', label: 'Completion Rate', higherIsBetter: true },
  { key: 'failureRate', label: 'Failure Rate', higherIsBetter: false },
  { key: 'testEfficiency', label: 'Test Efficiency', higherIsBetter: true },
];

function Delta({ a, b, higherIsBetter }) {
  const delta = b - a;
  const isImprovement = higherIsBetter ? delta > 0 : delta < 0;
  const color = delta === 0 ? '#6B7280' : isImprovement ? '#10B981' : '#EF4444';
  const sign = delta > 0 ? '+' : '';
  return (
    <span style={{ color, fontWeight: 700, fontSize: '0.9rem' }}>
      {sign}{delta.toFixed(2)}%
    </span>
  );
}

function MetricRow({ label, valA, valB, higherIsBetter }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.9rem' }}>{label}</span>
      <span style={{ textAlign: 'center', color: 'var(--text-color)' }}>{valA !== null ? `${valA.toFixed(2)}%` : '—'}</span>
      <span style={{ textAlign: 'center', color: 'var(--text-color)' }}>{valB !== null ? `${valB.toFixed(2)}%` : '—'}</span>
      <span style={{ textAlign: 'center' }}>
        {valA !== null && valB !== null
          ? <Delta a={valA} b={valB} higherIsBetter={higherIsBetter} />
          : '—'}
      </span>
    </div>
  );
}

const Dashboard10 = ({ projectId, isDark }) => {
  const [milestones, setMilestones] = useState([]);
  const [milestoneA, setMilestoneA] = useState('');
  const [milestoneB, setMilestoneB] = useState('');
  const [metricsA, setMetricsA] = useState(null);
  const [metricsB, setMetricsB] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadingMilestones, setLoadingMilestones] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoadingMilestones(true);
    apiService.getProjectMilestones(projectId)
      .then(data => setMilestones(data.result || []))
      .catch(() => setMilestones([]))
      .finally(() => setLoadingMilestones(false));
  }, [projectId]);

  useEffect(() => {
    if (!milestoneA || !milestoneB) return;
    setLoading(true);
    setError(null);
    Promise.all([
      apiService.getDashboardMetrics(projectId, [parseInt(milestoneA)], null),
      apiService.getDashboardMetrics(projectId, [parseInt(milestoneB)], null),
    ])
      .then(([resA, resB]) => {
        setMetricsA(resA.globalMetrics || null);
        setMetricsB(resB.globalMetrics || null);
      })
      .catch(err => setError(err.message || 'Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [milestoneA, milestoneB, projectId]);

  const selectStyle = {
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    border: '1px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-color)',
    fontSize: '0.9rem',
    minWidth: '200px',
  };

  const nameA = milestones.find(m => m.id === parseInt(milestoneA))?.name || 'Jalon A';
  const nameB = milestones.find(m => m.id === parseInt(milestoneB))?.name || 'Jalon B';

  return (
    <div style={{ padding: '1.5rem', color: 'var(--text-color)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <ArrowLeftRight size={28} color="#3B82F6" />
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
          Comparaison inter-milestones
        </h2>
      </div>

      {/* Sélecteurs */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.7 }}>
            Jalon A (référence)
          </label>
          {loadingMilestones
            ? <span style={{ opacity: 0.5 }}>Chargement…</span>
            : (
              <select value={milestoneA} onChange={e => setMilestoneA(e.target.value)} style={selectStyle}>
                <option value="">— Sélectionner —</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.4rem', opacity: 0.7 }}>
            Jalon B (comparaison)
          </label>
          {loadingMilestones
            ? <span style={{ opacity: 0.5 }}>Chargement…</span>
            : (
              <select value={milestoneB} onChange={e => setMilestoneB(e.target.value)} style={selectStyle}>
                <option value="">— Sélectionner —</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            )}
        </div>
      </div>

      {/* État vide */}
      {!milestoneA || !milestoneB ? (
        <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>
          <ArrowLeftRight size={48} style={{ marginBottom: '1rem' }} />
          <p style={{ fontSize: '1.1rem' }}>Sélectionnez deux jalons pour comparer leurs métriques.</p>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader2 className="animate-spin" size={40} />
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#EF4444' }}>
          <AlertCircle size={40} />
          <p>{error}</p>
        </div>
      ) : metricsA && metricsB ? (
        <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '10px', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
          {/* En-tête du tableau */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase' }}>Métrique</span>
            <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#3B82F6' }}>{nameA}</span>
            <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#8B5CF6' }}>{nameB}</span>
            <span style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', opacity: 0.6, textTransform: 'uppercase' }}>Delta (B−A)</span>
          </div>

          {METRICS.map(({ key, label, higherIsBetter }) => (
            <MetricRow
              key={key}
              label={label}
              valA={metricsA[key] ?? null}
              valB={metricsB[key] ?? null}
              higherIsBetter={higherIsBetter}
            />
          ))}

          {/* Ligne total tests */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.5rem', alignItems: 'center', padding: '0.75rem 0' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-color)', fontSize: '0.9rem' }}>Total Tests</span>
            <span style={{ textAlign: 'center', color: 'var(--text-color)' }}>{metricsA.totalTests ?? '—'}</span>
            <span style={{ textAlign: 'center', color: 'var(--text-color)' }}>{metricsB.totalTests ?? '—'}</span>
            <span style={{ textAlign: 'center', color: '#6B7280', fontWeight: 700 }}>
              {metricsA.totalTests != null && metricsB.totalTests != null
                ? (metricsB.totalTests - metricsA.totalTests > 0 ? '+' : '') + (metricsB.totalTests - metricsA.totalTests)
                : '—'}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Dashboard10;
