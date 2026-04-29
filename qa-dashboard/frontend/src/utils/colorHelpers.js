export function getColorByThreshold(value, targetThreshold, warningThreshold) {
  if (value >= targetThreshold) return '#10B981';
  if (value >= warningThreshold) return '#F59E0B';
  return '#EF4444';
}

export function getColorForFailure(value) {
  if (value <= 5) return '#10B981';
  if (value <= 10) return '#F59E0B';
  return '#EF4444';
}
