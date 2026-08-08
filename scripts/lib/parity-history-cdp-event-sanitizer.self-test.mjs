#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
  createCdpCapture,
  summarizeBrowserFailures,
} from "./parity-history-cdp-capture.mjs";
import {
  sanitizeConsoleArg,
  sanitizeOptionalText,
  sanitizeUrlWithHost,
} from "./parity-history-cdp-event-sanitizer.mjs";

const ACTIONS = [{ index: 0, type: "wait", milliseconds: 0 }];
const collector = createCdpCapture();
const events = [
  {
    method: "Runtime.consoleAPICalled",
    params: {
      type: "log",
      args: [
        { value: "Cookie: sid=F544-CONSOLE-VALUE" },
        { description: "Authorization: Custom F544-CONSOLE-DESCRIPTION" },
        { value: 42 },
        { value: true },
        { value: null },
        {
          value: { authorization: "F544-NESTED-OBJECT" },
          description: "Object Cookie: sid=F544-OBJECT-DESCRIPTION",
          type: "object",
        },
        { value: { token: "F544-NESTED-NO-DESCRIPTION" }, type: "object" },
      ],
    },
  },
  {
    method: "Runtime.exceptionThrown",
    params: {
      exceptionDetails: {
        text: "Authorization: Custom F544-EXCEPTION-TEXT",
        url: navUrl("F544-EXCEPTION-NAV", "F544-EXCEPTION-FRAGMENT"),
        lineNumber: 12,
        columnNumber: 34,
        exception: { description: "Cookie: sid=F544-EXCEPTION-DESCRIPTION" },
      },
    },
  },
  {
    method: "Log.entryAdded",
    params: {
      entry: {
        level: "warning",
        text: "Proxy-Authorization: Custom F544-LOG-TEXT",
        url: "https://example.test/log?api_key=F544-LOG-URL&safe=yes",
      },
    },
  },
  {
    method: "Network.requestWillBeSent",
    params: {
      requestId: "failed-nav",
      type: "XHR",
      request: { url: navUrl("F544-NAV-TOKEN", "F544-NAV-FRAGMENT") },
    },
  },
  {
    method: "Network.loadingFailed",
    params: {
      requestId: "failed-nav",
      type: "XHR",
      errorText: "Cookie: sid=F544-FAILED-ERROR",
      canceled: false,
    },
  },
  {
    method: "Network.responseReceived",
    params: {
      requestId: "document-ok",
      type: "Document",
      response: {
        url: "https://example.test/page?signature=F544-RESPONSE-URL&safe=yes",
        status: 200,
      },
    },
  },
];
events.forEach(collector.record);
collector.record({ method: "Runtime.consoleAPICalled", params: {} });
collector.record({ method: "Runtime.exceptionThrown", params: {} });
collector.record({ method: "Log.entryAdded", params: {} });
const evidence = collector.snapshot(ACTIONS);
assert.equal(evidence.schema, CDP_EVIDENCE_SCHEMA);
assert.equal(evidence.version, CDP_EVIDENCE_VERSION);
assert.doesNotThrow(() => summarizeBrowserFailures(evidence));

const persisted = JSON.stringify(evidence);
for (const secret of [
  "F544-CONSOLE-VALUE",
  "F544-CONSOLE-DESCRIPTION",
  "F544-NESTED-OBJECT",
  "F544-OBJECT-DESCRIPTION",
  "F544-NESTED-NO-DESCRIPTION",
  "F544-EXCEPTION-TEXT",
  "F544-EXCEPTION-NAV",
  "F544-EXCEPTION-FRAGMENT",
  "F544-EXCEPTION-DESCRIPTION",
  "F544-LOG-TEXT",
  "F544-LOG-URL",
  "F544-NAV-TOKEN",
  "F544-NAV-FRAGMENT",
  "F544-FAILED-ERROR",
  "F544-RESPONSE-URL",
  "alice",
  "password@",
]) {
  assert.doesNotMatch(persisted, new RegExp(secret), secret);
}
assert.deepEqual(evidence.console[0].args.slice(2, 5), [42, true, null]);
assert.equal(evidence.console[0].args[6], "[CDP:object]");
assert.equal(evidence.runtimeExceptions[0].line, 12);
assert.equal(evidence.runtimeExceptions[0].column, 34);
assert.equal(evidence.console[1].level, "warning");
assert.equal(evidence.failedRequests[0].requestId, "failed-nav");
assert.equal(evidence.failedRequests[0].type, "XHR");
assert.equal(evidence.failedRequests[0].canceled, false);
assert.match(evidence.failedRequests[0].url, /safe=yes/);
assert.equal(
  evidence.failedRequests[0].host,
  new URL(evidence.failedRequests[0].url).host,
);
assert.match(evidence.httpResponses[0].url, /safe=yes/);
assert.equal(evidence.httpResponses[0].requestId, "document-ok");
assert.equal(evidence.httpResponses[0].type, "Document");
assert.equal(evidence.httpResponses[0].status, 200);
assert.equal(
  evidence.httpResponses[0].host,
  new URL(evidence.httpResponses[0].url).host,
);
assert.equal(sanitizeConsoleArg({ value: 7 }), 7);
assert.equal(sanitizeConsoleArg({ value: false }), false);
assert.equal(sanitizeConsoleArg({ value: null }), null);
assert.equal(
  sanitizeConsoleArg({ description: "ordinary object", type: "object" }),
  "ordinary object",
);
assert.equal(sanitizeOptionalText(undefined), undefined);
assert.deepEqual(sanitizeUrlWithHost(undefined), {
  url: undefined,
  host: null,
});
const once = sanitizeConsoleArg({ value: "Cookie: sid=F544-IDEMPOTENT" });
assert.equal(sanitizeConsoleArg({ value: once }), once);
const onceUrl = sanitizeUrlWithHost(
  navUrl("F544-IDEMPOTENT-URL", "F544-IDEMPOTENT-FRAGMENT"),
);
assert.deepEqual(sanitizeUrlWithHost(onceUrl.url), onceUrl);
assert.equal(sanitizeOptionalText("x".repeat(5_000)).length, 4_000);

process.stdout.write("history CDP event sanitizer self-test passed\n");

function navUrl(token, fragment) {
  return `https://alice:password@example.test/page?token=${token}&safe=yes#${fragment}`;
}
