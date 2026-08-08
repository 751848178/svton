import {
  sanitizeConsoleArg,
  sanitizeOptionalText,
  sanitizeUrlWithHost,
} from "./parity-history-cdp-event-sanitizer.mjs";
import { validateCdpActionDescriptors } from "./parity-history-cdp-action-evidence.mjs";
import { validateHttpResponses } from "./parity-history-cdp-response-schema.mjs";

const CAPTURED_TYPES = new Set(["Document", "Fetch", "XHR"]);
export const CDP_EVIDENCE_SCHEMA = "devpilot.parity-history.cdp-evidence";
export const CDP_EVIDENCE_VERSION = 2;

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
        args: (Array.isArray(params.args) ? params.args : []).map(
          sanitizeConsoleArg,
        ),
      });
    } else if (method === "Runtime.exceptionThrown") {
      const details = params.exceptionDetails || {};
      runtimeExceptions.push({
        text: sanitizeOptionalText(details.text),
        url: sanitizeUrlWithHost(details.url).url,
        line: details.lineNumber,
        column: details.columnNumber,
        description: sanitizeOptionalText(details.exception?.description),
      });
    } else if (method === "Log.entryAdded") {
      consoleEvents.push({
        source: "log",
        type: "log",
        level: params.entry?.level,
        text: sanitizeOptionalText(params.entry?.text),
        url: sanitizeUrlWithHost(params.entry?.url).url,
      });
    } else if (method === "Network.requestWillBeSent") {
      const location = sanitizeUrlWithHost(params.request?.url);
      requests.set(params.requestId, {
        url: location.url,
        host: location.host,
        type: params.type,
      });
    } else if (
      method === "Network.responseReceived" &&
      CAPTURED_TYPES.has(params.type) &&
      isHttp(params.response?.url)
    ) {
      const location = sanitizeUrlWithHost(params.response.url);
      httpResponses.push({
        requestId: params.requestId,
        url: location.url,
        host: location.host,
        type: params.type,
        status: params.response.status,
      });
    } else if (method === "Network.loadingFailed") {
      const request = requests.get(params.requestId) || {};
      failedRequests.push({
        requestId: params.requestId,
        url: request.url ?? null,
        host: request.host ?? null,
        type: params.type || request.type || null,
        errorText: sanitizeOptionalText(params.errorText),
        canceled: params.canceled === true,
      });
    }
  }

  return {
    record,
    snapshot: (actions = []) => ({
      schema: CDP_EVIDENCE_SCHEMA,
      version: CDP_EVIDENCE_VERSION,
      actions,
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
      (response) => response.status >= 400,
    ),
    failedRequests: evidence.failedRequests,
    runtimeExceptions: evidence.runtimeExceptions,
  };
}

export function validateCdpEvidence(evidence) {
  const invalid = [];
  if (evidence?.schema !== CDP_EVIDENCE_SCHEMA) invalid.push("schema");
  if (evidence?.version !== CDP_EVIDENCE_VERSION) invalid.push("version");
  if (Object.hasOwn(evidence || {}, "rawActions")) invalid.push("rawActions");
  try {
    validateCdpActionDescriptors(evidence?.actions);
  } catch {
    invalid.push("actions");
  }
  for (const field of [
    "console",
    "httpResponses",
    "failedRequests",
    "runtimeExceptions",
  ]) {
    if (!Array.isArray(evidence?.[field])) invalid.push(field);
  }
  if (!invalid.includes("httpResponses")) {
    try {
      validateHttpResponses(evidence.httpResponses);
    } catch {
      invalid.push("httpResponses");
    }
  }
  if (invalid.length > 0) {
    throw new Error(`E2E_CDP_EVIDENCE_SCHEMA_INVALID: ${invalid.join(",")}`);
  }
  return evidence;
}

function isHttp(value) {
  return /^https?:\/\//i.test(value || "");
}
