import {
  nonEmpty,
  requireEqual,
  requireIdentity,
  validTime,
} from "./parity-negative-history-identity-assert.mjs";

export function validateProductionPreview(result, roots, expected) {
  requireIdentity(
    /^[a-f0-9]{64}$/.test(result.inputHash || ""),
    "preview:hash",
  );
  const snapshot = result.snapshot;
  requireEqual(
    [snapshot?.environment?.id, snapshot?.environment?.key],
    [roots.productionEnvId, "production"],
    "preview:environment",
  );
  requireEqual(
    [snapshot?.build?.id, snapshot?.build?.sourceCommitSha],
    [expected.buildRunId, roots.pinnedCommit],
    "preview:build",
  );
  if (expected.revision !== undefined) {
    requireEqual(
      snapshot?.build?.revision,
      expected.revision,
      "preview:revision",
    );
  }
  requireEqual(snapshot?.releaseOrder?.id, roots.orderId, "preview:order");
  if (expected.manifestFrozen !== undefined) {
    requireEqual(
      result.manifestFrozen,
      expected.manifestFrozen,
      "preview:frozen",
    );
    requireEqual(
      [result.manifestDigest, result.expectedManifestDigest],
      [expected.digest, expected.digest],
      "preview:digest",
    );
  }
}

export function validateProductionConfirm(
  result,
  manifestId,
  digest,
  mode,
  sourceReleaseRunId,
) {
  requireIdentity(nonEmpty(result.releaseRunId), `${mode}-confirm:release`);
  requireIdentity(nonEmpty(result.approvalId), `${mode}-confirm:approval`);
  requireEqual(
    [result.status, result.awaitingApproval, result.mode],
    ["awaiting_approval", true, mode],
    `${mode}-confirm:state`,
  );
  requireEqual(
    [result.manifestId, result.expectedManifestId],
    [manifestId, manifestId],
    `${mode}-confirm:manifest`,
  );
  requireEqual(
    [
      result.verifiedDigest,
      result.expectedManifestDigest,
      result.verifiedDigestMatches,
    ],
    [digest, digest, true],
    `${mode}-confirm:digest`,
  );
  const action =
    mode === "standard"
      ? "project.release_order.deploy_production"
      : "project.release_order.deploy_production_recovery";
  requireEqual(
    [result.approvalStatus, result.approvalAction],
    ["pending", action],
    `${mode}-confirm:approval-state`,
  );
  if (mode === "recovery") {
    requireEqual(
      [result.recoveryReleaseRunId, result.sourceReleaseRunId],
      [result.releaseRunId, sourceReleaseRunId],
      "recovery-confirm:source",
    );
  }
  return { releaseRunId: result.releaseRunId, approvalId: result.approvalId };
}

export function validateProductionApproval(result, approvalId, label) {
  requireEqual(result.approvalId, approvalId, `${label}-approval:id`);
  requireEqual(
    [result.decision, result.status],
    ["approved", "approved"],
    `${label}-approval:state`,
  );
  requireIdentity(nonEmpty(result.reviewerId), `${label}-approval:reviewer`);
  requireIdentity(validTime(result.reviewedAt), `${label}-approval:time`);
}
