// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem, ReleaseBuildListResponse } from '../types/release-order.types';
import { useReleaseBuilds } from './use-release-builds';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn(), onChanged: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useReleaseBuilds refresh behavior', () => {
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

  afterEach(async () => {
    vi.useRealTimers();
    await act(async () => root.unmount());
  });

  it('preserves loaded rows when a same-scope refresh fails', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce(list(build('build-1', 'succeeded')))
      .mockRejectedValueOnce(new Error('refresh failed'));
    await render();
    await act(async () => latest.load());

    expect(latest.items.map((item) => item.id)).toEqual(['build-1']);
    expect(latest.loadedSuccessfully).toBe(true);
    expect(latest.error).toBe('refresh failed');
  });

  it('polls the list while a build POST is still in flight', async () => {
    vi.useFakeTimers();
    const pendingBuild = deferred<ReleaseBuildItem>();
    mocks.apiRequest.mockImplementation((_route: string, body?: unknown) =>
      body ? pendingBuild.promise : Promise.resolve(list()),
    );
    await render();
    let request!: Promise<ReleaseBuildItem | null>;
    act(() => {
      request = latest.buildLatest();
    });

    await act(async () => vi.advanceTimersByTimeAsync(5_000));
    expect(mocks.apiRequest.mock.calls.filter((call) => call[1] === undefined)).toHaveLength(2);

    await act(async () => pendingBuild.resolve(build('build-1', 'succeeded')));
    await act(async () => request);
  });

  it('keeps an optimistic history page bounded and increments its total', async () => {
    const existing = Array.from({ length: 50 }, (_, index) => build(`build-${index}`, 'succeeded'));
    mocks.apiRequest.mockImplementation((_route: string, body?: unknown) =>
      body
        ? Promise.resolve(build('build-new', 'succeeded'))
        : Promise.resolve({ items: existing, total: 100 }),
    );
    await render(50);
    await act(async () => latest.buildLatest());

    expect(latest.items).toHaveLength(50);
    expect(latest.items[0]?.id).toBe('build-new');
    expect(latest.total).toBe(101);
  });

  async function render(historyLimit?: number) {
    await act(async () => root.render(<Probe historyLimit={historyLimit} />));
  }

  function Probe({ historyLimit }: { historyLimit?: number }) {
    latest = useReleaseBuilds('project-1', 'order-1', mocks.onChanged, true, historyLimit);
    return null;
  }
});

function list(...items: ReleaseBuildItem[]): ReleaseBuildListResponse {
  return { items, total: items.length };
}

function build(id: string, status: string) {
  return { id, releaseOrderId: 'order-1', revision: 1, status } as ReleaseBuildItem;
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
