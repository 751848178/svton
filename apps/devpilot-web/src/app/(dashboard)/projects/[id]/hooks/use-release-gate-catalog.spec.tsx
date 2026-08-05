// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseGateCatalog, ReleaseGateStatus } from '../types/release-gate.types';
import { useReleaseGateCatalog } from './use-release-gate-catalog';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useReleaseGateCatalog request ownership', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof useReleaseGateCatalog>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('uses the release-order-owned gate catalog endpoint exactly', async () => {
    mocks.apiRequest.mockResolvedValue(catalog('order-1', 'v13'));
    await render('order-1');
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'GET:/projects/project-1/delivery/releases/order-1/gates',
    );
  });

  it('hides A synchronously and ignores its late response after B owns the hook', async () => {
    const responseA = deferred<ReleaseGateCatalog>();
    const responseB = deferred<ReleaseGateCatalog>();
    mocks.apiRequest.mockImplementation((route: string) =>
      route.includes('/order-a/') ? responseA.promise : responseB.promise,
    );

    await render('order-a');
    await render('order-b');
    expect(latest.catalog).toBeNull();
    expect(latest.loading).toBe(true);

    await act(async () => responseB.resolve(catalog('order-b', 'new')));
    expect(latest.catalog?.catalogVersion).toBe('new');
    await act(async () => responseA.resolve(catalog('order-a', 'old')));
    expect(latest.catalog?.releaseOrder.id).toBe('order-b');
  });

  it('keeps the newest same-scope load when an older request resolves last', async () => {
    const oldRequest = deferred<ReleaseGateCatalog>();
    const newRequest = deferred<ReleaseGateCatalog>();
    mocks.apiRequest
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    await render('order-1');
    act(() => void latest.load());
    await act(async () => newRequest.resolve(catalog('order-1', 'new')));
    await act(async () => oldRequest.resolve(catalog('order-1', 'old')));
    expect(latest.catalog?.catalogVersion).toBe('new');
    expect(latest.error).toBe('');
  });

  it('ignores a stale same-scope error after the newest retry succeeds', async () => {
    const oldRequest = deferred<ReleaseGateCatalog>();
    const newRequest = deferred<ReleaseGateCatalog>();
    mocks.apiRequest
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);

    await render('order-1');
    act(() => void latest.load());
    await act(async () => newRequest.resolve(catalog('order-1', 'new')));
    await act(async () => oldRequest.reject(new Error('stale failure')));

    expect(latest.catalog?.catalogVersion).toBe('new');
    expect(latest.loading).toBe(false);
    expect(latest.error).toBe('');
  });

  it('fails closed when the response belongs to another release order', async () => {
    mocks.apiRequest.mockResolvedValue(catalog('foreign-order', 'foreign'));
    await render('order-1');
    expect(latest.catalog).toBeNull();
    expect(latest.error).toBe('Release gate catalog scope mismatch');
  });

  async function render(releaseOrderId: string) {
    await act(async () => root.render(<Probe releaseOrderId={releaseOrderId} />));
  }

  function Probe({ releaseOrderId }: { releaseOrderId: string }) {
    latest = useReleaseGateCatalog('project-1', releaseOrderId);
    return null;
  }
});

function catalog(orderId: string, version: string): ReleaseGateCatalog {
  return {
    catalogVersion: version,
    capabilityVersion: 'mvp15.test',
    releaseOrder: { id: orderId, releaseVersion: '2.4.1' },
    summary: {
      total: 0,
      phaseCounts: { commit: 0, build: 0, deploy: 0, promote: 0 },
      statusCounts: statusCounts(),
    },
    capabilities: [],
    checks: [],
  };
}

function statusCounts(): Record<ReleaseGateStatus, number> {
  return { checked: 0, unchecked: 0, blocked: 0, warning: 0, manual: 0, unavailable: 0 };
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
