const RESPONSE_TYPES = new Set(["Document", "Fetch", "XHR"]);

export function validateHttpResponses(value) {
  requireValue(
    Array.isArray(value) && value.length > 0,
    "httpResponses must be nonempty",
  );
  value.forEach((response, index) => validateResponse(response, index));
  return value;
}

function validateResponse(response, index) {
  requireValue(isPlainObject(response), `httpResponses[${index}] object`);
  requireValue(
    nonEmpty(response.requestId),
    `httpResponses[${index}] requestId`,
  );
  requireValue(nonEmpty(response.url), `httpResponses[${index}] url`);
  requireValue(nonEmpty(response.host), `httpResponses[${index}] host`);
  requireValue(
    RESPONSE_TYPES.has(response.type),
    `httpResponses[${index}] type`,
  );
  requireValue(
    typeof response.status === "number" &&
      Number.isFinite(response.status) &&
      Number.isInteger(response.status) &&
      response.status >= 100 &&
      response.status <= 599,
    `httpResponses[${index}] status`,
  );
  let url;
  try {
    url = new URL(response.url);
  } catch {
    throw new Error(`httpResponses[${index}] URL`);
  }
  requireValue(
    url.protocol === "http:" || url.protocol === "https:",
    `httpResponses[${index}] protocol`,
  );
  requireValue(
    response.host === url.host,
    `httpResponses[${index}] host mismatch`,
  );
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function requireValue(value, message) {
  if (!value) throw new Error(`E2E_CDP_HTTP_RESPONSE_INVALID: ${message}`);
}
