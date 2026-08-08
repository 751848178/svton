import {
  nonEmpty,
  requireEqual,
  requireIdentity,
} from "./parity-negative-history-identity-assert.mjs";
import { validateVersionRow } from "./parity-negative-history-version-row-identity.mjs";

export function validateStagingVersionAction(
  result,
  anchors,
  kind,
  manifestId,
  previousId,
) {
  requireIdentity(nonEmpty(result.deploymentRunId), `${kind}:deployment`);
  requireEqual(result.status, "completed", `${kind}:status`);
  requireEqual(
    [result.environmentId, result.expectedEnvironmentId],
    [anchors.stagingEnvId, anchors.stagingEnvId],
    `${kind}:environment`,
  );
  requireEqual(
    [result.manifestId, result.expectedManifestId],
    [manifestId, manifestId],
    `${kind}:manifest`,
  );
  const version = validateVersionRow(
    result,
    {
      kind,
      previousId: previousId,
      claimKey: kind === "upgrade" ? "previousIsVst2" : "previousIsVst3",
      manifestId,
      deploymentRunId: result.deploymentRunId,
    },
    `${kind}:version-row`,
  );
  requireEqual(
    [result.currentMoved, result.artifactVerified],
    [true, true],
    `${kind}:claims`,
  );
  const suffix = kind === "upgrade" ? "3" : "4";
  return {
    ...anchors,
    [`stagingDeploymentRunD${suffix}`]: result.deploymentRunId,
    [`stagingVersionV${suffix}`]: version.id,
  };
}
