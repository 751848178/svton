#!/usr/bin/env node
// F555: preview.inputHash -> confirm.expectedInputHash trust continuity.
//
// The identity graph must reject any document where a confirm does not consume
// the immediately preceding validated preview hash, where a hash is empty or
// malformed, or where recovery sourceVersionId drifts from the trusted Vprod1.
// The producer projection is checked separately to prove it records the
// producer's own request variable, not a response-owned hash.
import assert from "node:assert/strict";
import { productionConfirmResult } from "./parity-negative-history-confirm-result.mjs";
import { validateProductionConfirm } from "./parity-negative-history-production-release-identity.mjs";
import {
  parseHistory,
  rejectIdentity,
} from "./parity-negative-history-identity-test-support.mjs";
import { historyDocumentFixture } from "./parity-negative-history-contract-fixture.mjs";
import { fixtureAnchors } from "./parity-negative-history-identity-test-support.mjs";

const valid = parseHistory(historyDocumentFixture());
assert.equal(valid.historyIdentityGraphValid, true);
const otherHash = "d".repeat(64);

rejectIdentity(
  "standard preview hash only",
  (document) => {
    document.steps["production-preview"].result.inputHash = otherHash;
  },
  ["production-preview"],
);
rejectIdentity(
  "standard confirm expectedInputHash only",
  (document) => {
    document.steps["production-confirm"].result.expectedInputHash = otherHash;
  },
  ["production-confirm"],
);
rejectIdentity(
  "recovery preview hash only",
  (document) => {
    document.steps["production-recovery-preview"].result.inputHash = otherHash;
  },
  ["production-recovery-preview"],
);
rejectIdentity(
  "recovery confirm expectedInputHash only",
  (document) => {
    document.steps["production-recovery-confirm"].result.expectedInputHash =
      otherHash;
  },
  ["production-recovery-confirm"],
);
rejectIdentity(
  "recovery confirm sourceVersionId = Vprod2",
  (document, anchors) => {
    document.steps["production-recovery-confirm"].result.sourceVersionId =
      anchors.productionVersionV2;
  },
  ["production-recovery-confirm"],
);
rejectIdentity(
  "recovery confirm sourceVersionId arbitrary",
  (document) => {
    document.steps["production-recovery-confirm"].result.sourceVersionId =
      "claimed-source-version";
  },
  ["production-recovery-confirm"],
);
rejectIdentity("standard preview empty hash", (document) => {
  document.steps["production-preview"].result.inputHash = "";
});
rejectIdentity("standard preview malformed hash", (document) => {
  document.steps["production-preview"].result.inputHash = "not-a-64-hex";
});
rejectIdentity(
  "standard confirm empty expectedInputHash",
  (document) => {
    document.steps["production-confirm"].result.expectedInputHash = "";
  },
  ["production-confirm"],
);
rejectIdentity(
  "standard confirm malformed expectedInputHash",
  (document) => {
    document.steps["production-confirm"].result.expectedInputHash =
      "not-a-64-hex";
  },
  ["production-confirm"],
);
rejectIdentity(
  "recovery confirm empty expectedInputHash",
  (document) => {
    document.steps["production-recovery-confirm"].result.expectedInputHash = "";
  },
  ["production-recovery-confirm"],
);
rejectIdentity(
  "recovery confirm empty sourceVersionId",
  (document) => {
    document.steps["production-recovery-confirm"].result.sourceVersionId = "";
  },
  ["production-recovery-confirm"],
);

const anchors = fixtureAnchors(historyDocumentFixture());
const digest = anchors.manifestDigest;

const standardResponse = confirmResponse("standard", anchors);
const standardRequest = {
  expectedManifestId: anchors.manifestM2,
  expectedManifestDigest: digest,
  expectedInputHash: "b".repeat(64),
};
const standardResult = productionConfirmResult(
  standardResponse,
  "standard",
  standardRequest,
);
assert.equal(standardResult.expectedInputHash, "b".repeat(64));
assert.equal(
  standardResult.expectedInputHash,
  standardRequest.expectedInputHash,
);
assert.equal("inputHash" in standardResponse, false);
validateProductionConfirm(
  standardResult,
  anchors.manifestM2,
  digest,
  "standard",
  undefined,
  "b".repeat(64),
);

const recoveryResponse = confirmResponse("recovery", anchors);
const recoveryResult = productionConfirmResult(recoveryResponse, "recovery", {
  expectedManifestId: anchors.manifestId,
  expectedManifestDigest: digest,
  expectedInputHash: "c".repeat(64),
  sourceVersionId: anchors.productionCurrentVersionId,
});
assert.equal(recoveryResult.expectedInputHash, "c".repeat(64));
assert.equal(
  recoveryResult.sourceVersionId,
  anchors.productionCurrentVersionId,
);
validateProductionConfirm(
  recoveryResult,
  anchors.manifestId,
  digest,
  "recovery",
  anchors.productionReleaseRunId,
  "c".repeat(64),
  anchors.productionCurrentVersionId,
);

process.stdout.write("negative history preview-confirm self-test passed\n");

function confirmResponse(mode, anchors) {
  const recovery = mode === "recovery";
  return {
    id: recovery
      ? anchors.productionReleaseRunR3
      : anchors.productionReleaseRunR2,
    status: "awaiting_approval",
    operationApproval: {
      id: recovery
        ? anchors.productionApprovalA3
        : anchors.productionApprovalA2,
      status: "pending",
      action: recovery
        ? "project.release_order.deploy_production_recovery"
        : "project.release_order.deploy_production",
    },
    artifactManifestId: recovery ? anchors.manifestId : anchors.manifestM2,
    verifiedDigest: digest,
    ...(recovery ? { sourceReleaseRunId: anchors.productionReleaseRunId } : {}),
  };
}
