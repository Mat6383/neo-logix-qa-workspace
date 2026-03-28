/**
 * ================================================
 * STATUS CHART COMPONENT
 * ================================================
 * Graphique de distribution des statuts de tests
 * 
 * ISTQB: Test Status Distribution
 * LEAN: Visualisation claire et actionnable
 * 
 * @author Matou - Neo-Logix QA Lead
 */

import React from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import '../styles/StatusChart.css';

// Enregistrer les composants Chart.js
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const StatusChart = ({ metrics, chartType = 'doughnut', useBusiness, isDark = false }) => {
  if (!metrics || !metrics.statusDistribution) {
    return <div className="chart-loading">Chargement des graphiques...</div>;
  }

  const { labels, values, colors } = metrics.statusDistribution;

  // Configuration Doughnut Chart
  const doughnutData = {
    labels: labels,
    datasets: [
      {
        label: 'Nombre de tests',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c + 'CC'),
        borderWidth: 2,
        hoverOffset: 10
      }
    ]
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 15,
          color: isDark ? '#E2E8F0' : '#111827',
          font: {
            size: 12,
            family: "'Inter', sans-serif"
          },
          usePointStyle: true,
          pointStyle: 'circle'
        }
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} tests (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: useBusiness ? 'Distribution des Statuts de Tests' : 'Test Status Distribution',
        color: isDark ? '#E2E8F0' : '#111827',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 20
        }
      }
    }
  };

  // Configuration Bar Chart
  const barData = {
    labels: labels,
    datasets: [
      {
        label: 'Nombre de tests',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c + 'CC'),
        borderWidth: 2
      }
    ]
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.parsed.y || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${value} tests (${percentage}%)`;
          }
        }
      },
      title: {
        display: true,
        text: useBusiness ? 'Répartition par Statut' : 'Status Distribution',
        color: isDark ? '#E2E8F0' : '#111827',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
          color: isDark ? '#9CA3AF' : '#6B7280'
        },
        grid: {
          color: isDark ? '#1E3A8A' : '#E5E7EB'
        }
      },
      x: {
        ticks: {
          color: isDark ? '#9CA3AF' : '#6B7280'
        },
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="status-chart-container">
      <div className="chart-wrapper">
        {chartType === 'doughnut' ? (
          <Doughnut data={doughnutData} options={doughnutOptions} />
        ) : (
          <Bar data={barData} options={barOptions} />
        )}
      </div>

      {/* Statistiques détaillées */}
      <div className="status-details">
        <h4>{useBusiness ? 'Détails par Statut' : 'Status Details'}</h4>
        <div className="status-list">
          {labels.map((label, index) => (
            <StatusItem
              key={index}
              label={label}
              value={values[index]}
              color={colors[index]}
              total={values.reduce((a, b) => a + b, 0)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * Item de statut individuel
 */
const StatusItem = ({ label, value, color, total }) => {
  const percentage = ((value / total) * 100).toFixed(1);

  return (
    <div className="status-item">
      <div className="status-header">
        <div className="status-label">
          <span
            className="status-indicator"
            style={{ backgroundColor: color }}
          />
          <span className="label-text">{label}</span>
        </div>
        <span className="status-value">{value}</span>
      </div>
      <div className="status-bar">
        <div
          className="status-bar-fill"
          style={{
            width: `${percentage}%`,
            backgroundColor: color
          }}
        />
      </div>
      <div className="status-percentage">{percentage}%</div>
    </div>
  );
};

export default StatusChart;
