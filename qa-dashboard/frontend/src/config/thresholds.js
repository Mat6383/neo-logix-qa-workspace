// ISTQB / ITIL / LEAN SLA thresholds — single source of truth for frontend.
// Backend equivalent: backend/config/thresholds.config.js

export const SLA = {
  passRate:       { ok: 95, warning: 90, critical: 85 },
  failureRate:    { ok: 5,  warning: 10 },
  completionRate: { ok: 90, warning: 80 },
  testEfficiency: { ok: 95, warning: 90 },
  escapeRate:     { max: 5 },
  detectionRate:  { min: 95 },
  blockedRate:    { max: 5 },
};

export const ITIL = {
  mttr:           72,   // hours
  leadTime:       120,  // hours
  changeFailRate: 20,   // %
};

export const LEAN = {
  wip: 20,
};

export const ISTQB = {
  passRate:  80,
  blockRate: 5,
};
