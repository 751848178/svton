#!/usr/bin/env node
import assert from "node:assert/strict";
import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
  createCdpCapture,
  summarizeBrowserFailures,
} from "./parity-history-cdp-capture.mjs";

assertRejected([
  {
    method: "Runtime.consoleAPICalled",
    params: { type: "error", args: [{ value: "boom" }] },
  },
]);
assertRejected([
  {
    method: "Log.entryAdded",
    params: { entry: { level: "error", text: "log boom" } },
  },
]);
const runtimeException = capture([
  {
    method: "Runtime.exceptionThrown",
    params: {
      exceptionDetails: {
        text: "Uncaught ReferenceError",
        url: "http://localhost:4131/app.js?token=secret",
        lineNumber: 12,
        columnNumber: 34,
        exception: { description: "ReferenceError: boom password=secret" },
      },
    },
  },
]);
assert.ok(failedChecks(runtimeException).length > 0);
assert.deepEqual(runtimeException.runtimeExceptions, [
  {
    text: "Uncaught ReferenceError",
    url: "http://localhost:4131/app.js?token=%5BREDACTED%5D",
    line: 12,
    column: 34,
    description: "ReferenceError: boom password=[REDACTED]",
  },
]);
assert.doesNotMatch(JSON.stringify(runtimeException), /secret/);
assertRejected([response("Fetch", 500, "/api/fail")]);
assertRejected([response("XHR", 404, "/api/missing")]);
assertRejected([
  request("failed", "Fetch", "/api/offline"),
  {
    method: "Network.loadingFailed",
    params: {
      requestId: "failed",
      type: "Fetch",
      errorText: "net::ERR_FAILED",
    },
  },
]);

const clean = capture([
  response("Document", 200, "/projects/order"),
  response("Fetch", 204, "/api/ok"),
]);
assert.equal(clean.schema, CDP_EVIDENCE_SCHEMA);
assert.equal(clean.version, CDP_EVIDENCE_VERSION);
assert.deepEqual(clean.runtimeExceptions, []);
assert.deepEqual(failedChecks(clean), []);
assert.deepEqual(failedChecks(capture([])), []);
assert.deepEqual(
  clean.httpResponses.map(({ host, type, status }) => ({ host, type, status })),
  [
    { host: "localhost:4131", type: "Document", status: 200 },
    { host: "localhost:4131", type: "Fetch", status: 204 },
  ],
);
for (const field of [
  "console",
  "httpResponses",
  "failedRequests",
  "runtimeExceptions",
]) {
  rejectsSchema(clean, (evidence) => delete evidence[field]);
  rejectsSchema(clean, (evidence) => {
    evidence[field] = {};
  });
}
rejectsSchema(clean, (evidence) => delete evidence.version);
rejectsSchema(clean, (evidence) => {
  evidence.version += 1;
});
rejectsSchema(clean, (evidence) => delete evidence.schema);
rejectsSchema(clean, (evidence) => {
  evidence.schema = "wrong";
});

process.stdout.write("history CDP capture self-test passed\n");

function assertRejected(events) {
  assert.ok(failedChecks(capture(events)).length > 0);
}

function failedChecks(evidence) {
  const failures = summarizeBrowserFailures(evidence);
  const result = {
    driverExit: 0,
    requiredArtifacts: ["proof.txt"],
    artifacts: {
      "proof.txt": { sha256: "a".repeat(64), bytes: 16, kind: "text" },
    },
    cdpSchema: evidence.schema,
    cdpVersion: evidence.version,
    consoleEvents: evidence.console,
    consoleErrors: failures.consoleErrors,
    badResponses: failures.badResponses,
    failedRequests: failures.failedRequests,
    runtimeExceptions: failures.runtimeExceptions,
    httpResponses: evidence.httpResponses,
    releaseDetailEvidence: { marker: true },
  };
  return historyStepChecks("browser-pass", result).filter((item) => !item.pass);
}

function rejectsSchema(source, mutate) {
  const evidence = structuredClone(source);
  mutate(evidence);
  assert.throws(
    () => summarizeBrowserFailures(evidence),
    /E2E_CDP_EVIDENCE_SCHEMA_INVALID/,
  );
}

function capture(events) {
  const collector = createCdpCapture();
  events.forEach(collector.record);
  return collector.snapshot();
}

function response(type, status, pathname) {
  return {
    method: "Network.responseReceived",
    params: {
      requestId: `${type}-${status}`,
      type,
      response: { url: `http://localhost:4131${pathname}`, status },
    },
  };
}

function request(requestId, type, pathname) {
  return {
    method: "Network.requestWillBeSent",
    params: {
      requestId,
      type,
      request: { url: `http://localhost:4131${pathname}` },
    },
  };
}
