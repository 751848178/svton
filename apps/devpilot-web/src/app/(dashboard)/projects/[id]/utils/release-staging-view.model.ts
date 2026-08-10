import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';

export type ReleaseStagingConclusion = {
  key:
    | 'releaseStagingVerificationPassed'
    | 'releaseStagingVerificationFailed'
    | 'releaseStagingVerificationRunning'
    | 'releaseStagingVerificationUnavailable'
    | 'releaseStagingBusinessPassed'
    | 'releaseStagingBusinessFailed'
    | 'releaseStagingBusinessPending';
  tone: 'success' | 'danger' | 'warning' | 'neutral';
};

export function stagingBuildForRun(run: ReleaseStagingDeploymentItem, builds: ReleaseBuildItem[]) {
  return builds.find((build) => build.manifest?.id === run.artifactManifestId) || null;
}

export function stagingTechnicalConclusion(
  run: ReleaseStagingDeploymentItem,
): ReleaseStagingConclusion {
  const status = run.status.toLowerCase();
  if (isReleaseStagingActive(status)) {
    return { key: 'releaseStagingVerificationRunning', tone: 'warning' };
  }
  if (status === 'failed' || status === 'blocked') {
    return { key: 'releaseStagingVerificationFailed', tone: 'danger' };
  }
  const result = record(run.result);
  const statuses = ['workloadReady', 'healthProbe', 'httpProbe']
    .map((key) => String(record(result[key]).status || '').toLowerCase())
    .filter(Boolean);
  if (statuses.some((value) => value === 'failed' || value === 'blocked')) {
    return { key: 'releaseStagingVerificationFailed', tone: 'danger' };
  }
  const passed = statuses.filter((value) => value === 'passed' || value === 'succeeded');
  if (
    (status === 'completed' || status === 'succeeded') &&
    passed.length >= 2 &&
    statuses.every((value) => ['passed', 'succeeded', 'not_configured'].includes(value))
  ) {
    return { key: 'releaseStagingVerificationPassed', tone: 'success' };
  }
  return { key: 'releaseStagingVerificationUnavailable', tone: 'neutral' };
}

export function stagingBusinessConclusion(
  run: ReleaseStagingDeploymentItem,
): ReleaseStagingConclusion {
  const status = String(record(record(run.result).businessValidation).status || '').toLowerCase();
  if (status === 'passed' || status === 'succeeded' || status === 'verified') {
    return { key: 'releaseStagingBusinessPassed', tone: 'success' };
  }
  if (status === 'failed' || status === 'blocked') {
    return { key: 'releaseStagingBusinessFailed', tone: 'danger' };
  }
  return { key: 'releaseStagingBusinessPending', tone: 'warning' };
}

export function stagingManifestSucceeded(manifestId: string, runs: ReleaseStagingDeploymentItem[]) {
  return runs.some(
    (run) =>
      run.artifactManifestId === manifestId &&
      !run.dryRun &&
      ['completed', 'succeeded'].includes(run.status.toLowerCase()),
  );
}

export function isReleaseStagingActive(status: string) {
  return ['created', 'queued', 'running', 'pending'].includes(status.toLowerCase());
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
