#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  BROWSER_MARKER_GROUPS,
  browserMarkerGroupsValid,
} from "./parity-history-browser-marker-contract.mjs";
import {
  CDP_EVIDENCE_SCHEMA,
  CDP_EVIDENCE_VERSION,
} from "./parity-history-cdp-capture.mjs";
import { cdpSessionFixture } from "./parity-history-cdp-session.fixture.mjs";
import { SUMMARY_HISTORY_STEP_CHECKS } from "./parity-history-summary-checks.mjs";

const validMarkers = markerFixture();
assert.equal(browserMarkerGroupsValid(validMarkers), true);
assert.equal(Object.isFrozen(BROWSER_MARKER_GROUPS), true);
assert.deepEqual(
  Object.fromEntries(
    Object.entries(BROWSER_MARKER_GROUPS).map(([name, keys]) => [
      name,
      keys.length,
    ]),
  ),
  {
    releaseDetailEvidence: 8,
    stagingStepEvidence: 4,
    envVersionsEvidence: 7,
    buildLogDrawer: 2,
    stagingRunLog: 2,
    productionRunLog: 3,
  },
);

for (const [groupName, keys] of Object.entries(BROWSER_MARKER_GROUPS)) {
  assert.equal(Object.isFrozen(keys), true);
  rejectsMarker((value) => delete value[groupName], `missing ${groupName}`);
  rejectsMarker((value) => (value[groupName] = []), `nonobject ${groupName}`);
  for (const key of keys) {
    rejectsMarker(
      (value) => delete value[groupName][key],
      `missing ${groupName}.${key}`,
    );
    rejectsMarker(
      (value) => (value[groupName][key] = false),
      `false ${groupName}.${key}`,
    );
    rejectsMarker(
      (value) => (value[groupName][key] = "true"),
      `nonboolean ${groupName}.${key}`,
    );
  }
}
assert.equal(
  browserMarkerGroupsValid({
    releaseDetailEvidence: validMarkers.releaseDetailEvidence,
  }),
  false,
);
rejectsMarker((value) => {
  value.releaseDetailEvidence.extraBoolean = false;
}, "extra false boolean");
validMarkers.releaseDetailEvidence.lifecycleEvidenceMismatchNote =
  "F510 note retained";
validMarkers.stagingStepEvidence.note = "existing producer note retained";
assert.equal(browserMarkerGroupsValid(validMarkers), true);

const validBrowser = browserResult(validMarkers);
assert.deepEqual(failedBrowserChecks(validBrowser), []);
const emptyResponses = structuredClone(validBrowser);
emptyResponses.httpResponses = [];
assert.ok(failedBrowserChecks(emptyResponses).includes("httpResponses"));

process.stdout.write("history summary marker contract self-test passed\n");

function markerFixture() {
  return Object.fromEntries(
    Object.entries(BROWSER_MARKER_GROUPS).map(([groupName, keys]) => [
      groupName,
      Object.fromEntries(keys.map((key) => [key, true])),
    ]),
  );
}

function rejectsMarker(mutate, label) {
  const value = markerFixture();
  mutate(value);
  assert.equal(browserMarkerGroupsValid(value), false, label);
}

function browserResult(markers) {
  return {
    driverExit: 0,
    requiredArtifacts: ["proof.txt"],
    artifacts: {
      "proof.txt": { sha256: "a".repeat(64), bytes: 16, kind: "text" },
    },
    cdpSchema: CDP_EVIDENCE_SCHEMA,
    cdpVersion: CDP_EVIDENCE_VERSION,
    cdpSessionIdentity: cdpSessionFixture(),
    consoleEvents: [],
    consoleErrors: [],
    badResponses: [],
    failedRequests: [],
    runtimeExceptions: [],
    httpResponses: [
      {
        requestId: "document-200",
        url: "https://example.test/",
        host: "example.test",
        type: "Document",
        status: 200,
      },
    ],
    ...markers,
  };
}

function failedBrowserChecks(value) {
  return SUMMARY_HISTORY_STEP_CHECKS["browser-pass"](value)
    .filter((item) => !item.pass)
    .map((item) => item.name);
}
