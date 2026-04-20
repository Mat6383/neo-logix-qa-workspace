/**
 * ================================================
 * REPORT SERVICE — Génération de rapports de clôture
 * ================================================
 * ISTQB §5.4.2 Test Closure Report
 * LEAN + ITIL v4 CSI
 *
 * Génère les rapports HTML et PPTX dynamiquement
 * à partir des données Testmo API.
 */

const pptxgen = require('pptxgenjs');

class ReportService {
  constructor(testmoService) {
    this.testmoService = testmoService;
  }

  // ================================================================
  // DATA COLLECTION — Récupère toutes les données pour le rapport
  // ================================================================
  async collectReportData(projectId, runIds) {
    const ts = this.testmoService;

    // runIds : tableau d'IDs envoyés directement depuis le dashboard
    // On ignore les IDs de sessions exploratoires (préfixe "session-")
    const numericRunIds = runIds
      .filter(id => !String(id).startsWith('session-'))
      .map(id => parseInt(id, 10))
      .filter(id => !isNaN(id));

    if (numericRunIds.length === 0) {
      throw new Error('Aucun run valide fourni (les sessions exploratoires ne sont pas incluses dans le rapport)');
    }

    // 1. Fetch each run by ID — no milestone filtering needed
    const runsData = [];
    for (const runId of numericRunIds) {
      const runDetail = await ts.apiGet(`/runs/${runId}?expands=issues`);

      // Pagination complète — les runs avec "Case (steps)" génèrent
      // N résultats par cas (1 par step + 1 global), dépassant souvent limit=200
      let allResults = [];
      let allExpandedIssues = [];
      let page = 1;
      let lastPage = 1;
      while (page <= lastPage) {
        const resp = await ts.apiGet(`/runs/${runId}/results?limit=200&page=${page}&expands=issues`);
        allResults = allResults.concat(resp.result || []);
        allExpandedIssues = allExpandedIssues.concat(resp.expands?.issues || []);
        lastPage = resp.last_page || 1;
        page++;
      }

      // Build issue map (testmo id → gitlab iid)
      const issueMap = {};
      for (const i of (runDetail.expands?.issues || [])) {
        issueMap[i.id] = i.display_id;
      }
      for (const i of allExpandedIssues) {
        issueMap[i.id] = i.display_id;
      }

      // ── Résultats individuels (pour listes nominatives failed/tickets) ──
      const latestResults = allResults.filter(r => r.is_latest);
      const statusMap = { 2: 'PASSED', 3: 'FAILED', 4: 'Retest', 5: 'Blocked', 6: 'Skipped', 8: 'WIP' };

      // Dédupliquer par case_id (un résultat par cas de test)
      const caseMap = new Map();
      for (const r of latestResults) {
        const status = statusMap[r.status_id] || `status_${r.status_id}`;
        const tickets = (r.issues || []).map(iid => issueMap[iid] || `?${iid}`);
        if (!caseMap.has(r.case_id)) {
          caseMap.set(r.case_id, { caseId: r.case_id, status, correctionTickets: tickets });
        } else {
          const existing = caseMap.get(r.case_id);
          // Fusionner les tickets
          for (const t of tickets) {
            if (!existing.correctionTickets.includes(t)) existing.correctionTickets.push(t);
          }
        }
      }
      const results = [...caseMap.values()];

      // Run-level gitlab issues
      const runGitlabIssues = (runDetail.result.issues || [])
        .map(iid => issueMap[iid])
        .filter(Boolean)
        .sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

      // ── Stats agrégées : depuis les compteurs du run (source de vérité Testmo) ──
      // Les compteurs statusN_count sont TOUJOURS synchronisés avec l'UI Testmo,
      // contrairement aux résultats individuels qui peuvent être désynchronisés.
      const rd = runDetail.result;
      const passed  = rd.status1_count || 0;
      const failed  = rd.status2_count || 0;
      const skipped = (rd.status5_count || 0) + (rd.status6_count || 0);
      const wip     = rd.status7_count || 0;
      const total   = rd.total_count   || 0;

      runsData.push({
        id: runId,
        name: runDetail.result.name,
        total,
        passed,
        failed,
        skipped,
        wip,
        passRate: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
        completionRate: total > 0 ? Math.round(((total - wip) / total) * 1000) / 10 : 0,
        results,
        gitlabIssues: runGitlabIssues,
        isTNR: runDetail.result.name.includes('TNR'),
        isExploratory: false,
        startedAt: runDetail.result.started_at || runDetail.result.created_at,
      });
    }

    // 2. Dériver le nom du milestone depuis les noms des runs
    //    Ex : ["R02 Fonctionnel", "R06 TNR"] → "R02 — R06"
    const runTags = runsData
      .map(r => { const m = r.name.match(/R\d+[a-zA-Z]?/i); return m ? m[0] : null; })
      .filter(Boolean);
    const uniqueTags = [...new Set(runTags)];
    const milestoneName = uniqueTags.length > 0 ? uniqueTags.join(' — ') : 'Release';

    // 4. Get case names
    const allCaseIds = new Set();
    runsData.forEach(r => r.results.forEach(res => allCaseIds.add(res.caseId)));

    const caseNames = {};
    let page = 1;
    let lastPage = 1;
    while (page <= lastPage) {
      const casesResp = await ts.apiGet(`/projects/${projectId}/cases?limit=100&page=${page}`);
      lastPage = casesResp.last_page;
      for (const c of casesResp.result) {
        if (allCaseIds.has(c.id)) {
          caseNames[c.id] = c.name;
        }
      }
      // Stop early if we found all
      if (Object.keys(caseNames).length >= allCaseIds.size) break;
      page++;
    }

    // Attach case names to results
    runsData.forEach(run => {
      run.results.forEach(r => {
        r.caseName = caseNames[r.caseId] || `Case ${r.caseId}`;
      });
    });

    // 5. Compute global stats
    const functionalRuns = runsData.filter(r => !r.isTNR);
    const tnrRuns = runsData.filter(r => r.isTNR);

    const totalTests = runsData.reduce((s, r) => s + r.total, 0);
    const totalPassed = runsData.reduce((s, r) => s + r.passed, 0);
    const totalFailed = runsData.reduce((s, r) => s + r.failed, 0);
    const totalSkipped = runsData.reduce((s, r) => s + r.skipped, 0);
    const totalWip = runsData.reduce((s, r) => s + r.wip, 0);
    const executed = totalTests - totalWip - totalSkipped;
    const completionRate = totalTests > 0 ? Math.round(((totalTests - totalWip) / totalTests) * 1000) / 10 : 0;
    const passRate = executed > 0 ? Math.round((totalPassed / executed) * 1000) / 10 : 0;
    const failureRate = executed > 0 ? Math.round((totalFailed / executed) * 1000) / 10 : 0;

    // Failed / WIP / passed-with-tickets
    const failedTests = [];
    const wipTests = [];
    const passedWithTickets = [];
    runsData.forEach(run => {
      run.results.forEach(r => {
        if (r.status === 'FAILED') {
          failedTests.push({
            run: run.name,
            caseName: r.caseName,
            correctionTickets: r.correctionTickets,
          });
        }
        // WIP : on ne prend les WIP individuels QUE si le compteur du run
        // (status7_count, source de vérité Testmo) confirme qu'il y a des WIP.
        // L'API /results peut être désynchronisée avec l'UI Testmo.
        if (r.status === 'WIP' && run.wip > 0) {
          wipTests.push({
            run: run.name,
            caseName: r.caseName,
          });
        }
        if (r.status === 'PASSED' && r.correctionTickets.length > 0) {
          passedWithTickets.push({
            run: run.name,
            caseName: r.caseName,
            correctionTickets: r.correctionTickets,
          });
        }
      });
    });

    // Determine verdict
    let verdict = 'GO';
    if (passRate < 95 || failureRate > 5) verdict = 'GO SOUS RÉSERVE';
    if (passRate < 70 || failureRate > 30) verdict = 'NO GO';

    return {
      milestoneName,
      runIds: numericRunIds,
      projectId,
      runs: runsData,
      functionalRuns,
      tnrRuns,
      stats: {
        totalTests,
        totalPassed,
        totalFailed,
        totalSkipped,
        totalWip,
        executed,
        completionRate,
        passRate,
        failureRate,
        efficiency: totalTests > 0 ? Math.round((totalPassed / totalTests) * 1000) / 10 : 0,
      },
      failedTests,
      wipTests,
      passedWithTickets,
      verdict,
      generatedAt: new Date().toISOString(),
    };
  }

