import type { ReleaseEvidenceDeploymentRun } from '../types/release-order-evidence.types';

export type ReleaseProductionConclusion = {
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

/** 技术部署结论：完全由 DeploymentRun 自身的执行状态 + 结构化 result 推导。 */
export function productionTechnicalConclusion(
  run: ReleaseEvidenceDeploymentRun,
): ReleaseProductionConclusion {
  const status = run.status.toLowerCase();
  if (isReleaseDeploymentActive(status)) {
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

/** 业务验证结论：独立证据，当前 MVP 不阻断生产前置条件。 */
export function productionBusinessConclusion(
  run: ReleaseEvidenceDeploymentRun,
): ReleaseProductionConclusion {
  const status = String(record(record(run.result).businessValidation).status || '').toLowerCase();
  if (status === 'passed' || status === 'succeeded' || status === 'verified') {
    return { key: 'releaseStagingBusinessPassed', tone: 'success' };
  }
  if (status === 'failed' || status === 'blocked') {
    return { key: 'releaseStagingBusinessFailed', tone: 'danger' };
  }
  return { key: 'releaseStagingBusinessPending', tone: 'warning' };
}

export function isReleaseDeploymentActive(status: string) {
  return ['created', 'queued', 'running', 'pending'].includes(status.toLowerCase());
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
