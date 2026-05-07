// ISTQB / ITIL / LEAN SLA thresholds — single source of truth for backend.
// Frontend equivalent: frontend/src/config/thresholds.js

const SLA_THRESHOLDS = {
  passRate: { target: 95, warning: 90, critical: 85 },
  blockedRate: { max: 5 },
  completionRate: { target: 90, warning: 80 },
};

const ITIL_TARGETS = {
  mttr: 72,           // hours
  leadTime: 120,      // hours
  changeFailRate: 20, // %
};

const LEAN_TARGETS = {
  wip: 20,
};

const ISTQB_TARGETS = {
  passRate: 80,
  blockRate: 5,
};

module.exports = { SLA_THRESHOLDS, ITIL_TARGETS, LEAN_TARGETS, ISTQB_TARGETS };
