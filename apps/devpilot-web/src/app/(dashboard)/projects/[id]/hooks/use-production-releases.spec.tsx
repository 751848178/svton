// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProductionReleasePreview, ProductionReleaseRun } from '../types/release-order.types';
import { useProductionReleases } from './use-production-releases';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  onChanged: vi.fn(),
  actorId: 'actor-1',
  teamId: 'team-1',
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: mocks.actorId ? { id: mocks.actorId } : null }),
  useTeamStore: () => ({ currentTeam: mocks.teamId ? { id: mocks.teamId } : null }),
}));

describe('useProductionReleases scope ownership', () => {
  let root: Root;
  let latest: ReturnType<typeof useProductionReleases>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
    mocks.onChanged.mockReset().mockResolvedValue(undefined);
    mocks.actorId = 'actor-1';
    mocks.teamId = 'team-1';
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => act(async () => root.unmount()));

  it('hides the old team preview and ignores its late success', async () => {
    const oldTeam = deferred<ProductionReleasePreview>();
    const newTeam = deferred<ProductionReleasePreview>();
    mocks.apiRequest.mockReturnValueOnce(oldTeam.promise).mockReturnValueOnce(newTeam.promise);

    await render();
    mocks.teamId = 'team-2';
    await render();
    expect(latest.preview).toBeNull();

    await act(async () => newTeam.resolve(preview('project-1', 'order-1', 'manifest-1', 'new')));
    await act(async () => oldTeam.resolve(preview('project-1', 'order-1', 'manifest-1', 'old')));
    expect(latest.preview?.inputHash).toBe('new');
  });

  it('fails closed on a foreign project preview', async () => {
    mocks.apiRequest.mockResolvedValue(preview('project-2', 'order-1', 'manifest-1', 'foreign'));
    await render();

    expect(latest.preview).toBeNull();
    expect(latest.error).toBe('releaseProductionPreviewScopeMismatch');
  });

  it('submits one exact confirmation while the first request is in flight', async () => {
    const response = deferred<ProductionReleaseRun>();
    mocks.apiRequest.mockImplementation((_route: string, body?: unknown) =>
      body
        ? response.promise
        : Promise.resolve(preview('project-1', 'order-1', 'manifest-1', 'hash')),
    );
    await render();

    let first!: Promise<ProductionReleaseRun | null>;
    let duplicate!: Promise<ProductionReleaseRun | null>;
    act(() => {
      first = latest.confirm();
      duplicate = latest.confirm();
    });
    expect(mocks.apiRequest.mock.calls.filter((call) => call[1])).toHaveLength(1);
    await expect(duplicate).resolves.toBeNull();

    await act(async () => response.resolve(run()));
    await expect(first).resolves.toMatchObject({ id: 'release-1' });
    expect(mocks.onChanged).toHaveBeenCalledOnce();
  });

  async function render() {
    await act(async () => root.render(<Probe />));
  }

  function Probe() {
    latest = useProductionReleases('project-1', 'order-1', 'manifest-1', mocks.onChanged);
    return null;
  }
});

function preview(projectId: string, orderId: string, manifestId: string, inputHash: string) {
  return {
    inputHash,
    snapshot: {
      projectId,
      releaseOrder: { id: orderId },
      manifest: { id: manifestId },
    },
  } as ProductionReleasePreview;
}

function run() {
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
  } as ProductionReleaseRun;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}
