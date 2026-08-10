import type { ReleaseOrderEvidence } from '../types/release-order-evidence.types';

export function ownsReleaseOrderEvidence(
  evidence: ReleaseOrderEvidence,
  projectId: string,
  releaseOrderId: string,
) {
  if (evidence.projectId !== projectId || evidence.releaseOrderId !== releaseOrderId) return false;
  const ownsBuild = (build: ReleaseOrderEvidence['buildRuns']['items'][number]) =>
    build.projectId === projectId &&
    build.releaseOrderId === releaseOrderId &&
    (!build.manifest || build.manifest.buildRun.id === build.id);
  const ownsDeployment = (run: ReleaseOrderEvidence['stagingDeploymentRuns']['items'][number]) =>
    run.projectId === projectId &&
    run.releaseOrderId === releaseOrderId &&
    run.manifest.id === run.artifactManifestId &&
    run.environment.id === run.environmentId;
  return (
    evidence.buildRuns.items.every(ownsBuild) &&
    evidence.stagingDeploymentRuns.items.every(ownsDeployment) &&
    evidence.productionReleaseRuns.items.every(
      (run) =>
        run.projectId === projectId &&
        run.releaseOrderId === releaseOrderId &&
        run.manifest.id === run.artifactManifestId &&
        run.environment.id === run.environmentId &&
        run.deploymentRuns.every(
          (deployment) =>
            ownsDeployment(deployment) &&
            deployment.releaseRunId === run.id &&
            deployment.artifactManifestId === run.artifactManifestId &&
            deployment.environmentId === run.environmentId,
        ),
    )
  );
}