  // ================================================================
  // HTML GENERATION
  // ================================================================
  generateHTML(data, recommendations, complement) {
    const { milestoneName, stats, runs, functionalRuns, tnrRuns, failedTests, wipTests, passedWithTickets, verdict } = data;
    const today = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const refDate = new Date().toISOString().split('T')[0].replace(/-/g, '-');

    const verdictColor = verdict === 'GO' ? '#10b981' : verdict === 'NO GO' ? '#ef4444' : '#f59e0b';

    // Badge class for pass rate
    const prBadge = (rate) => {
      if (rate >= 95) return 'badge-green';
      if (rate >= 85) return 'badge-orange';
      return 'badge-red';
    };

    // Build functional runs table rows
    const funcRunsRows = functionalRuns.map(r => `
      <tr>
        <td><strong>${this._esc(r.name)}</strong></td>
        <td class="num">${r.total}</td>
        <td class="num" style="color:#10b981;">${r.passed}</td>
        <td class="num"${r.failed > 0 ? ' style="color:#ef4444;"' : ''}>${r.failed}</td>
        <td class="num">${r.skipped}</td>
        <td class="num"${r.wip > 0 ? ' style="color:#f59e0b;"' : ''}>${r.wip}</td>
        <td class="num">${r.completionRate}%</td>
        <td class="num"><span class="badge ${prBadge(r.passRate)}">${r.passRate}%</span></td>
      </tr>`).join('');

    const tnrRunsRows = tnrRuns.map(r => `
      <tr>
        <td><strong>${this._esc(r.name)}</strong></td>
        <td class="num">${r.total}</td>
        <td class="num" style="color:#10b981;">${r.passed}</td>
        <td class="num"${r.failed > 0 ? ' style="color:#ef4444;"' : ''}>${r.failed}</td>
        <td class="num"><span class="badge ${prBadge(r.passRate)}">${r.passRate}%</span></td>
        <td class="num"><span class="badge ${r.failed === 0 ? 'badge-green' : 'badge-red'}">${r.failed === 0 ? 'OK' : 'Attention'}</span></td>
      </tr>`).join('');

    // Failed tests table
    const failedRows = failedTests.map(ft => {
      const tickets = ft.correctionTickets.length > 0 ? ft.correctionTickets.map(t => `<strong>#${t}</strong>`).join(', ') : '—';
      const runShort = ft.run.replace(/^.*- /, '');
      return `<tr><td>${runShort}</td><td>${this._esc(ft.caseName)}</td><td class="num"><span class="badge badge-red">Failed</span></td><td class="num">${tickets}</td></tr>`;
    }).join('');

    // WIP tests table
    const wipRows = (wipTests || []).map(wt => {
      const runShort = wt.run.replace(/^.*- /, '');
      return `<tr><td>${runShort}</td><td>${this._esc(wt.caseName)}</td><td class="num"><span class="badge badge-orange">WIP</span></td></tr>`;
    }).join('');

    const passedTicketRows = passedWithTickets.map(pt => {
      const tickets = pt.correctionTickets.map(t => `<strong>#${t}</strong>`).join(', ');
      const runShort = pt.run.replace(/^.*- /, '');
      return `<tr><td>${runShort}</td><td>${this._esc(pt.caseName)}</td><td class="num"><span class="badge badge-green">Passed</span></td><td class="num">${tickets}</td></tr>`;
    }).join('');

    // Tickets per run table
    const ticketsPerRunRows = runs.filter(r => r.gitlabIssues.length > 0).map(r => {
      const runShort = r.name.replace(/^.*- /, '');
      return `<tr><td><strong>${runShort}</strong></td><td style="word-break:break-all;">${r.gitlabIssues.map(i => '#' + i).join(', ')}</td><td class="num">${r.gitlabIssues.length}</td></tr>`;
    }).join('');

    // Recommendations
    const recoRows = (recommendations || []).map(r =>
      `<tr>
        <td><strong>${this._esc(r.category)}</strong></td>
        <td>${this._esc(r.text)}</td>
        <td class="num">${this._esc(Array.isArray(r.type) ? r.type.join(', ') : (r.type || '—'))}</td>
        <td class="num">${this._esc(r.statut || '—')}</td>
        <td class="num"><span class="badge ${r.priority === 'Haute' ? 'badge-red' : r.priority === 'Faible' ? 'badge-green' : 'badge-orange'}">${this._esc(r.priority)}</span></td>
      </tr>`
    ).join('');

    // Totals for functional
    const fTotal = functionalRuns.reduce((s, r) => s + r.total, 0);
    const fPassed = functionalRuns.reduce((s, r) => s + r.passed, 0);
    const fFailed = functionalRuns.reduce((s, r) => s + r.failed, 0);
    const fSkipped = functionalRuns.reduce((s, r) => s + r.skipped, 0);
    const fWip = functionalRuns.reduce((s, r) => s + r.wip, 0);

    const tTotal = tnrRuns.reduce((s, r) => s + r.total, 0);
    const tPassed = tnrRuns.reduce((s, r) => s + r.passed, 0);
    const tFailed = tnrRuns.reduce((s, r) => s + r.failed, 0);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Rapport de Clôture de Tests — ${this._esc(milestoneName)}</title>
<style>
  @page { size: A4; margin: 15mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Calibri, Arial, sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; background: #fff; }
  .page { page-break-after: always; min-height: 100vh; padding: 0; position: relative; }
  .page:last-child { page-break-after: avoid; }
  .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; min-height: 100vh; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); color: #fff; padding: 40px; }
  .cover-badge { display: inline-block; padding: 6px 22px; border: 2px solid #38bdf8; border-radius: 20px; font-size: 10pt; letter-spacing: 2px; text-transform: uppercase; color: #38bdf8; margin-bottom: 30px; }
  .cover h1 { font-size: 32pt; font-weight: 700; margin-bottom: 8px; }
  .cover h2 { font-size: 16pt; font-weight: 300; color: #94a3b8; margin-bottom: 40px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 40px; text-align: left; font-size: 10pt; color: #cbd5e1; border-top: 1px solid #334155; padding-top: 24px; margin-top: 20px; }
  .cover-meta dt { color: #64748b; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; }
  .cover-meta dd { color: #e2e8f0; font-weight: 500; margin-bottom: 10px; }
  .section-content { padding: 20px 30px 60px 30px; }
  .section-title { font-size: 18pt; color: #0f172a; border-bottom: 3px solid #3b82f6; padding-bottom: 8px; margin-bottom: 16px; }
  .sub-title { font-size: 12pt; color: #1e3a5f; margin: 18px 0 8px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-bottom: 12px; }
  th, td { padding: 6px 8px; border: 1px solid #e2e8f0; text-align: left; }
  th { background: #1e3a5f; color: #fff; font-weight: 600; font-size: 8.5pt; }
  .num { text-align: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8pt; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-orange { background: #fef3c7; color: #92400e; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
  .kpi-card { background: #f8fafc; border-radius: 10px; padding: 14px; text-align: center; }
  .kpi-value { font-size: 28pt; font-weight: 800; }
  .kpi-label { font-size: 9pt; color: #64748b; margin-top: 4px; }
  .kpi-target { margin-top: 6px; font-size: 8pt; }
  .page-footer { position: absolute; bottom: 12px; left: 30px; right: 30px; display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  .stacked-bar { display: flex; height: 28px; border-radius: 6px; overflow: hidden; margin: 8px 0; }
  .seg { display: flex; align-items: center; justify-content: center; color: #fff; font-size: 8pt; font-weight: 600; min-width: 2px; }
  @media print { .page { page-break-after: always; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- PAGE 1: COVER -->
<div class="page cover">
  <div class="cover-badge">ISTQB &bull; LEAN &bull; ITIL</div>
  <h1>Rapport de Clôture de Tests</h1>
  <h2>${this._esc(milestoneName)} — Test Closure Report</h2>
  <div style="margin: 30px 0;">
    <div style="font-size: 52pt; font-weight: 800; color: ${verdictColor}; letter-spacing: -2px;">${verdict}</div>
  </div>
  <dl class="cover-meta">
    <dt>Projet</dt><dd>Neo-Logix — QA Préprod</dd>
    <dt>Version</dt><dd>${this._esc(milestoneName)}</dd>
    <dt>Périmètre</dt><dd>${runs.length} runs</dd>
    <dt>Date d'édition</dt><dd>${today}</dd>
  </dl>
</div>

<!-- PAGE 2: KPI -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">1. Résumé exécutif <span style="font-size:9pt;color:#64748b;">(Executive Summary)</span></h2>
    <div class="kpi-grid">
      <div class="kpi-card" style="border-left: 4px solid ${stats.completionRate >= 90 ? '#10b981' : '#ef4444'};">
        <div class="kpi-value" style="color:${stats.completionRate >= 90 ? '#10b981' : '#ef4444'};">${stats.completionRate}%</div>
        <div class="kpi-label">Taux d'exécution<br><em>(Completion Rate)</em></div>
        <div class="kpi-target badge ${stats.completionRate >= 90 ? 'badge-green' : 'badge-red'}">Cible ≥ 90% ${stats.completionRate >= 90 ? '✓' : '✗'}</div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid ${stats.passRate >= 95 ? '#10b981' : '#ef4444'};">
        <div class="kpi-value" style="color:${stats.passRate >= 95 ? '#10b981' : '#ef4444'};">${stats.passRate}%</div>
        <div class="kpi-label">Taux de succès<br><em>(Pass Rate)</em></div>
        <div class="kpi-target badge ${stats.passRate >= 95 ? 'badge-green' : 'badge-red'}">Cible ≥ 95% ${stats.passRate >= 95 ? '✓' : '✗'}</div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid ${stats.failureRate <= 5 ? '#10b981' : '#ef4444'};">
        <div class="kpi-value" style="color:${stats.failureRate <= 5 ? '#10b981' : '#ef4444'};">${stats.failureRate}%</div>
        <div class="kpi-label">Taux d'échec<br><em>(Failure Rate)</em></div>
        <div class="kpi-target badge ${stats.failureRate <= 5 ? 'badge-green' : 'badge-red'}">Cible ≤ 5% ${stats.failureRate <= 5 ? '✓' : '✗'}</div>
      </div>
      <div class="kpi-card" style="border-left: 4px solid ${stats.efficiency >= 95 ? '#10b981' : '#f59e0b'};">
        <div class="kpi-value" style="color:${stats.efficiency >= 95 ? '#10b981' : '#f59e0b'};">${stats.efficiency}%</div>
        <div class="kpi-label">Efficacité<br><em>(Test Efficiency)</em></div>
        <div class="kpi-target badge ${stats.efficiency >= 95 ? 'badge-green' : 'badge-orange'}">Cible ≥ 95% ${stats.efficiency >= 95 ? '✓' : '✗'}</div>
      </div>
    </div>
    <table>
      <tr><th>Indicateur</th><th class="num">Valeur</th></tr>
      <tr><td>Cas de test totaux</td><td class="num"><strong>${stats.totalTests}</strong></td></tr>
      <tr><td>Tests réussis (Passed)</td><td class="num" style="color:#10b981;font-weight:700;">${stats.totalPassed}</td></tr>
      <tr><td>Tests échoués (Failed)</td><td class="num" style="color:#ef4444;font-weight:700;">${stats.totalFailed}</td></tr>
      <tr><td>Tests ignorés (Skipped)</td><td class="num">${stats.totalSkipped}</td></tr>
      <tr><td>Tests en cours (WIP)</td><td class="num" style="color:#f59e0b;">${stats.totalWip}</td></tr>
    </table>
    <div class="stacked-bar">
      <div class="seg" style="width:${stats.totalTests > 0 ? (stats.totalPassed / stats.totalTests * 100) : 0}%;background:#10b981;">Réussis ${stats.totalPassed}</div>
      <div class="seg" style="width:${stats.totalTests > 0 ? (stats.totalFailed / stats.totalTests * 100) : 0}%;background:#ef4444;">Échoués ${stats.totalFailed}</div>
      ${stats.totalSkipped > 0 ? `<div class="seg" style="width:${stats.totalSkipped / stats.totalTests * 100}%;background:#94a3b8;"></div>` : ''}
      ${stats.totalWip > 0 ? `<div class="seg" style="width:${stats.totalWip / stats.totalTests * 100}%;background:#f59e0b;"></div>` : ''}
    </div>
  </div>
  <div class="page-footer"><span>RC-${this._esc(milestoneName)}-${refDate}</span><span>Page 2</span></div>
</div>

<!-- PAGE 3: RÉSULTATS DÉTAILLÉS -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">2. Résultats détaillés <span style="font-size:9pt;color:#64748b;">(Detailed Test Results)</span></h2>
    <h3 class="sub-title">2.1 Runs de validation fonctionnelle</h3>
    <table>
      <tr><th>Run</th><th class="num">Total</th><th class="num">Réussis</th><th class="num">Échoués</th><th class="num">Ignorés</th><th class="num">WIP</th><th class="num">Exéc.</th><th class="num">Pass Rate</th></tr>
      ${funcRunsRows}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td>TOTAL FONCTIONNELS</td><td class="num">${fTotal}</td><td class="num" style="color:#10b981;">${fPassed}</td><td class="num" style="color:#ef4444;">${fFailed}</td><td class="num">${fSkipped}</td><td class="num">${fWip}</td><td class="num">${fTotal > 0 ? Math.round((fTotal - fWip) / fTotal * 1000) / 10 : 0}%</td><td class="num">${fTotal - fWip > 0 ? Math.round(fPassed / (fTotal - fWip) * 1000) / 10 : 0}%</td>
      </tr>
    </table>
    ${tnrRuns.length > 0 ? `
    <h3 class="sub-title">2.2 Tests de non-régression — TNR</h3>
    <table>
      <tr><th>Run TNR</th><th class="num">Total</th><th class="num">Réussis</th><th class="num">Échoués</th><th class="num">Pass Rate</th><th class="num">Statut</th></tr>
      ${tnrRunsRows}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td>TOTAL TNR</td><td class="num">${tTotal}</td><td class="num" style="color:#10b981;">${tPassed}</td><td class="num" style="color:#ef4444;">${tFailed}</td><td class="num">${tTotal > 0 ? Math.round(tPassed / tTotal * 1000) / 10 : 0}%</td><td class="num"><span class="badge ${tFailed === 0 ? 'badge-green' : 'badge-orange'}">${tFailed === 0 ? 'OK' : 'Alerte'}</span></td>
      </tr>
    </table>` : ''}
  </div>
  <div class="page-footer"><span>RC-${this._esc(milestoneName)}-${refDate}</span><span>Page 3</span></div>
</div>

<!-- PAGE 4: TRAÇABILITÉ TICKETS -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">3. Traçabilité des tickets GitLab <span style="font-size:9pt;color:#64748b;">(Defect Traceability — ISTQB §5.3)</span></h2>
    ${failedTests.length > 0 ? `
    <h3 class="sub-title">3.1 Tests échoués et tickets de correction</h3>
    <table style="font-size:9pt;">
      <tr><th>Run</th><th>Cas de test</th><th class="num">Statut</th><th class="num">Ticket correction</th></tr>
      ${failedRows}
      <tr style="background:#f1f5f9;font-weight:700;">
        <td colspan="2">TOTAL TESTS ÉCHOUÉS</td><td class="num">${failedTests.length}</td><td class="num">${failedTests.filter(f => f.correctionTickets.length > 0).length} tickets créés</td>
      </tr>
    </table>` : '<p>Aucun test échoué.</p>'}
    ${wipTests && wipTests.length > 0 ? `
    <h3 class="sub-title">3.2 Tests en cours (WIP) — à finaliser</h3>
    <table style="font-size:9pt;">
      <tr><th style="width:20%;">Run</th><th>Cas de test</th><th class="num" style="width:12%;">Statut</th></tr>
      ${wipRows}
      <tr style="background:#fef3c7;font-weight:700;">
        <td colspan="2">TOTAL WIP</td><td class="num">${wipTests.length}</td>
      </tr>
    </table>` : ''}
    ${passedWithTickets.length > 0 ? `
    <h3 class="sub-title">3.3 Tests réussis avec ticket de suivi</h3>
    <table style="font-size:9pt;">
      <tr><th>Run</th><th>Cas de test</th><th class="num">Statut</th><th class="num">Ticket suivi</th></tr>
      ${passedTicketRows}
    </table>` : ''}
    ${ticketsPerRunRows ? `
    <h3 class="sub-title">3.4 Tickets GitLab testés par run</h3>
    <table style="font-size:8.5pt;">
      <tr><th style="width:18%;">Run</th><th>Tickets GitLab testés</th><th class="num">Nb</th></tr>
      ${ticketsPerRunRows}
    </table>` : ''}
  </div>
  <div class="page-footer"><span>RC-${this._esc(milestoneName)}-${refDate}</span><span>Page 4</span></div>
</div>

<!-- PAGE 5: RECOMMANDATIONS -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">4. Recommandations <span style="font-size:9pt;color:#64748b;">(Lessons Learned — LEAN Kaizen / ITIL CSI)</span></h2>
    ${recommendations && recommendations.length > 0 ? `
    <table>
      <tr><th style="width:18%;">Catégorie</th><th style="width:40%;">Constat et recommandation</th><th class="num" style="width:17%;">Type</th><th class="num" style="width:13%;">Statut</th><th class="num" style="width:12%;">Priorité</th></tr>
      ${recoRows}
    </table>` : '<p>Aucune recommandation saisie.</p>'}
  </div>
  <div class="page-footer"><span>RC-${this._esc(milestoneName)}-${refDate}</span><span>Page 5</span></div>
</div>

${complement ? `
<!-- PAGE 6: COMPLÉMENT D'INFORMATION -->
<div class="page">
  <div class="section-content">
    <h2 class="section-title">5. Complément d'information</h2>
    <div style="background:#f8fafc;border-left:4px solid #3b82f6;padding:18px 22px;border-radius:6px;font-size:10.5pt;line-height:1.8;white-space:pre-wrap;color:#1e293b;">${this._esc(complement)}</div>
  </div>
  <div class="page-footer"><span>RC-${this._esc(milestoneName)}-${refDate}</span><span>Page 6</span></div>
</div>` : ''}

</body>
</html>`;
  }

  // ================================================================
  // PPTX GENERATION
  // ================================================================
  async generatePPTX(data, recommendations, complement) {
    const { milestoneName, stats, functionalRuns, tnrRuns, failedTests, wipTests, passedWithTickets, verdict } = data;

    const C = {
      navy: '0F172A', blue: '1E3A5F', accent: '3B82F6', sky: '38BDF8',
      green: '10B981', red: 'EF4444', orange: 'F59E0B', white: 'FFFFFF',
      light: 'F8FAFC', gray: '64748B', darkGray: '334155', text: '1E293B', ice: 'CADCFC',
    };
    const verdictColor = verdict === 'GO' ? C.green : verdict === 'NO GO' ? C.red : C.orange;

    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';
    pres.author = 'QA Dashboard — Neo-Logix';
    pres.title = `Clôture de Tests ${milestoneName}`;

    // SLIDE 1: COVER
    const s1 = pres.addSlide();
    s1.background = { color: C.navy };
    s1.addText('ISTQB  •  LEAN  •  ITIL', { x: 3.0, y: 0.6, w: 4.0, h: 0.4, fontSize: 9, color: C.sky, align: 'center', valign: 'middle', fontFace: 'Calibri', charSpacing: 3 });
    s1.addText('Rapport de Clôture de Tests', { x: 0.5, y: 1.4, w: 9, h: 0.9, fontSize: 36, fontFace: 'Calibri', bold: true, color: C.white, align: 'center' });
    s1.addText(`${milestoneName} — Test Closure Report`, { x: 0.5, y: 2.2, w: 9, h: 0.5, fontSize: 16, fontFace: 'Calibri', color: C.gray, align: 'center' });
    s1.addText(verdict, { x: 1.0, y: 3.1, w: 8, h: 0.8, fontSize: 40, fontFace: 'Calibri', bold: true, color: verdictColor, align: 'center' });

    // SLIDE 2: KPIs
    const s2 = pres.addSlide();
    s2.background = { color: C.light };
    s2.addText('Indicateurs clés', { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: 'Calibri', bold: true, color: C.text });
    const kpis = [
      { label: 'Completion', value: `${stats.completionRate}%`, color: stats.completionRate >= 90 ? C.green : C.red, target: '≥ 90%' },
      { label: 'Pass Rate', value: `${stats.passRate}%`, color: stats.passRate >= 95 ? C.green : C.red, target: '≥ 95%' },
      { label: 'Failure Rate', value: `${stats.failureRate}%`, color: stats.failureRate <= 5 ? C.green : C.red, target: '≤ 5%' },
      { label: 'Efficiency', value: `${stats.efficiency}%`, color: stats.efficiency >= 95 ? C.green : C.orange, target: '≥ 95%' },
    ];
    kpis.forEach((kpi, i) => {
      const x = 0.4 + i * 2.35;
      s2.addShape(pres.shapes.RECTANGLE, { x, y: 1.1, w: 2.15, h: 1.8, fill: { color: C.white }, shadow: { type: 'outer', blur: 4, offset: 2, color: '000000', opacity: 0.1 } });
      s2.addText(kpi.value, { x, y: 1.2, w: 2.15, h: 0.8, fontSize: 32, fontFace: 'Calibri', bold: true, color: kpi.color, align: 'center', valign: 'middle' });
      s2.addText(kpi.label, { x, y: 2.0, w: 2.15, h: 0.35, fontSize: 11, fontFace: 'Calibri', color: C.darkGray, align: 'center' });
      s2.addText(`Cible: ${kpi.target}`, { x, y: 2.35, w: 2.15, h: 0.3, fontSize: 9, fontFace: 'Calibri', color: C.gray, align: 'center' });
    });
    // Summary table
    s2.addText(`${stats.totalTests} tests | ${stats.totalPassed} réussis | ${stats.totalFailed} échoués | ${stats.totalSkipped} ignorés | ${stats.totalWip} WIP`, {
      x: 0.5, y: 3.2, w: 9, h: 0.4, fontSize: 11, fontFace: 'Calibri', color: C.text, align: 'center'
    });

    // SLIDE 3: RESULTS TABLE
    const s3 = pres.addSlide();
    s3.background = { color: C.light };
    s3.addText('Résultats par run', { x: 0.5, y: 0.3, w: 6, h: 0.5, fontSize: 28, fontFace: 'Calibri', bold: true, color: C.text });
    const hOpts = { bold: true, color: C.white, fontSize: 8, fill: { color: C.blue }, align: 'center', valign: 'middle' };
    const tableRows = [
      [{ text: 'Run', options: hOpts }, { text: 'Total', options: hOpts }, { text: 'Passed', options: hOpts }, { text: 'Failed', options: hOpts }, { text: 'Pass Rate', options: hOpts }],
    ];
    [...functionalRuns, ...tnrRuns].forEach(r => {
      const shortName = r.name.replace(/^.*- /, '');
      tableRows.push([
        shortName,
        String(r.total),
        { text: String(r.passed), options: { color: C.green, bold: true, fontSize: 8 } },
        { text: String(r.failed), options: { color: r.failed > 0 ? C.red : C.text, bold: r.failed > 0, fontSize: 8 } },
        { text: `${r.passRate}%`, options: { color: r.passRate >= 95 ? C.green : r.passRate >= 85 ? C.orange : C.red, bold: true, fontSize: 8 } },
      ]);
    });
    s3.addTable(tableRows, { x: 0.3, y: 1.0, w: 9.4, fontSize: 8, fontFace: 'Calibri', color: C.text, border: { pt: 0.5, color: 'E2E8F0' }, colW: [3.5, 1.2, 1.2, 1.2, 1.5], autoPage: false, align: 'center', valign: 'middle' });

    // SLIDE 4: TICKETS
    const s4 = pres.addSlide();
    s4.background = { color: C.light };
    s4.addText('Traçabilité tickets GitLab', { x: 0.5, y: 0.3, w: 7, h: 0.5, fontSize: 24, fontFace: 'Calibri', bold: true, color: C.text });
    const tHdr = { bold: true, color: C.white, fontSize: 7, fill: { color: C.blue }, align: 'center', valign: 'middle' };
    const ticketRows = [
      [{ text: 'Run', options: tHdr }, { text: 'Cas de test', options: { ...tHdr, align: 'left' } }, { text: 'Statut', options: tHdr }, { text: 'Ticket', options: tHdr }],
    ];
    failedTests.slice(0, 14).forEach(ft => {
      const runShort = ft.run.replace(/^.*- /, '');
      const ticket = ft.correctionTickets.length > 0 ? '#' + ft.correctionTickets.join(', #') : '—';
      ticketRows.push([
        runShort,
        ft.caseName.substring(0, 55),
        { text: 'FAILED', options: { color: C.red, bold: true, fontSize: 7 } },
        { text: ticket, options: { bold: true, fontSize: 7 } },
      ]);
    });
    (wipTests || []).slice(0, 5).forEach(wt => {
      const runShort = wt.run.replace(/^.*- /, '');
      ticketRows.push([
        runShort,
        wt.caseName.substring(0, 55),
        { text: 'WIP', options: { color: C.orange, bold: true, fontSize: 7 } },
        { text: '—', options: { fontSize: 7 } },
      ]);
    });
    passedWithTickets.slice(0, 4).forEach(pt => {
      const runShort = pt.run.replace(/^.*- /, '');
      ticketRows.push([
        runShort,
        pt.caseName.substring(0, 55),
        { text: 'PASSED', options: { color: C.green, bold: true, fontSize: 7 } },
        { text: '#' + pt.correctionTickets.join(', #'), options: { bold: true, fontSize: 7, color: C.green } },
      ]);
    });
    s4.addTable(ticketRows, { x: 0.2, y: 1.0, w: 9.6, fontSize: 7, fontFace: 'Calibri', color: C.text, border: { pt: 0.4, color: 'E2E8F0' }, colW: [0.8, 4.2, 0.8, 1.5], autoPage: false, align: 'center', valign: 'middle' });

    // SLIDE 5: RECOMMENDATIONS
    if (recommendations && recommendations.length > 0) {
      const s5 = pres.addSlide();
      s5.background = { color: C.light };
      s5.addText('Recommandations', { x: 0.5, y: 0.25, w: 7, h: 0.5, fontSize: 26, fontFace: 'Calibri', bold: true, color: C.text });
      s5.addText('Lessons Learned — LEAN Kaizen / ITIL CSI', { x: 0.5, y: 0.7, w: 7, h: 0.28, fontSize: 9, fontFace: 'Calibri', color: C.gray });

      const rHdr = { bold: true, color: C.white, fontSize: 8, fill: { color: C.blue }, align: 'center', valign: 'middle' };
      const recoTableRows = [
        [
          { text: 'Catégorie',                 options: { ...rHdr, align: 'left' } },
          { text: 'Constat et recommandation', options: { ...rHdr, align: 'left' } },
          { text: 'Type',                      options: rHdr },
          { text: 'Statut',                    options: rHdr },
          { text: 'Priorité',                  options: rHdr },
        ],
      ];
      recommendations.forEach(r => {
        const priColor = r.priority === 'Haute' ? C.red : r.priority === 'Faible' ? C.green : C.orange;
        recoTableRows.push([
          { text: r.category || '', options: { bold: true, fontSize: 8, color: C.text,     align: 'left',   valign: 'middle' } },
          { text: r.text     || '', options: { fontSize: 8,              color: C.darkGray, align: 'left',   valign: 'middle' } },
          { text: Array.isArray(r.type) ? r.type.join(', ') : (r.type || '—'), options: { fontSize: 8, color: C.text, align: 'center', valign: 'middle' } },
          { text: r.statut   || '—', options: { fontSize: 8,             color: C.gray,     align: 'center', valign: 'middle' } },
          { text: r.priority || '', options: { fontSize: 8, bold: true,  color: priColor,   align: 'center', valign: 'middle' } },
        ]);
      });
      s5.addTable(recoTableRows, {
        x: 0.3, y: 1.05, w: 9.4,
        fontSize: 8, fontFace: 'Calibri', color: C.text,
        border: { pt: 0.5, color: 'E2E8F0' },
        colW: [1.7, 3.8, 1.6, 1.2, 1.1],
        autoPage: false, valign: 'middle',
      });
    }

    // SLIDE 6: COMPLÉMENT D'INFORMATION (optionnel)
    if (complement && complement.trim()) {
      const s6 = pres.addSlide();
      s6.background = { color: C.light };
      s6.addText('Complément d\'information', { x: 0.5, y: 0.3, w: 9, h: 0.5, fontSize: 28, fontFace: 'Calibri', bold: true, color: C.text });
      s6.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.0, w: 9.2, h: 3.6, fill: { color: C.white }, shadow: { type: 'outer', blur: 4, offset: 2, color: '000000', opacity: 0.07 } });
      s6.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.0, w: 0.08, h: 3.6, fill: { color: C.accent } });
      s6.addText(complement.trim(), {
        x: 0.65, y: 1.1, w: 8.8, h: 3.4,
        fontSize: 11, fontFace: 'Calibri', color: C.text,
        valign: 'top', wrap: true,
      });
    }

    // SLIDE 7: CONCLUSION
    const sLast = pres.addSlide();
    sLast.background = { color: C.navy };
    sLast.addText('Conclusion', { x: 0.5, y: 0.5, w: 9, h: 0.7, fontSize: 36, fontFace: 'Calibri', bold: true, color: C.white, align: 'center' });
    sLast.addShape(pres.shapes.RECTANGLE, { x: 2, y: 1.5, w: 6, h: 1.0, fill: { color: C.blue } });
    sLast.addText(verdict, { x: 2, y: 1.55, w: 6, h: 0.55, fontSize: 32, fontFace: 'Calibri', bold: true, color: verdictColor, align: 'center', valign: 'middle' });
    sLast.addText(`${stats.totalPassed}/${stats.totalTests} tests réussis — ${stats.passRate}% pass rate`, { x: 2, y: 2.1, w: 6, h: 0.35, fontSize: 11, fontFace: 'Calibri', color: C.ice, align: 'center', valign: 'middle' });

    return pres;
  }

  _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

module.exports = ReportService;
