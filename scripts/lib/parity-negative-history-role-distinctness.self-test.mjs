#!/usr/bin/env node
import assert from "node:assert/strict";
import { productionResultsFixture } from "./parity-negative-history-production-fixture.mjs";
import { versionChainsFixture } from "./parity-negative-history-summary-fixture.mjs";
import { stagingResultsFixture } from "./parity-negative-history-staging-fixture.mjs";
import { historyStepChecks } from "./parity-history-e2e-evidence.mjs";
import {
  acceptanceFromSteps,
  historyDocumentFixture,
} from "./parity-negative-history-contract-fixture.mjs";
import {
  GENERATED_ROLE_MODEL_GROUPS,
  validateGeneratedRoleDistinctness,
} from "./parity-negative-history-role-distinctness.mjs";
import {
  fixtureAnchors,
  parseHistory,
  rejectIdentity,
} from "./parity-negative-history-identity-test-support.mjs";

const anchors = fixtureAnchors(historyDocumentFixture());
assert.doesNotThrow(() => validateGeneratedRoleDistinctness(anchors));

for (const [model, fields] of Object.entries(GENERATED_ROLE_MODEL_GROUPS)) {
  assert.throws(
    () =>
      validateGeneratedRoleDistinctness({
        ...anchors,
        [fields[0]]: anchors[fields[1]],
      }),
    undefined,
    `duplicate within ${model}`,
  );
}

const reused = { ...anchors };
for (const fields of Object.values(GENERATED_ROLE_MODEL_GROUPS)) {
  reused[fields[0]] = "cross-model-reuse";
}
assert.doesNotThrow(() => validateGeneratedRoleDistinctness(reused));
assert.throws(() =>
  validateGeneratedRoleDistinctness({ ...anchors, buildRunId: "" }),
);
assert.throws(() =>
  validateGeneratedRoleDistinctness({ ...anchors, buildRunB2: 42 }),
);

const b2EqualsA2 = rebuildDocument({
  ...anchors,
  buildRunB2: anchors.productionApprovalA2,
});
assert.equal(parseHistory(b2EqualsA2).historyIdentityGraphValid, true);

rejectIdentity(
  "EnvironmentVersion cross environment reuse",
  (document, trusted) => {
    document.steps["staging-upgrade"].result.newEnvironmentVersion.id =
      trusted.productionVersionV2;
  },
  ["staging-upgrade"],
);
rejectIdentity(
  "DeploymentRun reuse",
  (document, trusted) => {
    document.steps["production-recovery-execute"].result =
      productionResultsFixture({
        ...trusted,
        productionDeploymentRunD3: trusted.productionDeploymentRunD2,
      })["production-recovery-execute"];
  },
  ["production-recovery-execute"],
);
rejectIdentity(
  "ReleaseRun reuse",
  (document) => {
    const standard = document.steps["production-confirm"].result;
    const recovery = document.steps["production-recovery-confirm"].result;
    recovery.releaseRunId = standard.releaseRunId;
  },
  ["production-recovery-confirm"],
);
rejectIdentity(
  "OperationApproval reuse",
  (document, trusted) => {
    document.steps["production-recovery-confirm"].result.approvalId =
      trusted.productionApprovalA2;
  },
  ["production-recovery-confirm"],
);

process.stdout.write("negative history role distinctness self-test passed\n");

function rebuildDocument(identity) {
  const document = historyDocumentFixture();
  const results = {
    ...stagingResultsFixture(identity),
    ...productionResultsFixture(identity),
    "version-chains": versionChainsFixture(identity),
  };
  for (const [name, result] of Object.entries(results)) {
    document.steps[name] = {
      ok: true,
      status: "passed",
      verified: true,
      checks: historyStepChecks(name, result),
      result,
    };
  }
  document.ac = acceptanceFromSteps(document.steps);
  return document;
}
