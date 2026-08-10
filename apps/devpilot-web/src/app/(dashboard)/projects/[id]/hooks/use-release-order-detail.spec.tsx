// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import { scopedRequestIdentity } from './use-scoped-request-guard';
import { useReleaseOrderDetail } from './use-release-order-detail';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useReleaseOrderDetail scope ownership', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useReleaseOrderDetail>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('hides loaded A synchronously and keeps B failure after late A failure', async () => {
    const lateA = deferred<ReleaseOrderDetail>();
    const responseB = deferred<ReleaseOrderDetail>();
    let aCalls = 0;
    mocks.apiRequest.mockImplementation((route: string) => {
      if (route.includes('/order-a')) {
        aCalls += 1;
        return aCalls === 1 ? Promise.resolve(detail('order-a', 'production')) : lateA.promise;
      }
      return responseB.promise;
    });

    await render(root, 'order-a');
    expect(latest.detail?.id).toBe('order-a');
    act(() => void latest.load());
    await render(root, 'order-b');
    expect(latest.detail).toBeNull();
    expect(latest.loading).toBe(true);

    await act(async () => responseB.reject(new Error('B failed')));
    await act(async () => lateA.reject(new Error('late A failed')));
    expect(latest.detail).toBeNull();
    expect(latest.error).toBe('B failed');
    expect(latest.scope).toBe(scopedRequestIdentity('project-1', 'order-b'));
  });

  it('ignores late A success after B succeeds first', async () => {
    const responseA = deferred<ReleaseOrderDetail>();
    const responseB = deferred<ReleaseOrderDetail>();
    mocks.apiRequest.mockImplementation((route: string) =>
      route.includes('/order-a') ? responseA.promise : responseB.promise,
    );

    await render(root, 'order-a');
    await render(root, 'order-b');
    await act(async () => responseB.resolve(detail('order-b', 'build')));
    expect(latest.detail?.id).toBe('order-b');
    await act(async () => responseA.resolve(detail('order-a', 'production')));
    expect(latest.detail?.id).toBe('order-b');
    expect(latest.detail?.resumeStep).toBe('build');
  });

  async function render(target: Root, releaseOrderId: string) {
    await act(async () => target.render(<Probe releaseOrderId={releaseOrderId} />));
  }

  function Probe({ releaseOrderId }: { releaseOrderId: string }) {
    latest = useReleaseOrderDetail('project-1', releaseOrderId);
    return null;
  }
});

function detail(id: string, resumeStep: ReleaseOrderStep): ReleaseOrderDetail {
  return {
    id,
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T01:00:00.000Z',
    counts: { buildRuns: 1, manifests: 1, releaseRuns: 0 },
    persistedStatus: 'active',
    lifecycle: {
      status: 'building',
      phase: 'build',
      sourceType: 'build_run',
      sourceId: 'build-1',
      sourceStatus: 'running',
      occurredAt: '2026-08-05T01:00:00.000Z',
    },
    resumeStep,
    preflight: {
      ready: true,
      repository: { ready: true, branch: 'main', identityRevisionId: 'r1', identityRevision: 1 },
      staging: { ready: true },
      production: { ready: true },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}
