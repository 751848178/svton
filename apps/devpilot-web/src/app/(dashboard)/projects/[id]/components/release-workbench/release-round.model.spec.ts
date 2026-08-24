import { describe, expect, it } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import {
  latestBuild,
  latestStagingDeployment,
  latestSuccessfulManifestBuild,
  productionManifestBuild,
  stagingProvenBuild,
} from './release-round.model';

describe('release round model', () => {
  it('picks the newest build by revision, not list order', () => {
    const newest = latestBuild([build('b1', 1), build('b3', 3), build('b2', 2)]);
    expect(newest?.id).toBe('b3');
  });

  it('only offers succeeded builds with manifests as deployable', () => {
    const items = [
      build('failed', 5, 'failed'),
      build('no-manifest', 4, 'succeeded', null),
      build('ok', 3),
    ];
    expect(latestSuccessfulManifestBuild(items)?.id).toBe('ok');
    expect(latestSuccessfulManifestBuild([])).toBeNull();
  });

  it('picks the newest staging deployment by start time', () => {
    const latest = latestStagingDeployment([
      staging('s-old', '2026-08-05T00:00:00Z'),
      staging('s-new', '2026-08-05T02:00:00Z'),
    ]);
    expect(latest?.id).toBe('s-new');
  });

  it('derives the staging-proven build from completed non-dry runs', () => {
    const stagingRuns = [
      staging('s-running', '2026-08-05T03:00:00Z', { status: 'running' }),
      staging('s-dry', '2026-08-05T02:30:00Z', { dryRun: true }),
      staging('s-done', '2026-08-05T02:00:00Z', { artifactManifestId: 'm2' }),
    ];
    expect(stagingProvenBuild(stagingRuns, builds())?.id).toBe('b2');
  });

  it('freezes the production artifact to the first production run manifest', () => {
    const stagingRuns = [staging('s-done', '2026-08-05T02:00:00Z', { artifactManifestId: 'm2' })];
    const productionRuns = [productionRun('m1')];
    // 已有生产运行 → 冻结为 m1（即使存在更新的 m2 预发证明）。
    expect(
      productionManifestBuild({ productionRuns, stagingRuns, builds: builds() })?.id,
    ).toBe('b1');
    // 尚无生产运行 → 使用最新预发验证通过的 m2。
    expect(
      productionManifestBuild({ productionRuns: [], stagingRuns, builds: builds() })?.id,
    ).toBe('b2');
  });
});

function builds(): ReleaseBuildItem[] {
  return [build('b1', 1, 'succeeded', 'm1'), build('b2', 2, 'succeeded', 'm2')];
}

function build(
  id: string,
  revision: number,
  status = 'succeeded',
  manifestId: string | null = `m${revision}`,
): ReleaseBuildItem {
  return {
    id,
    releaseOrderId: 'order-1',
    revision,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    status,
    createdAt: `2026-08-05T0${revision}:00:00Z`,
    manifest: manifestId ? { id: manifestId, digest: `sha256:${id}`, items: [] } : null,
  } as ReleaseBuildItem;
}

function staging(
  id: string,
  startedAt: string,
  overrides: Partial<ReleaseStagingDeploymentItem> = {},
): ReleaseStagingDeploymentItem {
  return {
    id,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-env',
    artifactManifestId: 'm1',
    status: 'completed',
    dryRun: false,
    startedAt,
    createdAt: startedAt,
    ...overrides,
  } as ReleaseStagingDeploymentItem;
}

function productionRun(manifestId: string): ReleaseEvidenceProductionRun {
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'production-env',
    artifactManifestId: manifestId,
    status: 'succeeded',
    createdAt: '2026-08-05T04:00:00Z',
    manifest: { id: manifestId, digest: `sha256:${manifestId}` },
    operationApproval: { id: 'approval-1', status: 'approved', requestedAt: '2026-08-05T03:30:00Z' },
    deploymentRuns: [],
  } as unknown as ReleaseEvidenceProductionRun;
}
