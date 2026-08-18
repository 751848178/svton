/**
 * release-progress.model.spec 的测试夹具（第 0 步）。
 * 与 release-order-detail-panel.spec-fixtures.ts 同一约定：仅数据构造，无断言。
 */

import type { ReleaseOrderDetail } from '../../types/release-order.types';
import type { ProductionReleaseRun } from '../../types/release-production.types';

export function detail(overrides: Partial<ReleaseOrderDetail> = {}): ReleaseOrderDetail {
  return {
    id: 'ro-1',
    projectId: 'p-1',
    releaseVersion: 'v1.2.0',
    note: null,
    createdAt: '2026-08-16T00:00:00Z',
    updatedAt: '2026-08-16T00:00:00Z',
    counts: { buildRuns: 0, manifests: 0, releaseRuns: 0 },
    persistedStatus: 'active',
    lifecycle: {
      status: 'draft',
      phase: 'preflight',
      sourceType: 'order_created',
      sourceId: 'ro-1',
      sourceStatus: 'created',
      occurredAt: '2026-08-16T00:00:00Z',
    },
    resumeStep: 'preflight',
    preflight: {
      ready: true,
      repository: { ready: true, branch: 'main', identityRevisionId: null, identityRevision: null },
      staging: { ready: true },
      production: { ready: true },
    },
    ...overrides,
  } as ReleaseOrderDetail;
}

export function build(status: string, overrides: Record<string, unknown> = {}) {
  return {
    id: 'b-1',
    releaseOrderId: 'ro-1',
    revision: 1,
    sourceBranch: 'main',
    sourceCommitSha: 'sha',
    sourceRepository: null,
    status,
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-16T00:01:00Z',
    manifest: status === 'succeeded' ? { id: 'm-1', digest: 'd1', items: [] } : null,
    ...overrides,
  };
}

export function staging(status: string) {
  return {
    id: 'd-1',
    projectId: 'p-1',
    releaseOrderId: 'ro-1',
    environmentId: 'env-staging',
    artifactManifestId: 'm-1',
    status,
    targetType: 'ssh',
    executorKey: 'e',
    adapterKey: 'a',
    dryRun: false,
    branch: 'main',
    commitSha: 'sha',
    logs: null,
    result: null,
    error: null,
    startedAt: '2026-08-16T00:03:00Z',
    finishedAt: '2026-08-16T00:04:00Z',
    createdAt: '2026-08-16T00:03:00Z',
  };
}

export function productionRun(overrides: Partial<ProductionReleaseRun> = {}): ProductionReleaseRun {
  return {
    id: 'run-1',
    projectId: 'p-1',
    releaseOrderId: 'ro-1',
    environmentId: 'env-prod',
    artifactManifestId: 'm-1',
    status: 'running',
    verifiedDigest: 'd1',
    inputHash: 'h1',
    idempotencyKey: 'k1',
    createdAt: '2026-08-16T01:00:00Z',
    operationApproval: null,
    ...overrides,
  };
}

export function versionItem(id: string, previousVersionId: string | null) {
  return {
    id,
    environmentId: 'env-prod',
    artifactManifestId: 'm',
    previousVersionId,
    kind: 'standard',
    effectiveAt: '2026-08-16T00:00:00Z',
    releaseOrder: { id: 'ro', releaseVersion: `release-${id}` },
    artifactManifest: {
      id: 'm',
      digest: 'd',
      buildRun: { id: 'b', revision: 1, sourceCommitSha: 'sha' },
    },
    deploymentRun: { id: 'dr', status: 'succeeded', createdAt: '', finishedAt: null },
  };
}
