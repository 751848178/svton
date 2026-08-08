const CAPTURED_TYPES = new Set(["Document", "Fetch", "XHR"]);

export function createCdpCapture() {
  const consoleEvents = [];
  const runtimeExceptions = [];
  const httpResponses = [];
  const failedRequests = [];
  const requests = new Map();

  function record(message) {
    const { method, params = {} } = message;
    if (method === "Runtime.consoleAPICalled") {
      consoleEvents.push({
        source: "runtime",
        type: params.type,
        args: (params.args || []).map(
          (arg) => arg.value ?? arg.description ?? arg.type,
        ),
      });
    } else if (method === "Runtime.exceptionThrown") {
      const details = params.exceptionDetails || {};
      runtimeExceptions.push({
        text: sanitizeText(details.text),
        url: sanitizeUrl(details.url),
        line: details.lineNumber,
        column: details.columnNumber,
        description: sanitizeText(details.exception?.description),
      });
    } else if (method === "Log.entryAdded") {
      consoleEvents.push({
        source: "log",
        type: "log",
        level: params.entry?.level,
        text: params.entry?.text,
        url: params.entry?.url,
      });
    } else if (method === "Network.requestWillBeSent") {
      requests.set(params.requestId, {
        url: params.request?.url,
        type: params.type,
      });
    } else if (
      method === "Network.responseReceived" &&
      CAPTURED_TYPES.has(params.type) &&
      isHttp(params.response?.url)
    ) {
      httpResponses.push({
        requestId: params.requestId,
        url: params.response.url,
        host: hostOf(params.response.url),
        type: params.type,
        status: params.response.status,
      });
    } else if (method === "Network.loadingFailed") {
      const request = requests.get(params.requestId) || {};
      failedRequests.push({
        requestId: params.requestId,
        url: request.url || null,
        host: hostOf(request.url),
        type: params.type || request.type || null,
        errorText: params.errorText,
        canceled: params.canceled === true,
      });
    }
  }

  return {
    record,
    snapshot: () => ({
      console: consoleEvents,
      runtimeExceptions,
      httpResponses,
      failedRequests,
    }),
  };
}

export function summarizeBrowserFailures(evidence = {}) {
  return {
    consoleErrors: (evidence.console || []).filter(
      (event) =>
        (event.source === "runtime" && event.type === "error") ||
        (event.source === "log" && event.level === "error"),
    ),
    badResponses: (evidence.httpResponses || []).filter(
      (response) => Number(response.status) >= 400,
    ),
    failedRequests: evidence.failedRequests || [],
    runtimeExceptions: evidence.runtimeExceptions,
  };
}

function sanitizeText(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(
      /((?:access[_-]?token|authorization|password|secret)\s*[:=]\s*)[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .slice(0, 4000);
}

function sanitizeUrl(value) {
  if (typeof value !== "string") return value;
  try {
    const url = new URL(value);
    if (url.username) url.username = "[REDACTED]";
    if (url.password) url.password = "[REDACTED]";
    for (const key of url.searchParams.keys()) {
      if (/(?:token|authorization|password|secret)/i.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return sanitizeText(value);
  }
}

function isHttp(value) {
  return /^https?:\/\//i.test(value || "");
}

function hostOf(value) {
  if (!isHttp(value)) return null;
  return new URL(value).host;
}
