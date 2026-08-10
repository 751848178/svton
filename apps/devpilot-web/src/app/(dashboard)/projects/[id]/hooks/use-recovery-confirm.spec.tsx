// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecoveryConfirm } from './use-recovery-confirm';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useRecoveryConfirm', () => {
  let root: Root;
  let latest: ReturnType<typeof useRecoveryConfirm>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    mocks.apiRequest.mockReset();
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => act(async () => root.unmount()));

  it('previews the historical snapshot and creates a recovery ReleaseRun with a fresh inputHash', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce(preview())
      .mockResolvedValueOnce(run());
    await render();
    let result: unknown;
    await act(async () => {
      result = await latest.create('prod-env-1', 'version-1');
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      1,
      'POST:/projects/project-1/delivery/environment-versions/prod-env-1/recovery/preview',
      { sourceVersionId: 'version-1' },
    );
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(
      2,
      'POST:/projects/project-1/delivery/environment-versions/prod-env-1/recovery/confirm',
      {
        sourceVersionId: 'version-1',
        expectedInputHash: preview().inputHash,
        idempotencyKey: 'production-recovery-prod-env-1-version-1',
      },
    );
    expect(result).toMatchObject({ run: { mode: 'recovery' }, preview: { inputHash: preview().inputHash } });
  });

  it('surfaces preview errors from the server', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('回退版本不存在或不属于当前环境'));
    await render();
    let preview: unknown;
    await act(async () => {
      preview = await latest.preview('prod-env-1', 'unknown');
    });
    expect(preview).toBeNull();
    expect(latest.error).toBe('回退版本不存在或不属于当前环境');
    expect(latest.working).toBe(false);
  });

  it('guards double submission: a second create while in flight is dropped', async () => {
    let resolveFirst!: () => void;
    mocks.apiRequest.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFirst = resolve;
        }),
    );
    await render();

    let first!: Promise<unknown>;
    let duplicate!: Promise<unknown>;
    act(() => {
      first = latest.create('prod-env-1', 'version-1');
      duplicate = latest.create('prod-env-1', 'version-1');
    });
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1);

    await act(async () => resolveFirst());
    await expect(first).resolves.toBeNull();
    await expect(duplicate).resolves.toBeNull();
    expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
  });

  async function render() {
    await act(async () => root.render(<Probe />));
  }

  function Probe() {
    latest = useRecoveryConfirm('project-1');
    return null;
  }
});

function preview() {
  return {
    inputHash: 'a'.repeat(64),
    sourceVersionId: 'version-1',
    sourceReleaseRunId: 'source-run-1',
    sourceVersionKind: 'upgrade',
    snapshot: {
      releaseOrder: { id: 'order-1', releaseVersion: '1.0.0' },
      environment: { id: 'prod-env-1', key: 'production', name: 'Production', baselineRole: 'production' },
      build: { id: 'build-1', revision: 1, sourceBranch: 'main', sourceCommitSha: 'a'.repeat(40) },
      manifest: { id: 'manifest-1', digest: 'sha256:exact' },
      config: { revisionId: 'config-1', revision: 1, snapshotHash: 'config-v1' },
      releasePolicy: { revisionId: null, revision: 0, synthetic: true },
    },
  };
}

function run() {
  return {
    id: 'recovery-run-1',
    mode: 'recovery',
    status: 'awaiting_approval',
    sourceReleaseRunId: 'source-run-1',
    inputHash: 'a'.repeat(64),
    releaseOrderId: 'order-1',
    environmentId: 'prod-env-1',
    artifactManifestId: 'manifest-1',
    operationApproval: {
      id: 'approval-1',
      status: 'pending',
      inputHash: 'a'.repeat(64),
      requestedAt: '2026-08-06T00:00:00.000Z',
    },
  };
}
