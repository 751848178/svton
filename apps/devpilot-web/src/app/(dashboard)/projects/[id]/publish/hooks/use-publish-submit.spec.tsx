// @vitest-environment jsdom

/**
 * B1 回归：waitForSucceededManifest 的失败判定只看本次提交触发的构建。
 * 历史失败构建（上一轮留下的 failed build）不得把新一轮排队/运行的构建
 * 误判为失败；本次构建失败时呈现该构建的 errorMessage。
 */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  CreateReleaseOrderInput,
  ReleaseBuildItem,
} from '../../types/release-order.types';
import { usePublishSubmit } from './use-publish-submit';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  mutate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'actor-1' } }),
  useTeamStore: () => ({ currentTeam: { id: 'team-1' } }),
}));
vi.mock('swr', () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }) }));

const INPUT: CreateReleaseOrderInput = { releaseVersion: 'v1' };

function buildItem(id: string, status: string, errorMessage: string | null): ReleaseBuildItem {
  return {
    id,
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
    errorMessage,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-16T00:01:00Z',
    manifest: null,
  } as ReleaseBuildItem;
}

describe('usePublishSubmit build tracking (B1)', () => {
  let root: Root;
  let latest: ReturnType<typeof usePublishSubmit>;
  let listFetches: ReleaseBuildItem[][];

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.apiRequest.mockReset();
    vi.useFakeTimers();
    root = createRoot(document.createElement('div'));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.useRealTimers();
  });

  it('ignores a stale failed build and deploys staging once the new build succeeds', async () => {
    const stale = buildItem('b-old', 'failed', '上一轮失败');
    const queued = buildItem('b-new', 'queued', null);
    const done = buildItem('b-new', 'succeeded', null);
    done.manifest = { id: 'm-1' } as ReleaseBuildItem['manifest'];
    // GET builds 依次为：peek 制品 → 触发前快照 → 轮询1（新构建排队+旧失败）→ 轮询2（成功）。
    listFetches = [[stale], [stale], [queued, stale], [done, stale]];
    await mountAndSubmit();

    expect(latest.phase).toBe('succeeded');
    expect(latest.failedStage).toBeNull();
    const stagingCall = mocks.apiRequest.mock.calls.find((call) =>
      String(call[0]).includes('/staging-deployments'),
    );
    expect(stagingCall?.[1]).toEqual({ manifestId: 'm-1' });
  });

  it('fails with the tracked build errorMessage when the new build fails', async () => {
    const stale = buildItem('b-old', 'failed', '上一轮失败');
    const failed = buildItem('b-new', 'failed', 'docker pull 超时');
    listFetches = [[stale], [stale], [failed, stale], [failed, stale]];
    await mountAndSubmit();

    expect(latest.phase).toBe('idle');
    expect(latest.failedStage).toBe('build');
    expect(latest.error).toBe('docker pull 超时');
    expect(
      mocks.apiRequest.mock.calls.some((call) => String(call[0]).includes('/staging-deployments')),
    ).toBe(false);
  });

  function routeHandler(route: string, body?: unknown) {
    if (route === 'POST:/projects/p-1/delivery/releases') return { id: 'ro-1' };
    if (route.includes('/builds?take=10')) {
      const items = listFetches.shift() ?? [];
      return { items };
    }
    if (route.endsWith('/builds')) {
      void body;
      return buildItem('b-new', 'queued', null);
    }
    if (route.includes('/staging-deployments')) return { id: 'd-1' };
    throw new Error(`unexpected route ${route}`);
  }

  async function mountAndSubmit() {
    mocks.apiRequest.mockImplementation(
      async (route: string, body?: unknown) => routeHandler(route, body) as unknown,
    );
    let pending!: Promise<string | null>;
    await act(async () => {
      root.render(<Probe />);
    });
    await act(async () => {
      pending = latest.submit(INPUT);
      await vi.advanceTimersByTimeAsync(0);
    });
    // 两次轮询间隔 5s；各推进一轮让链式轮询走完（含失败路径的收尾读取）。
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
    }
    await act(async () => {
      await pending;
    });
  }

  function Probe() {
    latest = usePublishSubmit('p-1');
    return null;
  }
});
