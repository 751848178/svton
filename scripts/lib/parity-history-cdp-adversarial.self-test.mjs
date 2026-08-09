#!/usr/bin/env node
// F525: adversarial coverage for the remaining CDP/browser evidence gaps.
//
// These cases deliberately fill what F522-F534 left uncovered:
//   1. A Document (top-level page navigation) HTTP response with status >= 400
//      must fail the browser-pass step check explicitly. F531 covered Fetch/XHR
//      4xx/5xx and a capture-level Document 500; this asserts the gate rejects
//      Document 4xx/5xx at the step-check level where the run is actually
//      accepted/rejected.
//   2. Network.loadingFailed must preserve the precise URL and host derived
//      from the preceding requestWillBeSent, the errorText, and must fail the
//      browser-pass step check via failedRequests. F530/F544 only asserted the
//      host as a redaction side-effect, never the full precise-url/host/error
//      contract nor the step-check failure.
import assert from "node:assert/strict";
import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";
import { BROWSER_MARKER_GROUPS } from "./parity-history-browser-marker-contract.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
  createCdpCapture,
  summarizeBrowserFailures,
} from "./parity-history-cdp-capture.mjs";
import { cdpSessionFixture } from "./parity-history-cdp-session.fixture.mjs";

const ACTIONS = [{ index: 0, type: "wait", milliseconds: 0 }];
const DOCUMENT_HOST = "localhost:4131";

// --- (1) Document HTTP >= 400 fails the browser-pass step check explicitly ---
for (const status of [400, 401, 403, 404, 500, 502, 503]) {
  const evidence = capture([documentResponse(status)]);
  assert.equal(evidence.httpResponses.length, 1);
  assert.equal(evidence.httpResponses[0].type, "Document");
  assert.equal(evidence.httpResponses[0].status, status);
  const failures = failedBrowserChecks(evidence);
  assert.ok(
    failures.includes("badResponses"),
    `Document ${status} should surface as a badResponse`,
  );
  assert.ok(
    failures.includes("httpResponses"),
    `Document ${status} should fail the httpResponses gate (status >= 400)`,
  );
  assert.equal(
    summarizeBrowserFailures(evidence).badResponses[0].status,
    status,
  );
}

// A successful Document response does NOT trip the badResponses/httpResponses gate.
const okDocument = capture([documentResponse(200)]);
assert.deepEqual(failedBrowserChecks(okDocument), []);

// --- (2) Network.loadingFailed preserves precise URL + host + errorText and
//         fails the browser-pass step check via failedRequests ---
// A valid Document response is included so the evidence schema (which requires a
// non-empty httpResponses array) validates; the failedRequests gate still trips.
const failedEvidence = capture([
  documentResponse(200),
  request(
    "doc-failed",
    "Document",
    "https://localhost:4131/projects/42?ref=fail",
  ),
  {
    method: "Network.loadingFailed",
    params: {
      requestId: "doc-failed",
      type: "Document",
      errorText: "net::ERR_CONNECTION_REFUSED",
      canceled: false,
    },
  },
]);
assert.equal(failedEvidence.failedRequests.length, 1);
const failure = failedEvidence.failedRequests[0];
assert.equal(failure.requestId, "doc-failed");
assert.equal(failure.url, "https://localhost:4131/projects/42?ref=fail");
assert.equal(failure.host, "localhost:4131");
assert.equal(failure.type, "Document");
assert.equal(failure.errorText, "net::ERR_CONNECTION_REFUSED");
assert.equal(failure.canceled, false);
const failedChecks = failedBrowserChecks(failedEvidence);
assert.ok(
  failedChecks.includes("failedRequests"),
  "loadingFailed should fail the failedRequests step check",
);

// Two failed requests of different hosts both preserve their own precise host,
// proving the URL/host derivation is per-request, not a shared/global value.
// A valid Document response is included so the evidence schema (which requires a
// non-empty httpResponses array) validates; the failedRequests gate still trips.
const multiEvidence = capture([
  documentResponse(200),
  request("a", "Fetch", "https://api.example.test/v1/boom"),
  {
    method: "Network.loadingFailed",
    params: { requestId: "a", type: "Fetch", errorText: "net::ERR_FAILED" },
  },
  request("b", "Fetch", "https://cdn.other.test/asset.js"),
  {
    method: "Network.loadingFailed",
    params: { requestId: "b", type: "Fetch", errorText: "net::ERR_TIMED_OUT" },
  },
]);
assert.equal(multiEvidence.failedRequests.length, 2);
assert.deepEqual(
  multiEvidence.failedRequests.map((item) => item.host),
  ["api.example.test", "cdn.other.test"],
);
assert.deepEqual(
  multiEvidence.failedRequests.map((item) => item.url),
  ["https://api.example.test/v1/boom", "https://cdn.other.test/asset.js"],
);
assert.ok(
  failedBrowserChecks(multiEvidence).includes("failedRequests"),
  "two loadingFailed should fail the failedRequests step check",
);

