// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@svton/api-client';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { useReleaseBuildDetail } from './use-release-build-detail';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));

describe('useReleaseBuildDetail', () => {
  let root: Root;
  let latest: ReturnType<typeof useReleaseBuildDetail>;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => act(async () => root.unmount()));

  it('fetches the exact scoped run and ignores an older response', async () => {
    const first = deferred<ReleaseBuildItem>();
    const second = deferred<ReleaseBuildItem>();
    mocks.apiRequest.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await render('build-a');
    await render('build-b');
    await act(async () => second.resolve(build('build-b', 'exact-b')));
    await act(async () => first.resolve(build('build-a', 'late-a')));

    expect(mocks.apiRequest.mock.calls[1]?.[0]).toContain('/builds/build-b');
    expect(latest.run).toMatchObject({ id: 'build-b', logReference: 'exact-b' });
    expect(latest.loaded).toBe(true);
  });

  it('retains a retryable error and distinguishes an explicit 404', async () => {
    mocks.apiRequest.mockRejectedValueOnce(new Error('network offline'));
    await render('build-a');
    expect(latest).toMatchObject({ error: 'network offline', notFound: false, loaded: true });

    mocks.apiRequest.mockRejectedValueOnce(new ApiError(404, 'missing'));
    await act(async () => latest.retry());
    expect(latest).toMatchObject({ error: '', notFound: true, loaded: true });
  });

  async function render(buildRunId: string) {
    await act(async () => root.render(<Probe buildRunId={buildRunId} />));
  }

  function Probe({ buildRunId }: { buildRunId: string }) {
    latest = useReleaseBuildDetail('project-1', 'order-1', buildRunId, null);
    return null;
  }
});

function build(id: string, logReference: string) {
  return { id, releaseOrderId: 'order-1', logReference } as ReleaseBuildItem;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
