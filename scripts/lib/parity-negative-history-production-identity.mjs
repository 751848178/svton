import {
  freezeIdentity,
  historyResult,
  requireDistinct,
  requireEqual,
} from "./parity-negative-history-identity-assert.mjs";
import { validateProductionAction } from "./parity-negative-history-production-action-identity.mjs";
import {
  validateProductionApproval,
  validateProductionConfirm,
  validateProductionPreview,
} from "./parity-negative-history-production-release-identity.mjs";

export function validateProductionIdentity(steps, staging) {
  const standardPreview = historyResult(steps, "production-preview");
  validateProductionPreview(standardPreview, staging, {
    buildRunId: staging.buildRunB2,
    digest: staging.manifestM2Digest,
    revision: 2,
    manifestFrozen: true,
  });
  const standard = validateProductionConfirm(
    historyResult(steps, "production-confirm"),
    staging.manifestM2,
    staging.manifestM2Digest,
    "standard",
  );
  validateProductionApproval(
    historyResult(steps, "production-approve"),
    standard.approvalId,
    "standard",
  );
  const upgraded = validateProductionAction(
    historyResult(steps, "production-upgrade-execute"),
    staging,
    {
      kind: "upgrade",
      manifestId: staging.manifestM2,
      buildRunId: staging.buildRunB2,
      releaseRunId: standard.releaseRunId,
      previousVersionId: staging.productionCurrentVersionId,
    },
  );

  const recoveryPreview = historyResult(steps, "production-recovery-preview");
  validateProductionPreview(recoveryPreview, staging, {
    buildRunId: staging.buildRunId,
    digest: staging.manifestDigest,
  });
  requireEqual(
    [
      recoveryPreview.sourceVersionId,
      recoveryPreview.expectedSourceVersionId,
      recoveryPreview.sourceManifestId,
      recoveryPreview.expectedManifestId,
      recoveryPreview.sourceManifestDigest,
      recoveryPreview.expectedManifestDigest,
      recoveryPreview.sourceReleaseRunId,
      recoveryPreview.sourceVersionKind,
    ],
    [
      staging.productionCurrentVersionId,
      staging.productionCurrentVersionId,
      staging.manifestId,
      staging.manifestId,
      staging.manifestDigest,
      staging.manifestDigest,
      staging.productionReleaseRunId,
      "upgrade",
    ],
    "recovery-preview:source",
  );
  const recovery = validateProductionConfirm(
    historyResult(steps, "production-recovery-confirm"),
    staging.manifestId,
    staging.manifestDigest,
    "recovery",
    staging.productionReleaseRunId,
  );
  validateProductionApproval(
    historyResult(steps, "production-recovery-approve"),
    recovery.approvalId,
    "recovery",
  );
  const recovered = validateProductionAction(
    historyResult(steps, "production-recovery-execute"),
    staging,
    {
      kind: "recovery",
      manifestId: staging.manifestId,
      buildRunId: staging.buildRunId,
      releaseRunId: recovery.releaseRunId,
      previousVersionId: upgraded.versionId,
    },
  );
  requireEqual(recovered.result.restoredM1, true, "recovery-execute:restored");
  requireDistinct(
    [
      staging.productionReleaseRunId,
      standard.releaseRunId,
      recovery.releaseRunId,
    ],
    "production:release-ids",
  );
  requireDistinct(
    [standard.approvalId, recovery.approvalId],
    "production:approval-ids",
  );
  requireDistinct(
    [upgraded.deploymentRunId, recovered.deploymentRunId],
    "production:deployment-ids",
  );
  requireDistinct(
    [
      staging.productionCurrentVersionId,
      upgraded.versionId,
      recovered.versionId,
    ],
    "production:version-ids",
  );
  return freezeIdentity({
    ...staging,
    standardPreviewHash: standardPreview.inputHash,
    productionReleaseRunR2: standard.releaseRunId,
    productionApprovalA2: standard.approvalId,
    productionDeploymentRunD2: upgraded.deploymentRunId,
    productionVersionV2: upgraded.versionId,
    recoveryPreviewHash: recoveryPreview.inputHash,
    productionReleaseRunR3: recovery.releaseRunId,
    productionApprovalA3: recovery.approvalId,
    productionDeploymentRunD3: recovered.deploymentRunId,
    productionVersionV3: recovered.versionId,
  });
}
