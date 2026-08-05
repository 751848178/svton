// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem, ReleaseBuildListResponse } from '../types/release-order.types';
import { scopedRequestIdentity } from './use-scoped-request-guard';
import { useReleaseBuilds } from './use-release-builds';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), onChanged: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useReleaseBuilds scope ownership', () => {
  let root: Root;
  let latest: ReturnType<typeof useReleaseBuilds>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
    mocks.onChanged.mockReset().mockResolvedValue(undefined);
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => act(async () => root.unmount()));

  it('hides loaded A and keeps B empty after B and late A failures', async () => {
    const lateA = deferred<ReleaseBuildListResponse>();
    const responseB = deferred<ReleaseBuildListResponse>();
    let aCalls = 0;
    mocks.apiRequest.mockImplementation((route: string) => {
      if (route.includes('/order-a/')) {
        aCalls += 1;
        return aCalls === 1 ? Promise.resolve(list(build('a-1', 'order-a'))) : lateA.promise;
      }
      return responseB.promise;
    });

    await render(root, 'order-a');
    expect(latest.items.map((item) => item.id)).toEqual(['a-1']);
    act(() => void latest.load());
    await render(root, 'order-b');
    expect(latest.items).toEqual([]);
    expect(latest.loadedSuccessfully).toBe(false);

    await act(async () => responseB.reject(new Error('B failed')));
    await act(async () => lateA.reject(new Error('late A failed')));
    expect(latest.items).toEqual([]);
    expect(latest.error).toBe('B failed');
    expect(latest.successfulScope).toBeNull();
  });

  it('keeps B success when A list succeeds late', async () => {
    const responseA = deferred<ReleaseBuildListResponse>();
    const responseB = deferred<ReleaseBuildListResponse>();
    mocks.apiRequest.mockImplementation((route: string) =>
      route.includes('/order-a/') ? responseA.promise : responseB.promise,
    );

    await render(root, 'order-a');
    await render(root, 'order-b');
    await act(async () => responseB.resolve(list(build('b-1', 'order-b'))));
    await act(async () => responseA.resolve(list(build('a-1', 'order-a'))));
    expect(latest.items.map((item) => item.id)).toEqual(['b-1']);
    expect(latest.successfulScope).toBe(scopedRequestIdentity('project-1', 'order-b'));
  });

  it('ignores a late A buildLatest response after B owns the scope', async () => {
    const lateBuild = deferred<ReleaseBuildItem>();
    const responseB = deferred<ReleaseBuildListResponse>();
    mocks.apiRequest.mockImplementation((route: string, body?: unknown) => {
      if (route.includes('/order-a/') && body) return lateBuild.promise;
      if (route.includes('/order-a/')) return Promise.resolve(list(build('a-1', 'order-a')));
      return responseB.promise;
    });

    await render(root, 'order-a', true);
    let buildRequest!: Promise<ReleaseBuildItem | null>;
    act(() => {
      buildRequest = latest.buildLatest();
    });
    await render(root, 'order-b', true);
    await act(async () => responseB.resolve(list(build('b-1', 'order-b'))));
    await act(async () => {
      lateBuild.resolve(build('a-2', 'order-a'));
      await buildRequest;
    });
    expect(latest.items.map((item) => item.id)).toEqual(['b-1']);
    expect(mocks.onChanged).not.toHaveBeenCalled();
  });

  it('keeps an accepted build when an older same-scope list resolves later', async () => {
    const olderList = deferred<ReleaseBuildListResponse>();
    const buildResponse = deferred<ReleaseBuildItem>();
    mocks.apiRequest.mockImplementation((_route: string, body?: unknown) =>
      body ? buildResponse.promise : olderList.promise,
    );

    await render(root, 'order-a');
    let buildRequest!: Promise<ReleaseBuildItem | null>;
    act(() => {
      buildRequest = latest.buildLatest();
    });
    await act(async () => buildResponse.resolve(build('new-build', 'order-a')));
    await act(async () => buildRequest);
    expect(latest.items.map((item) => item.id)).toEqual(['new-build']);

    await act(async () => olderList.resolve(list(build('old-build', 'order-a'))));
    expect(latest.items.map((item) => item.id)).toEqual(['new-build']);
  });

  async function render(target: Root, releaseOrderId: string, keyed = false) {
    await act(async () =>
      target.render(
        <Probe
          key={keyed ? releaseOrderId : undefined}
          releaseOrderId={releaseOrderId}
        />,
      ),
    );
  }

  function Probe({ releaseOrderId }: { releaseOrderId: string }) {
    latest = useReleaseBuilds('project-1', releaseOrderId, mocks.onChanged);
    return null;
  }
});

function list(...items: ReleaseBuildItem[]): ReleaseBuildListResponse {
  return { items, total: items.length };
}

function build(id: string, releaseOrderId: string) {
  return { id, releaseOrderId, revision: 1, status: 'succeeded' } as ReleaseBuildItem;
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
