const CAPTURED_TYPES = new Set(["Document", "Fetch", "XHR"]);

export function createCdpCapture() {
  const consoleEvents = [];
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
  };
}

function isHttp(value) {
  return /^https?:\/\//i.test(value || "");
}

function hostOf(value) {
  if (!isHttp(value)) return null;
  return new URL(value).host;
}
