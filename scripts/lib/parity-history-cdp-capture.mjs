import {
  sanitizeCdpText,
  sanitizeCdpUrl,
} from "./parity-history-cdp-redaction.mjs";

const CAPTURED_TYPES = new Set(["Document", "Fetch", "XHR"]);
export const CDP_EVIDENCE_SCHEMA = "devpilot.parity-history.cdp-evidence";
export const CDP_EVIDENCE_VERSION = 1;

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
        text: sanitizeCdpText(details.text),
        url: sanitizeCdpUrl(details.url),
        line: details.lineNumber,
        column: details.columnNumber,
        description: sanitizeCdpText(details.exception?.description),
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
      schema: CDP_EVIDENCE_SCHEMA,
      version: CDP_EVIDENCE_VERSION,
      console: consoleEvents,
      runtimeExceptions,
      httpResponses,
      failedRequests,
    }),
  };
}

export function summarizeBrowserFailures(evidence = {}) {
  validateCdpEvidence(evidence);
  return {
    consoleErrors: evidence.console.filter(
      (event) =>
        (event.source === "runtime" && event.type === "error") ||
        (event.source === "log" && event.level === "error"),
    ),
    badResponses: evidence.httpResponses.filter(
      (response) => Number(response.status) >= 400,
    ),
    failedRequests: evidence.failedRequests,
    runtimeExceptions: evidence.runtimeExceptions,
  };
}

export function validateCdpEvidence(evidence) {
  const invalid = [];
  if (evidence?.schema !== CDP_EVIDENCE_SCHEMA) invalid.push("schema");
  if (evidence?.version !== CDP_EVIDENCE_VERSION) invalid.push("version");
  for (const field of [
    "console",
    "httpResponses",
    "failedRequests",
    "runtimeExceptions",
  ]) {
    if (!Array.isArray(evidence?.[field])) invalid.push(field);
  }
  if (invalid.length > 0) {
    throw new Error(`E2E_CDP_EVIDENCE_SCHEMA_INVALID: ${invalid.join(",")}`);
  }
  return evidence;
}

function isHttp(value) {
  return /^https?:\/\//i.test(value || "");
}

function hostOf(value) {
  if (!isHttp(value)) return null;
  return new URL(value).host;
}
