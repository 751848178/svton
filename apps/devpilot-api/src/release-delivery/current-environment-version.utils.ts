export interface CurrentEnvironmentVersionScope {
  id: string;
  teamId: string;
  projectId: string;
  currentEnvironmentVersionId: string | null;
  currentEnvironmentVersion: {
    id: string;
    teamId: string;
    projectId: string;
    environmentId: string;
    releaseOrderId: string;
    artifactManifestId: string;
    deploymentRunId: string;
    releaseRunId: string | null;
    effectiveAt: Date;
    releaseOrder: {
      id: string;
      teamId: string;
      projectId: string;
      releaseVersion: string;
    };
    artifactManifest: {
      id: string;
      teamId: string;
      projectId: string;
      releaseOrderId: string;
      digest: string;
    };
    deploymentRun: {
      id: string;
      teamId: string;
      projectId: string;
      environmentId: string | null;
      artifactManifestId: string | null;
      source: string;
      status: string;
      dryRun: boolean;
      result: unknown;
    };
    releaseRun: {
      id: string;
      teamId: string;
      projectId: string;
      environmentId: string;
      releaseOrderId: string;
      artifactManifestId: string;
      status: string;
      verifiedDigest: string;
    } | null;
  } | null;
}

export function exactCurrentEnvironmentVersion(
  project: { id: string; teamId: string },
  environment: CurrentEnvironmentVersionScope,
) {
  const version = environment.currentEnvironmentVersion;
  if (!version || environment.currentEnvironmentVersionId !== version.id)
    return null;
  const order = version.releaseOrder;
  const manifest = version.artifactManifest;
  const deployment = version.deploymentRun;
  const release = version.releaseRun;
  const digest = canonicalDigest(manifest.digest);
  const deploymentEvidence = record(deployment.result);
  const deploymentDigestExact = digest !== null &&
    deploymentEvidence.artifactVerified === true &&
    deploymentEvidence.manifestId === manifest.id &&
    deploymentEvidence.manifestDigest === digest;
  const releaseExact = version.releaseRunId === null
    ? release === null
    : Boolean(release && release.id === version.releaseRunId &&
        release.teamId === project.teamId && release.projectId === project.id &&
        release.environmentId === environment.id &&
        release.releaseOrderId === order.id &&
        release.artifactManifestId === manifest.id &&
        release.status === "succeeded" && release.verifiedDigest === digest);
  const exact =
    environment.teamId === project.teamId &&
    environment.projectId === project.id &&
    version.teamId === project.teamId &&
    version.projectId === project.id &&
    version.environmentId === environment.id &&
    version.releaseOrderId === order.id &&
    order.teamId === project.teamId &&
    order.projectId === project.id &&
    version.artifactManifestId === manifest.id &&
    manifest.teamId === project.teamId &&
    manifest.projectId === project.id &&
    manifest.releaseOrderId === order.id &&
    version.deploymentRunId === deployment.id &&
    deployment.teamId === project.teamId &&
    deployment.projectId === project.id &&
    deployment.environmentId === environment.id &&
    deployment.artifactManifestId === manifest.id &&
    deployment.source === "release_order" &&
    deployment.status === "completed" &&
    deployment.dryRun === false &&
    deploymentDigestExact &&
    releaseExact;
  return exact ? version : null;
}

export function currentEnvironmentVersionFailureReason(
  environment: CurrentEnvironmentVersionScope,
) {
  const version = environment.currentEnvironmentVersion;
  if (!version || environment.currentEnvironmentVersionId !== version.id) return null;
  const digest = canonicalDigest(version.artifactManifest.digest);
  const evidence = record(version.deploymentRun.result);
  const deploymentDigestExact = digest !== null && evidence.artifactVerified === true &&
    evidence.manifestId === version.artifactManifest.id &&
    evidence.manifestDigest === digest;
  const releaseDigestExact = version.releaseRunId === null || Boolean(
    version.releaseRun && version.releaseRun.id === version.releaseRunId &&
    version.releaseRun.verifiedDigest === digest,
  );
  return deploymentDigestExact && releaseDigestExact
    ? null : "current_version_digest_unverified";
}

function canonicalDigest(value: string) {
  const digest = value.trim().toLowerCase();
  return /^sha256:[a-f0-9]{64}$/.test(digest) ? digest : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
