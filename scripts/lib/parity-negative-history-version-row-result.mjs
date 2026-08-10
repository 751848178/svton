// Producer-only projection: serializes the selected EnvironmentVersion row
// with its own artifactManifestId/deploymentRunId foreign-key edges plus the
// exact previous-version claim. Consumers bind these edges to validated
// action identities; no validation lives here.
export function versionRowResult(version, previousId, claimKey) {
  return {
    id: version.id,
    kind: version.kind,
    previousVersionId: version.previousVersionId,
    [claimKey]: version.previousVersionId === previousId,
    artifactManifestId: version.artifactManifestId,
    deploymentRunId: version.deploymentRunId,
  };
}
