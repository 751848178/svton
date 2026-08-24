import { describe, expect, it } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { buildReleaseChainViews } from './release-environment-chain.model';

describe('buildReleaseChainViews', () => {
  it('exposes the serial chain: staging release then production release', () => {
    const nodes = buildReleaseChainViews({ detail, stagingProven: false, productionRuns: [] });
    expect(nodes.map((node) => node.key)).toEqual(['staging', 'production']);
    expect(nodes.map((node) => node.state)).toEqual(['current', 'waiting']);
  });

  it('marks the staging node done once the artifact is staging-proven', () => {
    const nodes = buildReleaseChainViews({ detail, stagingProven: true, productionRuns: [] });
    expect(nodes[0]?.state).toBe('done');
    expect(nodes[1]?.state).toBe('waiting');
  });

  it('marks the staging node blocked when the lifecycle failed at staging', () => {
    const failing = {
      ...detail,
      lifecycle: { ...detail.lifecycle, status: 'failed', failureKind: 'failed' },
    } as ReleaseOrderDetail;
    const nodes = buildReleaseChainViews({ detail: failing, stagingProven: false, productionRuns: [] });
    expect(nodes[0]?.state).toBe('blocked');
  });

  it('derives the production node state from the latest ReleaseRun', () => {
    expect(
      buildReleaseChainViews({ detail, stagingProven: true, productionRuns: [run('running')] })[1]
        ?.state,
    ).toBe('current');
    expect(
      buildReleaseChainViews({ detail, stagingProven: true, productionRuns: [run('succeeded')] })[1]
        ?.state,
    ).toBe('done');
    expect(
      buildReleaseChainViews({ detail, stagingProven: true, productionRuns: [run('failed')] })[1]
        ?.state,
    ).toBe('blocked');
    // 多次运行取最新一条。
    expect(
      buildReleaseChainViews({
        detail,
        stagingProven: true,
        productionRuns: [run('succeeded', 'old'), run('failed', 'new')],
      })[1]?.state,
    ).toBe('blocked');
  });
});

const detail = {
  id: 'order-1',
  projectId: 'project-1',
  lifecycle: { status: 'staging', phase: 'staging', failureKind: null },
  resumeStep: 'staging',
} as unknown as ReleaseOrderDetail;

function run(status: string, age: 'old' | 'new' = 'old'): ReleaseEvidenceProductionRun {
  return {
    id: `release-${age}`,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'production-env',
    artifactManifestId: 'manifest-1',
    status,
    createdAt: age === 'old' ? '2026-08-05T00:00:00Z' : '2026-08-05T02:00:00Z',
    manifest: { id: 'manifest-1', digest: 'sha256:exact', buildRun: { revision: 1 } },
    operationApproval: { id: 'approval-1', status: 'approved', requestedAt: '2026-08-05T00:00:00Z' },
    deploymentRuns: [],
  } as unknown as ReleaseEvidenceProductionRun;
}
