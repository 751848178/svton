export function requireConfigRevisionCreateResponse(value) {
  const response = requireRecord(value, "response");
  const revision = requireRecord(response.revision, "revision");
  const environment = requireRecord(response.environment, "environment");
  const id = requireString(revision.id, "revision-id");
  const revisionNumber = revision.revision;
  if (!Number.isInteger(revisionNumber) || revisionNumber < 1) {
    throw responseError("revision-number");
  }
  if (revision.current !== true) throw responseError("revision-current");
  if (environment.currentConfigRevisionId !== id) {
    throw responseError("environment-current-revision");
  }
  return Object.freeze({ id, revision: revisionNumber });
}

function requireRecord(value, reason) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw responseError(reason);
  }
  return value;
}

function requireString(value, reason) {
  if (typeof value !== "string" || value.trim() === "") {
    throw responseError(reason);
  }
  return value;
}

function responseError(reason) {
  return new Error(`PARITY_CONFIG_REVISION_CREATE_RESPONSE_INVALID: ${reason}`);
}
