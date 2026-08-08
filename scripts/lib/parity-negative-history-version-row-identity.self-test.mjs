#!/usr/bin/env node
import assert from "node:assert/strict";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import {
  parseHistory,
  rejectIdentity,
} from "./parity-negative-history-identity-test-support.mjs";
import { versionRowResult } from "./parity-negative-history-version-row-result.mjs";
import { validateVersionRow } from "./parity-negative-history-version-row-identity.mjs";

const row = versionRowResult(
  {
    id: "v1",
    kind: "upgrade",
    previousVersionId: "v0",
    artifactManifestId: "m1",
    deploymentRunId: "d1",
  },
  "v0",
  "previousIsVprod1",
);
assert.deepEqual(Object.keys(row).sort(), [
  "artifactManifestId",
  "deploymentRunId",
  "id",
  "kind",
  "previousIsVprod1",
  "previousVersionId",
]);
assert.equal(row.previousIsVprod1, true);
const falseClaim = versionRowResult(
  {
    id: "v1",
    kind: "upgrade",
    previousVersionId: "v0",
    artifactManifestId: "m1",
    deploymentRunId: "d1",
  },
  "v9",
  "previousIsVprod1",
);
assert.equal(falseClaim.previousIsVprod1, false);

const CONFIGS = {
  "staging-upgrade": {
    kind: "upgrade",
    previousId: "staging-v2",
    claimKey: "previousIsVst2",
    manifestId: "manifest-2",
    deploymentRunId: "staging-deploy-3",
  },
  "staging-recovery": {
    kind: "recovery",
    previousId: "staging-v3",
    claimKey: "previousIsVst3",
    manifestId: "manifest-1",
    deploymentRunId: "staging-deploy-4",
  },
  "production-upgrade-execute": {
    kind: "upgrade",
    previousId: "production-v1",
    claimKey: "previousIsVprod1",
    manifestId: "manifest-2",
    deploymentRunId: "production-deploy-2",
  },
  "production-recovery-execute": {
    kind: "recovery",
    previousId: "production-v2",
    claimKey: "previousIsVprod2",
    manifestId: "manifest-1",
    deploymentRunId: "production-deploy-3",
  },
};

for (const [step, expected] of Object.entries(CONFIGS)) {
  const valid = { newEnvironmentVersion: makeRow(expected) };
  validateVersionRow(valid, expected, step);
  for (const [label, mutate] of [
    [
      "wrong artifactManifestId",
      (r) => (r.artifactManifestId = "claimed-manifest"),
    ],
    ["wrong deploymentRunId", (r) => (r.deploymentRunId = "claimed-deploy")],
    ["missing key", (r) => delete r.deploymentRunId],
    ["extra key", (r) => (r.claimed = true)],
    ["wrong kind", (r) => (r.kind = "deploy")],
    [
      "wrong previousVersionId",
      (r) => (r.previousVersionId = "claimed-previous"),
    ],
    ["claim false", (r) => (r[expected.claimKey] = false)],
    ["empty id", (r) => (r.id = "")],
    ["non-string id", (r) => (r.id = 42)],
  ]) {
    assert.throws(
      () =>
        validateVersionRow(
          { newEnvironmentVersion: mutatedRow(expected, mutate) },
          expected,
          `${step}:${label}`,
        ),
      undefined,
      `${step}:${label}`,
    );
  }
}

assert.equal(parseHistory(historyDocumentFixture()).historyContractValid, true);

for (const step of Object.keys(CONFIGS)) {
  rejectIdentity(
    `coherent row foreign keys substituted: ${step}`,
    (value) => {
      const row = value.steps[step].result.newEnvironmentVersion;
      row.artifactManifestId = "claimed-manifest";
      row.deploymentRunId = "claimed-deploy";
    },
    [step],
  );
  rejectIdentity(
    `coherent action manifest swapped: ${step}`,
    (value) => {
      const result = value.steps[step].result;
      result.manifestId = "claimed-manifest";
      result.expectedManifestId = "claimed-manifest";
      result.newEnvironmentVersion.artifactManifestId = "claimed-manifest";
    },
    [step],
  );
}

process.stdout.write(
  "negative history version row identity self-test passed\n",
);

function makeRow(expected) {
  return {
    id: "version-x",
    kind: expected.kind,
    previousVersionId: expected.previousId,
    [expected.claimKey]: true,
    artifactManifestId: expected.manifestId,
    deploymentRunId: expected.deploymentRunId,
  };
}

function mutatedRow(expected, mutate) {
  const candidate = { ...makeRow(expected) };
  mutate(candidate);
  return candidate;
}
