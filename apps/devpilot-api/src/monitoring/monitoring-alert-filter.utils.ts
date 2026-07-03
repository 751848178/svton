export function normalizeAlertEventStatuses(values?: string[]) {
  const allowed = new Set([
    "firing",
    "error",
    "insufficient_data",
    "resolved",
    "acknowledged",
  ]);
  const statuses = (values || []).filter((value) => allowed.has(value));
  return statuses.length > 0 ? statuses : ["firing", "error"];
}

export function normalizeAlertSeverityFilter(values?: string[]) {
  const allowed = new Set(["info", "warning", "critical"]);
  return (values || []).filter((value) => allowed.has(value));
}
