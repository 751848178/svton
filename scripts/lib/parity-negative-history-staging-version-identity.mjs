import {
  nonEmpty,
  requireEqual,
  requireIdentity,
} from "./parity-negative-history-identity-assert.mjs";

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
  const version = result.newEnvironmentVersion;
  requireIdentity(nonEmpty(version?.id), `${kind}:version`);
  requireEqual(
    [version.kind, version.previousVersionId, result.expectedPreviousVersionId],
    [kind, previousId, previousId],
    `${kind}:version-row`,
  );
  const previousClaim =
    kind === "upgrade" ? version.previousIsVst2 : version.previousIsVst3;
  requireEqual(previousClaim, true, `${kind}:previous-claim`);
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
