/**
 * Export des métriques QA au format CSV.
 * Zéro dépendance — utilise uniquement les API navigateur.
 */

function fmt(v) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function escapeCell(v) {
  const s = fmt(v);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildRows(metrics, project) {
  const g = metrics?.globalMetrics ?? {};
  const r = metrics?.qualityRates ?? {};
  const date = new Date().toLocaleDateString('fr-FR');

  return [
    ['Projet', project?.name ?? ''],
    ['Date export', date],
    [],
    ['Métrique', 'Valeur (%)'],
    ['Pass Rate', fmt(g.passRate)],
    ['Completion Rate', fmt(g.completionRate)],
    ['Failure Rate', fmt(g.failureRate)],
    ['Test Efficiency', fmt(g.testEfficiency)],
    [],
    ['Qualité (ISTQB)'],
    ['Escape Rate', fmt(r.escapeRate)],
    ['Detection Rate', fmt(r.detectionRate)],
    ['Bugs en prod', fmt(r.bugsInProd)],
    ['Bugs en test', fmt(r.bugsInTest)],
    ['Total bugs', fmt(r.totalBugs)],
    [],
    ['Brut'],
    ['Total cas', fmt(g.totalTests)],
    ['Complétés', fmt(g.raw?.completed)],
    ['Passés', fmt(g.raw?.passed)],
    ['Échoués', fmt(g.raw?.failed)],
    ['WIP', fmt(g.raw?.wip)],
    ['Bloqués', fmt(g.raw?.blocked)],
    ['Non testés', fmt(g.raw?.untested)],
  ];
}

export function exportMetricsCSV(metrics, project) {
  const rows = buildRows(metrics, project);
  const csv = rows.map(row => row.map(escapeCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  a.href = url;
  a.download = `QA_Metrics_${project?.name ?? 'export'}_${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export { buildRows };
