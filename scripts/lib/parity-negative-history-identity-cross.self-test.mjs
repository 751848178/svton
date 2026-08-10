#!/usr/bin/env node
import assert from "node:assert/strict";
import { productionResultsFixture } from "./parity-negative-history-production-fixture.mjs";
import { HISTORY_RESULT_KEY_INVENTORY } from "./parity-negative-history-result-key-inventory.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { rejectIdentity } from "./parity-negative-history-identity-test-support.mjs";

const fixture = historyDocumentFixture();
for (const [step, expectedKeys] of Object.entries(
  HISTORY_RESULT_KEY_INVENTORY,
)) {
  assert.deepEqual(
    Object.keys(fixture.steps[step].result).sort(),
    expectedKeys,
    step,
  );
}

rejectAction("nested gate order", { orderId: "claimed-order" }, "upgrade");
rejectAction(
  "nested route roots",
  {
    teamId: "claimed-team",
    projectId: "claimed-project",
    productionTargetRef: "claimed-target",
  },
  "upgrade",
);
rejectAction(
  "nested route snapshot",
  {
    productionRouteSnapshot: {
      domains: ["claimed.example.test"],
      proxyTarget: "http://claimed",
      tlsRequired: false,
    },
  },
  "recovery",
);
rejectIdentity(
  "gate B1/B2 swap",
  (document, anchors) => {
    document.steps["production-upgrade-execute"].result = actionResult(
      { ...anchors, buildRunB2: anchors.buildRunId },
      "upgrade",
    );
  },
  ["production-upgrade-execute"],
);
rejectIdentity(
  "M1/M2 swap",
  (document, anchors) => {
    const result = document.steps["staging-recovery"].result;
    result.manifestId = anchors.manifestM2;
    result.expectedManifestId = anchors.manifestM2;
  },
  ["staging-recovery"],
);
rejectIdentity(
  "staging/production environment swap",
  (document, anchors) => {
    const result = document.steps["staging-upgrade"].result;
    result.environmentId = anchors.productionEnvId;
    result.expectedEnvironmentId = anchors.productionEnvId;
  },
  ["staging-upgrade"],
);
rejectIdentity(
  "standard/recovery approval swap",
  (document) => {
    const standard = document.steps["production-approve"].result;
    const recovery = document.steps["production-recovery-approve"].result;
    [standard.approvalId, recovery.approvalId] = [
      recovery.approvalId,
      standard.approvalId,
    ];
  },
  ["production-approve", "production-recovery-approve"],
);
rejectIdentity(
  "standard/recovery release swap",
  (document, anchors) => {
    const swapped = {
      ...anchors,
      productionReleaseRunR2: anchors.productionReleaseRunR3,
      productionReleaseRunR3: anchors.productionReleaseRunR2,
    };
    document.steps["production-upgrade-execute"].result = actionResult(
      swapped,
      "upgrade",
    );
    document.steps["production-recovery-execute"].result = actionResult(
      swapped,
      "recovery",
    );
  },
  ["production-upgrade-execute", "production-recovery-execute"],
);
rejectIdentity(
  "standard/recovery deployment reuse",
  (document, anchors) => {
    document.steps["production-recovery-execute"].result = actionResult(
      {
        ...anchors,
        productionDeploymentRunD3: anchors.productionDeploymentRunD2,
      },
      "recovery",
    );
  },
  ["production-recovery-execute"],
);
rejectIdentity(
  "staging/production version reuse",
  (document, anchors) => {
    document.steps["staging-upgrade"].result.newEnvironmentVersion.id =
      anchors.productionVersionV2;
  },
  ["staging-upgrade"],
);
rejectIdentity(
  "build/manifest role reuse",
  (document) => {
    const build = document.steps["build-2"].result;
    build.manifestId = build.buildRunId;
  },
  ["build-2"],
);
rejectIdentity(
  "corrupt chain with true booleans",
  (document) => {
    document.steps["version-chains"].result.staging.chain[2].id =
      "claimed-chain-version";
  },
  ["version-chains"],
);
rejectIdentity(
  "coherent release summary substitution",
  (document) => {
    const result = document.steps["version-chains"].result;
    result.expectedReleaseRuns[1].id = "claimed-release";
    result.releaseRuns[1].id = "claimed-release";
  },
  ["version-chains"],
);

process.stdout.write("negative history identity cross self-test passed\n");

function rejectAction(label, replacements, kind) {
  const step =
    kind === "upgrade"
      ? "production-upgrade-execute"
      : "production-recovery-execute";
  rejectIdentity(
    label,
    (document, anchors) => {
      document.steps[step].result = actionResult(
        { ...anchors, ...replacements },
        kind,
      );
    },
    [step],
  );
}

function actionResult(anchors, kind) {
  return productionResultsFixture(anchors)[
    kind === "upgrade"
      ? "production-upgrade-execute"
      : "production-recovery-execute"
  ];
}
