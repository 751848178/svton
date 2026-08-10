import { describe, expect, it } from 'vitest';
import type { ReleaseOrderEvidence } from '../types/release-order-evidence.types';
import { ownsReleaseOrderEvidence } from '../utils/release-order-evidence-ownership.utils';

describe('ownsReleaseOrderEvidence', () => {
  it('accepts one exact release-owned evidence graph', () => {
    expect(ownsReleaseOrderEvidence(fixture(), 'project-1', 'order-1')).toBe(true);
  });

  it('rejects a foreign Build, DeploymentRun or ReleaseRun relation', () => {
    const foreignBuild = fixture();
    foreignBuild.buildRuns.items[0].projectId = 'project-2';
    expect(ownsReleaseOrderEvidence(foreignBuild, 'project-1', 'order-1')).toBe(false);

    const foreignDeployment = fixture();
    foreignDeployment.productionReleaseRuns.items[0].deploymentRuns[0].releaseRunId = 'release-2';
    expect(ownsReleaseOrderEvidence(foreignDeployment, 'project-1', 'order-1')).toBe(false);
  });
});

function fixture(): ReleaseOrderEvidence {
  const manifest = {
    id: 'manifest-1',
    digest: 'sha256:exact',
    createdAt: '2026-08-05T00:00:00Z',
    buildRun: { id: 'build-1', revision: 1, sourceBranch: 'main', sourceCommitSha: 'a'.repeat(40) },
    items: [{ componentKey: 'project-bundle', artifactType: 'zip', digest: 'sha256:exact' }],
  };
  const deployment = {
    id: 'deployment-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    releaseRunId: null,
    environmentId: 'staging-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    executorKey: 'release-artifact',
    adapterKey: 'local-materialize',
    branch: 'main',
    commitSha: 'a'.repeat(40),
    error: null,
    startedAt: '2026-08-05T00:00:00Z',
    finishedAt: '2026-08-05T00:01:00Z',
    createdAt: '2026-08-05T00:00:00Z',
    environment: { id: 'staging-1', name: 'Staging', baselineRole: 'staging' },
    manifest,
  };
  const productionDeployment = {
    ...deployment,
    id: 'production-deployment-1',
    releaseRunId: 'release-1',
    environmentId: 'production-1',
    environment: { id: 'production-1', name: 'Production', baselineRole: 'production' },
  };
  return {
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    buildRuns: {
      items: [
        {
          id: 'build-1',
          projectId: 'project-1',
          releaseOrderId: 'order-1',
          revision: 1,
          sourceBranch: 'main',
          sourceCommitSha: 'a'.repeat(40),
          status: 'succeeded',
          errorCode: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: '2026-08-05T00:00:00Z',
          manifest,
        },
      ],
      total: 1,
      hasMore: false,
    },
    stagingDeploymentRuns: { items: [deployment], total: 1, hasMore: false },
    productionReleaseRuns: {
      items: [
        {
          id: 'release-1',
          projectId: 'project-1',
          releaseOrderId: 'order-1',
          environmentId: 'production-1',
          artifactManifestId: 'manifest-1',
          status: 'succeeded',
          verifiedDigest: 'sha256:exact',
          errorCode: null,
          errorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: '2026-08-05T00:02:00Z',
          environment: { id: 'production-1', name: 'Production', baselineRole: 'production' },
          manifest,
          operationApproval: {
            id: 'approval-1',
            status: 'approved',
            requestedAt: '2026-08-05T00:00:00Z',
            reviewedAt: null,
          },
          stagingProof: {
            deploymentRunId: 'deployment-1',
            environmentId: 'staging-1',
            finishedAt: '2026-08-05T00:01:00Z',
          },
          deploymentRuns: [productionDeployment],
        },
      ],
      total: 1,
      hasMore: false,
    },
  };
}
