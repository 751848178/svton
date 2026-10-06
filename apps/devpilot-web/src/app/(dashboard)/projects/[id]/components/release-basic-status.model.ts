import type { ReleaseOrderLifecycle } from '../types/release-order-lifecycle.types';

export function basicReleaseStatus(
  lifecycle: ReleaseOrderLifecycle,
  deploymentStatus?: string | null,
): {
  labelKey:
    | 'basicReleaseStatusAwaitingBuild'
    | 'basicReleaseStatusBuilding'
    | 'basicReleaseStatusAwaitingDeploy'
    | 'basicReleaseStatusDeploying'
    | 'basicReleaseStatusDeployed'
    | 'releaseOrderStatusFailed'
    | 'releaseOrderStatusWithdrawn';
  tone: 'error' | 'idle' | 'running' | 'success';
} {
  const normalizedDeployment = deploymentStatus?.toLowerCase();
  if (normalizedDeployment && ['completed', 'succeeded'].includes(normalizedDeployment)) {
    return { labelKey: 'basicReleaseStatusDeployed', tone: 'success' };
  }
  if (
    normalizedDeployment &&
    ['created', 'queued', 'running', 'pending'].includes(normalizedDeployment)
  ) {
    return { labelKey: 'basicReleaseStatusDeploying', tone: 'running' };
  }
  if (normalizedDeployment && ['failed'].includes(normalizedDeployment)) {
    return { labelKey: 'releaseOrderStatusFailed', tone: 'error' };
  }
  if (normalizedDeployment && ['cancelled', 'canceled'].includes(normalizedDeployment)) {
    return { labelKey: 'releaseOrderStatusWithdrawn', tone: 'idle' };
  }
  if (lifecycle.status === 'failed') {
    return { labelKey: 'releaseOrderStatusFailed', tone: 'error' };
  }
  if (lifecycle.status === 'withdrawn') {
    return { labelKey: 'releaseOrderStatusWithdrawn', tone: 'idle' };
  }
  if (['awaiting_approval', 'production', 'succeeded'].includes(lifecycle.status)) {
    return { labelKey: 'basicReleaseStatusDeployed', tone: 'success' };
  }
  if (lifecycle.status === 'building') {
    return { labelKey: 'basicReleaseStatusBuilding', tone: 'running' };
  }
  if (lifecycle.status === 'staging') {
    if (
      ['created', 'queued', 'running', 'pending'].includes(lifecycle.sourceStatus.toLowerCase())
    ) {
      return { labelKey: 'basicReleaseStatusDeploying', tone: 'running' };
    }
    return { labelKey: 'basicReleaseStatusAwaitingDeploy', tone: 'idle' };
  }
  return { labelKey: 'basicReleaseStatusAwaitingBuild', tone: 'idle' };
}

export function basicReleaseStepLabelKey(lifecycle: ReleaseOrderLifecycle) {
  return lifecycle.phase === 'preflight' || lifecycle.phase === 'build'
    ? ('releaseWorkbenchStepBuild' as const)
    : ('releaseWorkbenchStepDeploy' as const);
}
