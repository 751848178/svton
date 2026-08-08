import { productionProofFixture } from "./parity-negative-history-route-fixture.mjs";

export function productionResultsFixture(anchors) {
  return {
    "production-preview": previewFixture(anchors, "standard"),
    "production-confirm": confirmFixture(anchors, "standard"),
    "production-approve": approvalFixture(anchors.productionApprovalA2),
    "production-upgrade-execute": actionFixture(anchors, "upgrade"),
    "production-recovery-preview": previewFixture(anchors, "recovery"),
    "production-recovery-confirm": confirmFixture(anchors, "recovery"),
    "production-recovery-approve": approvalFixture(
      anchors.productionApprovalA3,
    ),
    "production-recovery-execute": actionFixture(anchors, "recovery"),
  };
}

function previewFixture(a, mode) {
  const snapshot = {
    environment: { id: a.productionEnvId, key: "production" },
    build: {
      id: mode === "standard" ? a.buildRunB2 : a.buildRunId,
      sourceCommitSha: a.pinnedCommit,
    },
    releaseOrder: { id: a.orderId },
  };
  if (mode === "standard") {
    snapshot.build.revision = 2;
    return {
      inputHash: "b".repeat(64),
      manifestFrozen: true,
      manifestDigest: a.manifestM2Digest,
      expectedManifestDigest: a.manifestM2Digest,
      snapshot,
    };
  }
  return {
    inputHash: "c".repeat(64),
    sourceVersionId: a.productionCurrentVersionId,
    expectedSourceVersionId: a.productionCurrentVersionId,
    sourceManifestId: a.manifestId,
    expectedManifestId: a.manifestId,
    sourceManifestDigest: a.manifestDigest,
    expectedManifestDigest: a.manifestDigest,
    sourceReleaseRunId: a.productionReleaseRunId,
    sourceVersionKind: "upgrade",
    snapshot,
  };
}

function confirmFixture(a, mode) {
  const recovery = mode === "recovery";
  const releaseRunId = recovery
    ? a.productionReleaseRunR3
    : a.productionReleaseRunR2;
  const manifestId = recovery ? a.manifestId : a.manifestM2;
  const digest = recovery ? a.manifestDigest : a.manifestM2Digest;
  const result = {
    releaseRunId,
    status: "awaiting_approval",
    awaitingApproval: true,
    mode,
    approvalId: recovery ? a.productionApprovalA3 : a.productionApprovalA2,
    approvalStatus: "pending",
    approvalAction: recovery
      ? "project.release_order.deploy_production_recovery"
      : "project.release_order.deploy_production",
    manifestId,
    expectedManifestId: manifestId,
    verifiedDigest: digest,
    expectedManifestDigest: digest,
    verifiedDigestMatches: true,
    expectedInputHash: recovery ? "c".repeat(64) : "b".repeat(64),
  };
  if (recovery) {
    result.recoveryReleaseRunId = releaseRunId;
    result.sourceReleaseRunId = a.productionReleaseRunId;
    result.sourceVersionId = a.productionCurrentVersionId;
  }
  return result;
}

function approvalFixture(approvalId) {
  return {
    approvalId,
    decision: "approved",
    status: "approved",
    reviewerId: "reviewer",
    reviewedAt: "2026-08-08T00:00:03.000Z",
  };
}

function actionFixture(a, kind) {
  const recovery = kind === "recovery";
  const action = {
    deploymentRunId: recovery
      ? a.productionDeploymentRunD3
      : a.productionDeploymentRunD2,
    releaseRunId: recovery
      ? a.productionReleaseRunR3
      : a.productionReleaseRunR2,
    manifestId: recovery ? a.manifestId : a.manifestM2,
    buildRunId: recovery ? a.buildRunId : a.buildRunB2,
  };
  const previousVersionId = recovery
    ? a.productionVersionV2
    : a.productionCurrentVersionId;
  const proof = productionProofFixture(a, action);
  return {
    deploymentRunId: action.deploymentRunId,
    status: "completed",
    environmentId: a.productionEnvId,
    manifestId: action.manifestId,
    ...(recovery ? { restoredM1: true } : {}),
    releaseRunId: action.releaseRunId,
    expectedEnvironmentId: a.productionEnvId,
    expectedManifestId: action.manifestId,
    expectedReleaseRunId: action.releaseRunId,
    expectedPreviousVersionId: previousVersionId,
    newEnvironmentVersion: {
      id: recovery ? a.productionVersionV3 : a.productionVersionV2,
      kind,
      previousVersionId,
      [recovery ? "previousIsVprod2" : "previousIsVprod1"]: true,
    },
    currentMoved: true,
    releaseRun: {
      status: "succeeded",
      mode: recovery ? "recovery" : "standard",
      approvalStatus: "approved",
      approvalConsumedAt: "2026-08-08T00:00:04.000Z",
    },
    workload: { status: "running" },
    healthProbe: { status: "passed" },
    siteProbe: proof.siteProbe,
    routeSwitch: proof.routeSwitch,
    artifactVerified: true,
    gateDecision: proof.gateDecision,
    productionGate: proof.productionGate,
    routeEvidence: proof.routeEvidence,
  };
}
