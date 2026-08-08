#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  createCdpCapture,
  summarizeBrowserFailures,
  validateCdpEvidence,
} from "./parity-history-cdp-capture.mjs";

const ACTIONS = [{ index: 0, type: "wait", milliseconds: 0 }];

const valid = capture([
  response("Document", 200, "https://example.test/"),
  response("Fetch", 204, "https://example.test/api"),
  response("XHR", 201, "http://api.example.test/items"),
]);
assert.equal(validateCdpEvidence(valid), valid);
assert.deepEqual(summarizeBrowserFailures(valid).badResponses, []);

rejects((evidence) => {
  evidence.httpResponses = [];
});
for (const field of ["requestId", "url", "host", "type", "status"]) {
  rejects((evidence) => delete evidence.httpResponses[0][field]);
}
for (const status of ["200", Number.NaN, Number.POSITIVE_INFINITY, 99, 600]) {
  rejects((evidence) => {
    evidence.httpResponses[0].status = status;
  });
}
rejects((evidence) => {
  evidence.httpResponses[0].host = "other.test";
});
rejects((evidence) => {
  evidence.httpResponses[0].url = "not-a-url";
});
rejects((evidence) => {
  evidence.httpResponses[0].url = "file:///tmp/proof";
  evidence.httpResponses[0].host = "";
});
rejects((evidence) => {
  evidence.httpResponses[0].type = "WebSocket";
});
for (const malformed of [null, [], "response"]) {
  rejects((evidence) => {
    evidence.httpResponses[0] = malformed;
  });
}

const document500 = capture([
  response("Document", 500, "https://example.test/failure"),
]);
assert.equal(validateCdpEvidence(document500), document500);
assert.deepEqual(summarizeBrowserFailures(document500).badResponses, [
  document500.httpResponses[0],
]);

process.stdout.write("history CDP response schema self-test passed\n");

function rejects(mutate) {
  const evidence = structuredClone(valid);
  mutate(evidence);
  assert.throws(
    () => validateCdpEvidence(evidence),
    /E2E_CDP_EVIDENCE_SCHEMA_INVALID/,
  );
}

function capture(events) {
  const collector = createCdpCapture();
  events.forEach(collector.record);
  return collector.snapshot(ACTIONS);
}

function response(type, status, url) {
  return {
    method: "Network.responseReceived",
    params: {
      requestId: `${type}-${status}`,
      type,
      response: { url, status },
    },
  };
}
