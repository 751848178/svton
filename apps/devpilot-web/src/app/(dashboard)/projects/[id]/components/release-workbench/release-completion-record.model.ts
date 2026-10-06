import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import type { ProductionValidationCheck } from './release-production-validation.model';

export type ReleaseCompletionBlocker =
  | 'completionFlag'
  | 'releaseRun'
  | 'deploymentRun'
  | 'currentVersion'
  | 'releaseIdentity'
  | 'environment'
  | 'manifest'
  | 'statuses'
  | 'timestamps'
  | 'validation';

export type ReleaseCompletionRecord = {
  releaseVersion: string;
  releaseRun: NonNullable<ReleaseLifecycleEvidence['productionRun']>;
  deploymentRun: NonNullable<ReleaseLifecycleEvidence['productionDeployment']>;
  environmentVersion: NonNullable<ProjectDeliverySummary['currentVersions']['production']>;
  validationChecks: ProductionValidationCheck[];
};

export function buildReleaseCompletionRecord(
  detail: ReleaseOrderDetail,
  evidence: ReleaseLifecycleEvidence,
): { record: ReleaseCompletionRecord | null; blockers: ReleaseCompletionBlocker[] } {
  const blockers: ReleaseCompletionBlocker[] = [];
  const run = evidence.productionRun;
  const deployment = evidence.productionDeployment;
  const version = evidence.currentProductionVersion;
  if (!evidence.completed) blockers.push('completionFlag');
  if (!run) blockers.push('releaseRun');
  if (!deployment) blockers.push('deploymentRun');
  if (!version) blockers.push('currentVersion');
  if (!run || !deployment || !version) return { record: null, blockers };

  if (!sameRelease(detail, run, deployment, version)) blockers.push('releaseIdentity');
  if (!sameEnvironment(run, deployment)) blockers.push('environment');
  if (!sameManifest(run, deployment, version)) blockers.push('manifest');
  if (!successfulStatuses(detail, run.status, deployment.status)) blockers.push('statuses');
  if (!run.finishedAt || !deployment.finishedAt || !version.effectiveAt) {
    blockers.push('timestamps');
  }
  if (!allValidationPassed(evidence.validationChecks)) blockers.push('validation');
  if (blockers.length > 0) return { record: null, blockers };
  return {
    blockers,
    record: {
      releaseVersion: version.releaseVersion,
      releaseRun: run,
      deploymentRun: deployment,
      environmentVersion: version,
      validationChecks: evidence.validationChecks,
    },
  };
}

function sameRelease(
  detail: ReleaseOrderDetail,
  run: NonNullable<ReleaseLifecycleEvidence['productionRun']>,
  deployment: NonNullable<ReleaseLifecycleEvidence['productionDeployment']>,
  version: NonNullable<ProjectDeliverySummary['currentVersions']['production']>,
) {
  return (
    run.projectId === detail.projectId &&
    run.releaseOrderId === detail.id &&
    deployment.projectId === detail.projectId &&
    deployment.releaseOrderId === detail.id &&
    deployment.releaseRunId === run.id &&
    run.deploymentRuns.some((item) => item.id === deployment.id) &&
    version.releaseOrderId === detail.id &&
    version.releaseVersion === detail.releaseVersion
  );
}

function sameEnvironment(
  run: NonNullable<ReleaseLifecycleEvidence['productionRun']>,
  deployment: NonNullable<ReleaseLifecycleEvidence['productionDeployment']>,
) {
  return (
    run.environment.baselineRole === 'production' &&
    deployment.environment.baselineRole === 'production' &&
    run.environmentId === deployment.environmentId &&
    deployment.environmentId === deployment.environment.id
  );
}

function sameManifest(
  run: NonNullable<ReleaseLifecycleEvidence['productionRun']>,
  deployment: NonNullable<ReleaseLifecycleEvidence['productionDeployment']>,
  version: NonNullable<ProjectDeliverySummary['currentVersions']['production']>,
) {
  return (
    run.artifactManifestId === run.manifest.id &&
    deployment.artifactManifestId === run.artifactManifestId &&
    deployment.manifest.id === run.artifactManifestId &&
    version.artifactManifestId === run.artifactManifestId &&
    run.verifiedDigest === run.manifest.digest &&
    deployment.manifest.digest === run.manifest.digest &&
    version.manifestDigest === run.manifest.digest &&
    version.deploymentRunId === deployment.id
  );
}

function successfulStatuses(
  detail: ReleaseOrderDetail,
  runStatus: string,
  deploymentStatus: string,
) {
  return (
    detail.lifecycle.status === 'succeeded' &&
    runStatus.toLowerCase() === 'succeeded' &&
    deploymentStatus.toLowerCase() === 'completed'
  );
}

function allValidationPassed(checks: ProductionValidationCheck[]) {
  const expected = new Set([
    'artifactIntegrity',
    'environmentVersion',
    'workloadReady',
    'healthProbe',
    'entryProbe',
    'routeSwitch',
  ]);
  return (
    checks.length === expected.size &&
    checks.every((check) => expected.delete(check.key) && check.label === 'passed')
  );
}
