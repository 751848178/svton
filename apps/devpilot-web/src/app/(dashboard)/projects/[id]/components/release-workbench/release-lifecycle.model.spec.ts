import { describe, expect, it } from 'vitest';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { buildReleaseLifecycleEvidence } from './release-lifecycle-evidence.model';
import { buildReleaseLifecycleViews } from './release-lifecycle.model';

describe('release lifecycle evidence boundary', () => {
  it('does not turn a succeeded lifecycle green without independent evidence', () => {
    expect(states('succeeded', [], [])).toEqual(['current', 'disabled', 'disabled', 'disabled']);
  });

  it('unlocks production only after a real staging validation passes', () => {
    expect(states('staging', [staging('staging-1', 'passed')], [])).toEqual([
      'done',
      'available',
      'disabled',
      'disabled',
    ]);
  });

  it('uses the frozen staging proof instead of a later unrelated run', () => {
    const run = productionRun('awaiting_validation', {
      stagingProof: frozenProof('staging-frozen', 'failed'),
      deploymentRuns: [productionDeployment()],
    });
    expect(states('production', [staging('staging-later', 'passed')], [run])).toEqual([
      'current',
      'blocked',
      'disabled',
      'disabled',
    ]);
  });

  it('does not complete production for a mismatched DeploymentRun', () => {
    const deployment = productionDeployment({ releaseRunId: 'other-release' });
    const run = productionRun('succeeded', { deploymentRuns: [deployment] });
    expect(states('succeeded', [], [run])).toEqual(['done', 'current', 'disabled', 'disabled']);
  });

  it('blocks validation on an independently failed production check', () => {
    const deployment = productionDeployment({
      result: { ...passedResult(), healthProbe: { status: 'failed' } },
    });
    const run = productionRun('succeeded', { deploymentRuns: [deployment] });
    expect(states('succeeded', [], [run])).toEqual(['done', 'done', 'blocked', 'disabled']);
  });

  it('keeps completion current until persisted release states agree with passed evidence', () => {
    const run = productionRun('awaiting_validation', {
      deploymentRuns: [productionDeployment()],
    });
    expect(states('production', [], [run])).toEqual(['done', 'done', 'done', 'current']);
  });

  it('marks every stage done only with exact staging, deployment, validation, and final state', () => {
    const run = productionRun('succeeded', { deploymentRuns: [productionDeployment()] });
    expect(states('succeeded', [], [run])).toEqual(['done', 'done', 'done', 'done']);
  });
});

function states(
  status: string,
  stagingRuns: ReleaseEvidenceDeploymentRun[],
  productionRuns: ReleaseEvidenceProductionRun[],
) {
  const detail = releaseDetail(status);
  const evidence = buildReleaseLifecycleEvidence({
    detail,
    stagingRuns,
    productionRuns,
    currentProductionVersion: productionRuns.length > 0 ? currentVersion() : null,
  });
  return buildReleaseLifecycleViews({ detail, evidence }).map((stage) => stage.state);
}

function releaseDetail(status: string) {
  return {
    lifecycle: { status, phase: status === 'succeeded' ? 'production' : status },
    resumeStep: status === 'succeeded' ? 'production' : status,
  } as unknown as ReleaseOrderDetail;
}

function staging(id: string, health: 'passed' | 'failed') {
  return {
    id,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    releaseRunId: null,
    environmentId: 'staging-env',
    artifactManifestId: 'manifest-1',
    source: 'release_order',
    targetType: 'project_environment',
    dryRun: false,
    status: 'completed',
    createdAt: '2026-08-27T00:00:00Z',
    result: validationResult(health),
  } as ReleaseEvidenceDeploymentRun;
}

function productionRun(
  status: ReleaseEvidenceProductionRun['status'],
  overrides: Partial<ReleaseEvidenceProductionRun> = {},
) {
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'production-env',
    artifactManifestId: 'manifest-1',
    status,
    createdAt: '2026-08-27T01:00:00Z',
    verifiedDigest: 'sha256:manifest',
    manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
    stagingProof: frozenProof('staging-frozen', 'passed'),
    deploymentRuns: [],
    promotionBlocker: null,
    ...overrides,
  } as ReleaseEvidenceProductionRun;
}

function frozenProof(id: string, health: 'passed' | 'failed') {
  return {
    deploymentRunId: id,
    environmentId: 'staging-env',
    artifactManifestId: 'manifest-1',
    status: 'completed' as const,
    dryRun: false,
    result: validationResult(health),
    finishedAt: '2026-08-27T00:10:00Z',
  };
}

function productionDeployment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'deployment-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    releaseRunId: 'release-1',
    environmentId: 'production-env',
    artifactManifestId: 'manifest-1',
    source: 'release_order',
    targetType: 'project_environment',
    dryRun: false,
    status: 'completed',
    createdAt: '2026-08-27T01:01:00Z',
    finishedAt: '2026-08-27T01:02:00Z',
    result: passedResult(),
    manifest: { id: 'manifest-1', digest: 'sha256:manifest' },
    siteProbe: {
      probedAt: '2026-08-27T01:02:00Z',
      dns: { status: 'passed', checkedAt: '2026-08-27T01:01:40Z' },
      tls: { status: 'passed', checkedAt: '2026-08-27T01:01:50Z' },
      http: { status: 'passed', checkedAt: '2026-08-27T01:02:00Z' },
    },
    routeSwitch: {
      status: 'switched',
      deploymentRunId: 'deployment-1',
      releaseRunId: 'release-1',
      switchedAt: '2026-08-27T01:02:00Z',
    },
    ...overrides,
  } as ReleaseEvidenceDeploymentRun;
}

function validationResult(health: 'passed' | 'failed') {
  return {
    workloadReady: { status: 'passed' },
    healthProbe: { status: health },
    httpProbe: { status: 'passed' },
  };
}

function passedResult() {
  return {
    workloadReady: { status: 'passed', checkedAt: '2026-08-27T01:01:20Z' },
    healthProbe: { status: 'passed', checkedAt: '2026-08-27T01:01:30Z' },
  };
}

function currentVersion() {
  return {
    id: 'version-1',
    releaseOrderId: 'order-1',
    releaseVersion: '1.0.0',
    artifactManifestId: 'manifest-1',
    manifestDigest: 'sha256:manifest',
    deploymentRunId: 'deployment-1',
    effectiveAt: '2026-08-27T01:03:00Z',
  };
}
