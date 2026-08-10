import {
  sanitizeCdpText,
  sanitizeCdpUrl,
} from "./parity-history-cdp-redaction.mjs";

export function sanitizeRuntimeConsole(params = {}) {
  return {
    source: "runtime",
    type: sanitizeCdpText(params.type),
    args: (params.args || []).map(sanitizeConsoleArgument),
  };
}

export function sanitizeRuntimeException(details = {}) {
  return {
    text: sanitizeCdpText(details.text),
    url: sanitizeCdpUrl(details.url),
    line: details.lineNumber,
    column: details.columnNumber,
    description: sanitizeCdpText(details.exception?.description),
  };
}

export function sanitizeLogEntry(entry = {}) {
  return {
    source: "log",
    type: "log",
    level: sanitizeCdpText(entry.level),
    text: sanitizeCdpText(entry.text),
    url: sanitizeCdpUrl(entry.url),
  };
}

export function sanitizeNetworkRequest(params = {}) {
  return {
    url: sanitizeCdpUrl(params.request?.url),
    type: params.type,
  };
}

export function sanitizeNetworkResponse(params = {}) {
  const location = sanitizeNetworkLocation(params.response?.url);
  return {
    requestId: params.requestId,
    ...location,
    type: params.type,
    status: params.response?.status,
  };
}

export function sanitizeNetworkFailure(params = {}, request = {}) {
  const location = sanitizeNetworkLocation(request.url);
  return {
    requestId: params.requestId,
    ...location,
    type: params.type || request.type || null,
    errorText: sanitizeCdpText(params.errorText),
    canceled: params.canceled === true,
  };
}

function sanitizeConsoleArgument(arg = {}) {
  if (typeof arg.value === "string") return sanitizeCdpText(arg.value);
  if (typeof arg.value === "number" || typeof arg.value === "boolean") {
    return arg.value;
  }
  const description = [arg.unserializableValue, arg.description, arg.type].find(
    (value) => typeof value === "string",
  );
  return sanitizeCdpText(description);
}

function sanitizeNetworkLocation(value) {
  const url = sanitizeCdpUrl(value) ?? null;
  return { url, host: hostFromSanitizedUrl(url) };
}

function hostFromSanitizedUrl(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.host
      : null;
  } catch {
    return null;
  }
}