// A loadingFailed with no preceding requestWillBeSent carries null url/host but
// still records the requestId, errorText and fails the step check.
const orphanEvidence = capture([
  documentResponse(200),
  {
    method: "Network.loadingFailed",
    params: {
      requestId: "orphan",
      type: "Fetch",
      errorText: "net::ERR_ABORTED",
    },
  },
]);
assert.equal(orphanEvidence.failedRequests[0].url, null);
assert.equal(orphanEvidence.failedRequests[0].host, null);
assert.equal(orphanEvidence.failedRequests[0].errorText, "net::ERR_ABORTED");
assert.ok(
  failedBrowserChecks(orphanEvidence).includes("failedRequests"),
  "orphan loadingFailed should still fail the failedRequests step check",
);

// Next can cancel same-origin RSC prefetches during navigation. The raw event
// remains in CDP evidence, but this exact canceled Fetch shape is not a runtime
// failure. Cross-origin and non-RSC aborts remain fail-closed.
const expectedRscAbort = capture([
  documentResponse(200),
  request("rsc", "Fetch", `http://${DOCUMENT_HOST}/projects?_rsc=abc`),
  loadingFailed("rsc", true),
]);
assert.equal(expectedRscAbort.failedRequests.length, 1);
assert.deepEqual(failedBrowserChecks(expectedRscAbort), []);

for (const [label, url] of [
  ["cross-origin", "https://other.example.test/projects?_rsc=abc"],
  ["non-rsc", `http://${DOCUMENT_HOST}/api/projects`],
]) {
  const evidence = capture([
    documentResponse(200),
    request(label, "Fetch", url),
    loadingFailed(label, true),
  ]);
  assert.ok(
    failedBrowserChecks(evidence).includes("failedRequests"),
    `${label} abort must remain a failure`,
  );
}

process.stdout.write("history CDP adversarial self-test passed\n");

function documentResponse(status) {
  return {
    method: "Network.responseReceived",
    params: {
      requestId: `Document-${status}`,
      type: "Document",
      response: { url: `http://${DOCUMENT_HOST}/`, status },
    },
  };
}

function request(requestId, type, url) {
  return {
    method: "Network.requestWillBeSent",
    params: { requestId, type, request: { url } },
  };
}

function loadingFailed(requestId, canceled) {
  return {
    method: "Network.loadingFailed",
    params: {
      requestId,
      type: "Fetch",
      errorText: "net::ERR_ABORTED",
      canceled,
    },
  };
}

function capture(events) {
  const collector = createCdpCapture();
  events.forEach(collector.record);
  return { ...collector.snapshot(ACTIONS), session: cdpSessionFixture() };
}

function failedBrowserChecks(evidence) {
  const failures = summarizeBrowserFailures(evidence);
  const result = {
    driverExit: 0,
    requiredArtifacts: ["proof.txt"],
    artifacts: {
      "proof.txt": { sha256: "a".repeat(64), bytes: 16, kind: "text" },
    },
    cdpSchema: CDP_EVIDENCE_SCHEMA,
    cdpVersion: CDP_EVIDENCE_VERSION,
    cdpSessionIdentity: evidence.session,
    consoleEvents: evidence.console,
    consoleErrors: failures.consoleErrors,
    badResponses: failures.badResponses,
    failedRequests: failures.failedRequests,
    runtimeExceptions: failures.runtimeExceptions,
    httpResponses: evidence.httpResponses,
    ...markerFixture(),
  };
  return historyStepChecks("browser-pass", result)
    .filter((item) => !item.pass)
    .map((item) => item.name);
}

function markerFixture() {
  return Object.fromEntries(
    Object.entries(BROWSER_MARKER_GROUPS).map(([groupName, keys]) => [
      groupName,
      Object.fromEntries(keys.map((key) => [key, true])),
    ]),
  );
}
