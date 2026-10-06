import { readDeploymentCommandSteps } from '@/lib/deployment-command-parser';
import { readDeploymentStageEvidence } from '@/lib/deployment-stage-evidence';
import type { DeploymentRun } from '../types/operations';

const POLLING_STATUSES = new Set(['queued', 'running', 'blocked']);

export function deploymentRunNeedsPolling(status?: string | null) {
  return Boolean(status && POLLING_STATUSES.has(status.toLowerCase()));
}

export function deploymentReleaseOrderId(run: DeploymentRun) {
  return run.artifactManifest?.releaseOrderId
    ?? run.releaseStageAttempts?.[0]?.releaseStage.releasePlan.releaseOrderId
    ?? null;
}

export function deploymentHealthEvidence(run: DeploymentRun) {
  const step = readDeploymentCommandSteps(run.commandPlan)
    .find((item) => ['health_check', 'smoke_check'].includes(item.key));
  const observed = step ? readDeploymentStageEvidence(run.result).get(step.key) ?? null : null;
  return { target: run.healthCheckUrl ?? null, step: step ?? null, observed };
}

export function storedDeploymentLogLines(value: unknown) {
  if (typeof value === 'string') {
    return value.split('\n').filter(Boolean).map((message) => ({ level: 'info', message }));
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || !('message' in item)) return [];
    const record = item as Record<string, unknown>;
    return [{ level: String(record.level ?? 'info'), message: String(record.message ?? '') }];
  });
}

export function shortDeploymentRunId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}
