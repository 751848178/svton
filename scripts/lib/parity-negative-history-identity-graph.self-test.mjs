#!/usr/bin/env node
import assert from "node:assert/strict";
import { productionResultsFixture } from "./parity-negative-history-production-fixture.mjs";
import { versionChainsFixture } from "./parity-negative-history-summary-fixture.mjs";
import {
  parseHistory,
  rejectIdentity,
} from "./parity-negative-history-identity-test-support.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";

const valid = parseHistory(historyDocumentFixture());
assert.equal(valid.historyIdentityGraphValid, true);

rejectIdentity("login", (document) => {
  document.steps.login.result.status = "claimed";
});
rejectIdentity(
  "build-2",
  (document) => {
    document.steps["build-2"].result.sourceCommitSha = "f".repeat(40);
  },
  ["build-2"],
);
rejectIdentity(
  "staging-deploy-repeat",
  (document) => substituteRepeatManifest(document, "claimed-manifest"),
  ["staging-deploy-repeat"],
);
rejectIdentity(
  "staging-upgrade",
  (document) => substitutePair(document, "staging-upgrade", "environmentId"),
  ["staging-upgrade"],
);
rejectIdentity(
  "staging-recovery",
  (document) => substitutePair(document, "staging-recovery", "manifestId"),
  ["staging-recovery"],
);
rejectIdentity(
  "production-preview",
  (document) => {
    const result = document.steps["production-preview"].result;
    result.manifestDigest = `sha256:${"e".repeat(64)}`;
    result.expectedManifestDigest = result.manifestDigest;
  },
  ["production-preview"],
);
rejectIdentity(
  "production-confirm",
  (document) => substitutePair(document, "production-confirm", "manifestId"),
  ["production-confirm"],
);
rejectIdentity(
  "production-approve",
  (document) => {
    document.steps["production-approve"].result.approvalId = "claimed-approval";
  },
  ["production-approve"],
);
rejectIdentity(
  "production-upgrade-execute",
  (document, anchors) => {
    document.steps["production-upgrade-execute"].result =
      productionResultsFixture({
        ...anchors,
        productionEnvId: "claimed-production-env",
      })["production-upgrade-execute"];
  },
  ["production-upgrade-execute"],
);
rejectIdentity(
  "production-recovery-preview",
  (document) => {
    const result = document.steps["production-recovery-preview"].result;
    result.sourceVersionId = "claimed-version";
    result.expectedSourceVersionId = "claimed-version";
  },
  ["production-recovery-preview"],
);
rejectIdentity(
  "production-recovery-confirm",
  (document) => {
    document.steps["production-recovery-confirm"].result.sourceReleaseRunId =
      "claimed-release";
  },
  ["production-recovery-confirm"],
);
rejectIdentity(
  "production-recovery-approve",
  (document) => {
    document.steps["production-recovery-approve"].result.approvalId =
      "claimed-approval";
  },
  ["production-recovery-approve"],
);
rejectIdentity(
  "production-recovery-execute",
  (document, anchors) => {
    document.steps["production-recovery-execute"].result =
      productionResultsFixture({
        ...anchors,
        productionEnvId: "claimed-production-env",
      })["production-recovery-execute"];
  },
  ["production-recovery-execute"],
);
rejectIdentity(
  "version-chains",
  (document, anchors) => {
    document.steps["version-chains"].result = versionChainsFixture({
      ...anchors,
      stagingVersionV2: "claimed-staging-version",
    });
  },
  ["version-chains"],
);
rejectIdentity(
  "browser-pass cannot replace prior identity",
  (document) => {
    document.steps["build-2"].result.buildRunId = "claimed-browser-build";
  },
  ["build-2"],
);

process.stdout.write("negative history identity graph self-test passed\n");

function substitutePair(document, step, field) {
  const result = document.steps[step].result;
  result[field] = `claimed-${field}`;
  const expected =
    field === "environmentId" ? "expectedEnvironmentId" : "expectedManifestId";
  result[expected] = result[field];
}

function substituteRepeatManifest(document, manifestId) {
  const result = document.steps["staging-deploy-repeat"].result;
  result.expectedManifestId = manifestId;
  result.newStagingCurrent.artifactManifestId = manifestId;
  result.stagingDeploymentRunsOnOrder.forEach(
    (row) => (row.manifest = manifestId),
  );
  for (const field of [
    "resultManifestId",
    "expectedManifestId",
    "paramsManifestId",
  ]) {
    result.commandEvidence[field] = manifestId;
  }
}
