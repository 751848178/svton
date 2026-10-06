import type { DeploymentRun } from '../types/operations';

/** Resolves the persisted release-order relation without inferring it from run status. */
export function deploymentRunReleaseOrderId(run: DeploymentRun) {
  return (
    run.artifactManifest?.releaseOrderId ??
    run.releaseStageAttempts?.[0]?.releaseStage.releasePlan.releaseOrderId ??
    null
  );
}
