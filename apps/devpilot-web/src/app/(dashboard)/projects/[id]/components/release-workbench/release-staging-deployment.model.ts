import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';

export type StagingStageState = 'passed' | 'failed' | 'running' | 'skipped' | 'unavailable';
export interface StagingDeploymentStage {
  key: string;
  state: StagingStageState;
  evidence: string[];
}
export interface StagingWorkload {
  serviceId: string;
  componentKey: string;
  name: string;
  kind: string;
  ports: string;
  executionMode: string;
}
export interface StagingProbeEvidence {
  key: string;
  status: string;
  checkedAt: string | null;
  raw: Record<string, unknown>;
}
export function stagingDeploymentFacts(run: ReleaseStagingDeploymentItem) {
  const params = record(run.params);
  const input = record(params.deploymentInput);
  const target = record(input.target);
  const provider = record(params.deploymentProvider);
  const result = record(run.result);
  return {
    providerKey: text(target.providerKey) || text(provider.key) || text(result.providerKey),
    targetRef: text(target.targetRef) || text(provider.targetRef) || text(result.providerTargetRef),
    serverId: text(target.serverId),
    bindingId: text(target.bindingId),
    manifestId: text(params.manifestId) || text(result.manifestId) || run.artifactManifestId || '',
    manifestDigest: text(params.manifestDigest) || text(result.manifestDigest),
  };
}
export function stagingDeploymentStages(run: ReleaseStagingDeploymentItem) {
  const result = record(run.result);
  const exact = exactStepResults(result);
  return commandSteps(run.commandPlan).map((key) => {
    const observed = exact.get(key);
    if (observed) return observed;
    return inferredStage(key, result);
  });
}
export function stagingWorkloads(run: ReleaseStagingDeploymentItem): StagingWorkload[] {
  const input = record(record(run.params).deploymentInput);
  const workload = record(input.workload);
  return array(workload.services).flatMap((value) => {
    const item = record(value);
    const serviceId = text(item.serviceId);
    if (!serviceId) return [];
    return [
      {
        serviceId,
        componentKey: text(item.componentKey),
        name: text(item.name),
        kind: text(item.kind),
        ports: Array.isArray(item.ports) ? JSON.stringify(item.ports) : '',
        executionMode: text(item.executionMode),
      },
    ];
  });
}
export function stagingProbeEvidence(run: ReleaseStagingDeploymentItem) {
  const result = record(run.result);
  return ['workloadReady', 'healthProbe', 'httpProbe', 'siteProbe', 'routeSwitch'].flatMap(
    (key): StagingProbeEvidence[] => {
      const raw = record(result[key]);
      if (Object.keys(raw).length === 0) return [];
      return [
        {
          key,
          status: text(raw.status) || 'recorded',
          checkedAt: text(raw.checkedAt) || text(raw.probedAt) || text(raw.switchedAt) || null,
          raw,
        },
      ];
    },
  );
}
function commandSteps(value: unknown) {
  const plan = record(value);
  return array(plan.steps).flatMap((step) => {
    if (typeof step === 'string' && step) return [step];
    const key = text(record(step).key);
    return key ? [key] : [];
  });
}
function exactStepResults(result: Record<string, unknown>) {
  const entries = array(result.stepResults ?? result.steps).flatMap((value) => {
    const item = record(value);
    const key = text(item.key);
    if (!key) return [];
    const status = text(item.status).toLowerCase();
    const state = stageState(status, item);
    const evidence = [
      typeof item.exitCode === 'number' ? `exitCode=${item.exitCode}` : '',
      typeof item.durationMs === 'number' ? `durationMs=${item.durationMs}` : '',
      text(item.skipReason) ? `skipReason=${text(item.skipReason)}` : '',
    ].filter(Boolean);
    return [[key, { key, state, evidence }] as const];
  });
  return new Map(entries);
}
function inferredStage(key: string, result: Record<string, unknown>): StagingDeploymentStage {
  if (key === 'verify_manifest_digest') {
    return booleanStage(key, result.artifactVerified, ['result.artifactVerified']);
  }
  if (key === 'materialize_exact_manifest') {
    const count = number(result.materializedEntries);
    return count === null
      ? unavailable(key)
      : { key, state: 'passed', evidence: [`result.materializedEntries=${count}`] };
  }
  if (key === 'start_workloads') {
    return statusStage(key, record(result.workloadReady), 'result.workloadReady');
  }
  if (key === 'probe_workloads') {
    return combinedProbeStage(key, result);
  }
  if (key === 'activate_release' || key === 'deploy_exact_manifest') {
    const evidence = ['result.providerActivated'];
    if (text(result.providerDeploymentId)) {
      evidence.push(`result.providerDeploymentId=${text(result.providerDeploymentId)}`);
    }
    return booleanStage(key, result.providerActivated, evidence);
  }
  return unavailable(key);
}
function combinedProbeStage(key: string, result: Record<string, unknown>) {
  const probes = ['healthProbe', 'httpProbe'].flatMap((name) => {
    const item = record(result[name]);
    return Object.keys(item).length ? [{ name, status: text(item.status).toLowerCase() }] : [];
  });
  if (probes.length === 0) return unavailable(key);
  const state: StagingStageState = probes.some((item) =>
    ['failed', 'blocked', 'invalid'].includes(item.status),
  )
    ? 'failed'
    : probes.every((item) => ['passed', 'verified', 'not_configured'].includes(item.status))
      ? 'passed'
      : probes.some((item) => ['running', 'queued', 'pending'].includes(item.status))
        ? 'running'
        : 'unavailable';
  return {
    key,
    state,
    evidence: probes.map((item) => `result.${item.name}.status=${item.status}`),
  };
}
function statusStage(key: string, value: Record<string, unknown>, source: string) {
  if (Object.keys(value).length === 0) return unavailable(key);
  const status = text(value.status).toLowerCase();
  return {
    key,
    state: stageState(status, value),
    evidence: [`${source}.status=${status || 'recorded'}`],
  };
}
function booleanStage(key: string, value: unknown, evidence: string[]): StagingDeploymentStage {
  const fields = evidence.map((item) => (item.includes('=') ? item : `${item}=${value}`));
  if (value === true) return { key, state: 'passed', evidence: fields };
  if (value === false) return { key, state: 'failed', evidence: fields };
  return unavailable(key);
}

function stageState(status: string, value: Record<string, unknown>): StagingStageState {
  if (['passed', 'completed', 'succeeded', 'verified'].includes(status)) return 'passed';
  if (['failed', 'blocked', 'invalid'].includes(status) || value.exitCode !== undefined) {
    return value.exitCode === 0 ? 'passed' : 'failed';
  }
  if (['running', 'queued', 'pending'].includes(status)) return 'running';
  if (['skipped', 'not_configured'].includes(status)) return 'skipped';
  return 'unavailable';
}

function unavailable(key: string): StagingDeploymentStage {
  return { key, state: 'unavailable', evidence: [] };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
