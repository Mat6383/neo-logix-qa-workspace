/**
 * ================================================
 * METRICS CARDS COMPONENT
 * ================================================
 * Affichage des KPIs ISTQB en cartes
 * 
 * Standards ISTQB:
 * - Test Completion Rate
 * - Test Pass Rate
 * - Defect Detection Rate
 * - Test Efficiency
 * 
 * @author Matou - Neo-Logix QA Lead
 */

import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, XCircle, Clock } from 'lucide-react';
import '../styles/MetricsCards.css';

const MetricsCards = ({ metrics, useBusiness }) => {
  if (!metrics) {
    return (
      <div className="metrics-loading">
        <Clock className="spinner" />
        <p>Chargement des métriques...</p>
      </div>
    );
  }

  const getAlertForMetric = (metricName) => {
    if (!metrics.slaStatus || metrics.slaStatus.ok) return null;
    return metrics.slaStatus.alerts.find(a => a.metric === metricName);
  };

  const cards = [
    {
      title: useBusiness ? 'Taux d\'Exécution' : 'Completion Rate',
      subtitle: useBusiness ? 'ISTQB : Progression des tests' : 'ISTQB: Test Progress',
      value: `${metrics.completionRate}%`,
      total: `${metrics.raw.completed} / ${metrics.raw.total}`,
      target: '≥ 90%',
      icon: Clock,
      color: getColorByThreshold(metrics.completionRate, 90, 80),
      trend: metrics.completionRate >= 90 ? 'up' : 'down',
      description: useBusiness ? 'Tests exécutés vs total' : 'Tests executed vs total',
      alert: getAlertForMetric('Completion Rate')
    },
    {
      title: useBusiness ? 'Taux de Succès' : 'Pass Rate',
      subtitle: useBusiness ? 'ISTQB : Qualité des tests' : 'ISTQB: Test Quality',
      value: `${metrics.passRate}%`,
      total: `${metrics.raw.passed} ${useBusiness ? 'tests' : 'tests'}`,
      target: '≥ 95%',
      icon: CheckCircle2,
      color: getColorByThreshold(metrics.passRate, 95, 90),
      trend: metrics.passRate >= 95 ? 'up' : 'down',
      description: useBusiness ? 'Tests réussis / (Réussis + Échoués + Bloqués + Ignorés)' : 'Passed / Completed (Passed + Failed + Blocked + Skipped)',
      alert: getAlertForMetric('Pass Rate') || getAlertForMetric('Blocked Rate') // On affiche l'alerte de blocage ici aussi s'il n'y a pas d'alerte de succès
    },
    {
      title: useBusiness ? 'Taux d\'Échec' : 'Failure Rate',
      subtitle: useBusiness ? 'ISTQB : Détection des défauts' : 'ISTQB: Defect Detection',
      value: `${metrics.failureRate}%`,
      total: `${metrics.raw.failed} ${useBusiness ? 'défauts' : 'defects'}`,
      target: '≤ 5%',
      icon: XCircle,
      color: getColorForFailure(metrics.failureRate),
      trend: metrics.failureRate > 5 ? 'down' : 'up',
      description: useBusiness ? 'Tests échoués détectés' : 'Failed tests detected',
      alert: getAlertForMetric('Failure Rate')
    },
    {
      title: useBusiness ? 'Efficience des Tests' : 'Test Efficiency',
      subtitle: useBusiness ? 'LEAN : Efficacité QA' : 'LEAN: QA Efficiency',
      value: `${metrics.testEfficiency}%`,
      total: `${metrics.raw.passed + metrics.raw.failed} tests`,
      target: '≥ 95%',
      icon: TrendingUp,
      color: getColorByThreshold(metrics.testEfficiency, 95, 90),
      trend: metrics.testEfficiency >= 95 ? 'up' : 'down',
      description: useBusiness ? 'Tests réussis / (Réussis + Échoués)' : 'Passed / (Passed + Failed)',
      alert: getAlertForMetric('Test Efficiency')
    }
  ];

  return (
    <div className="metrics-container">
      {cards.map((card, index) => (
        <MetricCard key={index} {...card} useBusiness={useBusiness} />
      ))}
    </div>
  );
};

/**
 * Carte de métrique individuelle
 */
const MetricCard = ({ title, subtitle, value, total, target, icon: Icon, color, trend, description, alert, useBusiness }) => {
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend === 'up' ? '#10B981' : '#EF4444';

  return (
    <div className="metric-card" style={{ borderLeftColor: alert ? (alert.severity === 'warning' ? '#F59E0B' : '#EF4444') : color }}>
      <div className="card-header">
        <div className="card-title">
          <h3>{title}</h3>
          <span className="subtitle" style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{subtitle}</span>
        </div>
        <div className="card-icon" style={{ backgroundColor: `${color}20`, padding: '10px', borderRadius: '50%' }}>
          <Icon size={24} color={color} />
        </div>
      </div>

      <div className="card-body" style={{ marginTop: '1rem' }}>
        <div className="metric-value-row" style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
          <div className="metric-value" style={{ color, fontSize: '2.5rem', fontWeight: 800 }}>{value}</div>
          <span style={{ fontSize: '1.2rem', color: trendColor }}>
            {trend === 'up' ? '▲' : '▼'}
          </span>
        </div>
        <div className="metric-total" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ padding: '0.2rem 0.5rem', backgroundColor: `${color}15`, color, borderRadius: '4px', fontWeight: 600, fontSize: '0.85rem' }}>
            {total}
          </span>
          {target && <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>(Cible: {target})</span>}
        </div>
      </div>

      <div className="card-footer" style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
        <span className="description" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{description}</span>

        {alert && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem', backgroundColor: alert.severity === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: '6px', color: alert.severity === 'warning' ? '#F59E0B' : '#EF4444' }}>
            <AlertTriangle size={16} style={{ marginTop: '0.1rem', flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.4 }}>
              {useBusiness ? (
                alert.message.replace('Pass rate critique:', 'Critique :')
                  .replace('Pass rate en warning:', 'Attention :')
                  .replace('Trop de tests bloqués:', 'Blocages élevés :')
                  .replace('Avancement insuffisant:', 'Retard :')
              ) : alert.message}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Détermine la couleur selon seuils ISTQB
 */
function getColorByThreshold(value, targetThreshold, warningThreshold) {
  if (value >= targetThreshold) return '#10B981'; // Vert
  if (value >= warningThreshold) return '#F59E0B'; // Orange
  return '#EF4444'; // Rouge
}

/**
 * Couleur pour le taux d'échec (inverse)
 */
function getColorForFailure(value) {
  if (value <= 5) return '#10B981'; // Vert si peu d'échecs
  if (value <= 10) return '#F59E0B'; // Orange
  return '#EF4444'; // Rouge si beaucoup d'échecs
}

export default MetricsCards;
