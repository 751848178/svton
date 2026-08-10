// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import { useProductionApproval } from './use-production-approval';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  onChanged: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useProductionApproval', () => {
  let root: Root;
  let latest: ReturnType<typeof useProductionApproval>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    mocks.apiRequest.mockReset().mockResolvedValue(undefined);
    mocks.onChanged.mockReset().mockResolvedValue(undefined);
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => act(async () => root.unmount()));

  it('approves the bound approval and refreshes evidence once', async () => {
    await render();
    let ok = false;
    await act(async () => {
      ok = await latest.review('approved');
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith('POST:/operation-approvals/approval-1/review', {
      decision: 'approved',
      reviewComment: undefined,
    });
    expect(ok).toBe(true);
    expect(mocks.onChanged).toHaveBeenCalledOnce();
  });

  it('rejects with the required comment and surfaces errors from the server', async () => {
    await render();
    await act(async () => {
      await latest.review('rejected', 'change window blocked');
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith('POST:/operation-approvals/approval-1/review', {
      decision: 'rejected',
      reviewComment: 'change window blocked',
    });
    expect(mocks.onChanged).toHaveBeenCalledOnce();

    mocks.apiRequest.mockRejectedValue(new Error('只有待审批的操作可以审批'));
    let ok = true;
    await act(async () => {
      ok = await latest.review('approved');
    });
    expect(ok).toBe(false);
    expect(latest.error).toBe('只有待审批的操作可以审批');
    expect(latest.acting).toBe(false);
  });

  it('executes the production release against the environment action with the bound ReleaseRun', async () => {
    await render();
    let ok = false;
    await act(async () => {
      ok = await latest.execute();
    });
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'POST:/projects/project-1/delivery/environment-versions/prod-env-1/actions',
      { kind: 'upgrade', manifestId: 'manifest-1', releaseRunId: 'release-1' },
    );
    expect(ok).toBe(true);
    expect(mocks.onChanged).toHaveBeenCalledOnce();
  });

  it('guards double submission: a second execute while in flight is dropped', async () => {
    let resolveFirst!: () => void;
    mocks.apiRequest.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    await render();

    let first!: Promise<boolean>;
    let duplicate!: Promise<boolean>;
    act(() => {
      first = latest.execute();
      duplicate = latest.execute();
    });
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1);

    await act(async () => resolveFirst());
    await expect(first).resolves.toBe(true);
    await expect(duplicate).resolves.toBe(false);
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
  });

  async function render() {
    await act(async () => root.render(<Probe />));
  }

  function Probe() {
    latest = useProductionApproval('project-1', run(), mocks.onChanged);
    return null;
  }
});

function run(): ReleaseEvidenceProductionRun {
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'prod-env-1',
    artifactManifestId: 'manifest-1',
    status: 'awaiting_approval',
    mode: 'standard',
    verifiedDigest: 'sha256:exact',
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-06T00:00:00.000Z',
    environment: { id: 'prod-env-1', name: 'Production', baselineRole: 'production' },
    manifest: {
      id: 'manifest-1',
      digest: 'sha256:exact',
      createdAt: '2026-08-06T00:00:00.000Z',
      buildRun: {
        id: 'build-1',
        revision: 1,
        sourceBranch: 'main',
        sourceCommitSha: 'a'.repeat(40),
      },
      items: [],
    },
    operationApproval: {
      id: 'approval-1',
      status: 'pending',
      risk: 'high',
      summary: '生产发布 1.0.0 / Build #1',
      requesterId: 'user-1',
      reviewerId: null,
      requester: { id: 'user-1', name: 'Requester', email: 'requester@example.com' },
      reviewer: null,
      reviewComment: null,
      requestedAt: '2026-08-06T00:00:00.000Z',
      reviewedAt: null,
      consumedAt: null,
      expiresAt: null,
    },
    stagingProof: null,
    deploymentRuns: [],
  };
}
