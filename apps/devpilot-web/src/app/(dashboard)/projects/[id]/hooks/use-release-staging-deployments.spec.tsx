// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReleaseStagingDeploymentItem,
  ReleaseStagingDeploymentListResponse,
} from '../types/release-order.types';
import { useReleaseStagingDeployments } from './use-release-staging-deployments';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  onChanged: vi.fn(),
  actorId: 'actor-1',
  teamId: 'team-1',
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: { id: mocks.actorId } }),
  useTeamStore: () => ({ currentTeam: { id: mocks.teamId } }),
}));

describe('useReleaseStagingDeployments ownership', () => {
  let root: Root;
  let latest: ReturnType<typeof useReleaseStagingDeployments>;

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

  it('loads the complete candidate history without a take limit', async () => {
    mocks.apiRequest.mockResolvedValue(list(run('run-1', 'project-1', 'order-1')));
    await render('project-1', 'order-1');

    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'GET:/projects/project-1/delivery/releases/order-1/staging-deployments',
    );
    expect(latest.items.map((item) => item.id)).toEqual(['run-1']);
  });

  it('fails closed when the API returns a foreign project or release order', async () => {
    mocks.apiRequest.mockResolvedValue(list(run('foreign', 'project-2', 'order-1')));
    await render('project-1', 'order-1');

    expect(latest.items).toEqual([]);
    expect(latest.error).toBe('releaseStagingScopeMismatch');
  });

  it('keeps the current scope when an older request resolves late', async () => {
    const responseA = deferred<ReleaseStagingDeploymentListResponse>();
    const responseB = deferred<ReleaseStagingDeploymentListResponse>();
    mocks.apiRequest.mockImplementation((route: string) =>
      route.includes('/order-a/') ? responseA.promise : responseB.promise,
    );

    await render('project-1', 'order-a');
    await render('project-1', 'order-b');
    await act(async () => responseB.resolve(list(run('b', 'project-1', 'order-b'))));
    await act(async () => responseA.resolve(list(run('a', 'project-1', 'order-a'))));

    expect(latest.items.map((item) => item.id)).toEqual(['b']);
  });

  it('clears candidates when the authorized team changes', async () => {
    const responseA = deferred<ReleaseStagingDeploymentListResponse>();
    const responseB = deferred<ReleaseStagingDeploymentListResponse>();
    mocks.apiRequest.mockReturnValueOnce(responseA.promise).mockReturnValueOnce(responseB.promise);
    await render('project-1', 'order-1');

    mocks.teamId = 'team-2';
    await render('project-1', 'order-1');
    expect(latest.items).toEqual([]);
    await act(async () => responseB.resolve(list(run('b', 'project-1', 'order-1'))));
    await act(async () => responseA.resolve(list(run('a', 'project-1', 'order-1'))));
    expect(latest.items.map((item) => item.id)).toEqual(['b']);
  });

  it('posts once while deployment is in flight and preserves prior history', async () => {
    const response = deferred<ReleaseStagingDeploymentItem>();
    mocks.apiRequest.mockImplementation((_route: string, body?: unknown) =>
      body ? response.promise : Promise.resolve(list(run('old', 'project-1', 'order-1'))),
    );
    await render('project-1', 'order-1');

    let first!: Promise<ReleaseStagingDeploymentItem | null>;
    let duplicate!: Promise<ReleaseStagingDeploymentItem | null>;
    act(() => {
      first = latest.deploy('manifest-1');
      duplicate = latest.deploy('manifest-1');
    });
    expect(mocks.apiRequest.mock.calls.filter((call) => call[1])).toHaveLength(1);
    await expect(duplicate).resolves.toBeNull();

    await act(async () => response.resolve(run('new', 'project-1', 'order-1')));
    await expect(first).resolves.toMatchObject({ id: 'new' });
    expect(latest.items.map((item) => item.id)).toEqual(['new', 'old']);
    expect(mocks.onChanged).toHaveBeenCalledOnce();
  });

  async function render(projectId: string, releaseOrderId: string) {
    await act(async () =>
      root.render(
        <Probe
          projectId={projectId}
          releaseOrderId={releaseOrderId}
        />,
      ),
    );
  }

  function Probe({ projectId, releaseOrderId }: { projectId: string; releaseOrderId: string }) {
    latest = useReleaseStagingDeployments(projectId, releaseOrderId, mocks.onChanged);
    return null;
  }
});

function list(...items: ReleaseStagingDeploymentItem[]): ReleaseStagingDeploymentListResponse {
  return { items, total: items.length };
}

function run(id: string, projectId: string, releaseOrderId: string) {
  return { id, projectId, releaseOrderId, status: 'completed' } as ReleaseStagingDeploymentItem;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve;
  });
  return { promise, resolve };
}
