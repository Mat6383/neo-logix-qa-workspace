// Shared ISTQB metric calculation helpers.
// Exported from both testmo.service and istqb-metrics.service for backwards-compat.

function calculatePercentage(value, total) {
  if (!total || total === 0) return 0;
  return parseFloat(((value / total) * 100).toFixed(2));
}

function aggregateSessions(sessions) {
  const aggregated = {
    total: 0,
    passed: 0,
    failed: 0,
    completed: 0,
    success: 0,
    failure: 0,
    wip: 0,
  };

  sessions.forEach((session) => {
    const successCount = session.success_count || 0;
    const failureCount = session.failure_count || 0;
    const sessionTotal = successCount + failureCount;

    if (sessionTotal > 0) {
      aggregated.total += sessionTotal;
      aggregated.passed += successCount;
      aggregated.failed += failureCount;
      aggregated.completed += sessionTotal;
      aggregated.success += successCount;
      aggregated.failure += failureCount;
    } else {
      aggregated.total += 1;
      aggregated.wip += 1;
    }
  });

  return aggregated;
}

function globalMetrics(aggregated) {
  return {
    completionRate: calculatePercentage(aggregated.completed, aggregated.total),
    passRate: calculatePercentage(aggregated.passed, aggregated.completed),
    failureRate: calculatePercentage(aggregated.failed, aggregated.completed),
    testEfficiency: calculatePercentage(
      aggregated.passed,
      aggregated.passed + aggregated.failed
    ),
  };
}

module.exports = { calculatePercentage, aggregateSessions, globalMetrics };
