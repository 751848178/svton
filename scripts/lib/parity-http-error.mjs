const DECISION_ARRAY_FIELDS = [
  "blockerGateIds",
  "manualGateIds",
  "confirmedManualGateIds",
  "warningGateIds",
  "deferredGateIds",
  "integrityErrors",
];

export function parityApiError(method, path, status, payload = {}) {
  const code = stringValue(payload.code);
  const serverMessage = stringValue(payload.message);
  const error = new Error(
    serverMessage || `API ${method} ${path} failed (${status})`,
  );
  error.status = status;
  error.code = code;
  error.requestIdentity = { method, path };
  error.decision = safeDecision(payload.decision);
  return error;
}

export function parityErrorEvidence(error) {
  if (!error || typeof error !== "object") return null;
  const evidence = {
    status: Number.isInteger(error.status) ? error.status : null,
    code: stringValue(error.code),
    requestIdentity: safeRequestIdentity(error.requestIdentity),
    decision: safeDecision(error.decision),
  };
  return Object.values(evidence).some((value) => value !== null)
    ? evidence
    : null;
}

function safeDecision(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const decision = {
    id: stringValue(value.id),
    stage: stringValue(value.stage),
    phase: stringValue(value.phase),
    allowed: typeof value.allowed === "boolean" ? value.allowed : null,
    inputHash: stringValue(value.inputHash),
    decidedAt: stringValue(value.decidedAt),
  };
  for (const field of DECISION_ARRAY_FIELDS) {
    decision[field] = stringArray(value[field]);
  }
  return decision;
}

function safeRequestIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const method = stringValue(value.method);
  const path = stringValue(value.path);
  return method && path ? { method, path } : null;
}

function stringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string").slice(0, 64)
    : [];
}

function stringValue(value) {
  return typeof value === "string" && value.length <= 512 ? value : null;
}
