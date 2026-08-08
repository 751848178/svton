import {
  nonEmpty,
  requireEqual,
  requireIdentity,
} from "./parity-negative-history-identity-assert.mjs";

export function validateVersionRow(result, expected, label) {
  const version = result.newEnvironmentVersion;
  requireIdentity(isPlainObject(version), `${label}:object`);
  requireEqual(
    Object.keys(version).sort(),
    [
      "artifactManifestId",
      "deploymentRunId",
      "id",
      "kind",
      "previousVersionId",
      expected.claimKey,
    ].sort(),
    `${label}:keys`,
  );
  requireIdentity(nonEmpty(version.id), `${label}:id`);
  requireEqual(version.kind, expected.kind, `${label}:kind`);
  requireEqual(
    version.previousVersionId,
    expected.previousId,
    `${label}:previous`,
  );
  requireEqual(version[expected.claimKey], true, `${label}:claim`);
  requireEqual(
    version.artifactManifestId,
    expected.manifestId,
    `${label}:artifact-manifest`,
  );
  requireEqual(
    version.deploymentRunId,
    expected.deploymentRunId,
    `${label}:deployment-run`,
  );
  return version;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
