import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { TrendingUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import apiService from '../services/api.service';
import '../styles/MetricsTrendChart.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const METRICS = [
  { key: 'pass_rate', label: 'Pass Rate', color: '#22c55e' },
  { key: 'completion_rate', label: 'Completion Rate', color: '#3b82f6' },
  { key: 'test_efficiency', label: 'Test Efficiency', color: '#f59e0b' },
];

export default function MetricsTrendChart({ projectId, isDark, limit = 30 }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getMetricsHistory(projectId, limit);
      setSnapshots(res.data || []);
    } catch (err) {
      setError('Impossible de charger l\'historique des métriques.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId, limit]);

  if (loading) {
    return (
      <div className={`mtc-root mtc-center${isDark ? ' dark' : ''}`}>
        <Loader2 className="mtc-spin" size={20} />
        <span>Chargement de l'historique…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`mtc-root mtc-center${isDark ? ' dark' : ''}`}>
        <AlertCircle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  if (snapshots.length < 2) {
    return (
      <div className={`mtc-root mtc-center${isDark ? ' dark' : ''}`}>
        <TrendingUp size={18} />
        <span>
          {snapshots.length === 0
            ? 'Aucun historique disponible — les données seront enregistrées automatiquement.'
            : 'Un seul snapshot disponible — revenez demain pour voir les tendances.'}
        </span>
      </div>
    );
  }

  const labels = snapshots.map((s) => {
    const d = new Date(s.snapshot_date);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  });

  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const tickColor = isDark ? '#94a3b8' : '#64748b';

  const data = {
    labels,
    datasets: METRICS.map((m) => ({
      label: m.label,
      data: snapshots.map((s) => s[m.key] ?? null),
      borderColor: m.color,
      backgroundColor: m.color + '20',
      fill: false,
      tension: 0.35,
      pointRadius: snapshots.length > 20 ? 2 : 4,
      pointHoverRadius: 6,
      spanGaps: true,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: tickColor, boxWidth: 12, padding: 16 },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? 'N/A'}%`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: tickColor, maxRotation: 45 },
        grid: { color: gridColor },
      },
      y: {
        min: 0,
        max: 100,
        ticks: {
          color: tickColor,
          callback: (v) => v + '%',
        },
        grid: { color: gridColor },
      },
    },
  };

  return (
    <div className={`mtc-root${isDark ? ' dark' : ''}`}>
      <div className="mtc-header">
        <TrendingUp size={16} />
        <span>Tendances ISTQB — {snapshots.length} snapshots</span>
        <button className="mtc-refresh" onClick={load} title="Rafraîchir">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="mtc-chart">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
