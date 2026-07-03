const escalationPayloadType = "devpilot.alert_event.escalation";

export function normalizeAlertEscalationSeverities(values?: string[]) {
  const allowed = new Set(["info", "warning", "critical"]);
  const severities = (values || [])
    .map((value) => value.trim().toLowerCase())
    .filter((value) => allowed.has(value));
  return severities.length > 0 ? Array.from(new Set(severities)) : ["critical"];
}

export function isAlertEscalationPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return (value as Record<string, unknown>).type === escalationPayloadType;
}
