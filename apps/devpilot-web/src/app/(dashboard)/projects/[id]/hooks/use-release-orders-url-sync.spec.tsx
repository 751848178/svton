// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readReleaseOrderStatusParam,
  RELEASE_ORDER_QUERY_PARAM,
  RELEASE_ORDER_STATUS_PARAM,
  useReleaseOrders,
} from './use-release-orders';

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  apiRequest: vi.fn().mockResolvedValue({ items: [], total: 0 }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/projects/project-1',
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.params,
}));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: { id: 'actor-1' } }),
  useTeamStore: () => ({ currentTeam: { id: 'team-1' } }),
}));

describe('release order filters URL sync (REL-1)', () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: ReturnType<typeof useReleaseOrders>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.params = new URLSearchParams();
    mocks.replace.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('restores query and status filters from the URL on mount', async () => {
    mocks.params = new URLSearchParams('view=releases&relQuery=1.4&relStatus=failed');
    await render();

    expect(latest.query).toBe('1.4');
    expect(latest.status).toBe('failed');
  });

  it('ignores invalid status values instead of forwarding them to the endpoint', async () => {
    mocks.params = new URLSearchParams('view=releases&relStatus=stage-draft');
    await render();

    expect(latest.status).toBeNull();
  });

  it('writes filter changes into the URL while preserving other params', async () => {
    mocks.params = new URLSearchParams('view=releases&relStatus=draft');
    await render();

    await act(async () => {
      latest.setQuery('gallery');
    });
    await act(async () => {
      latest.setStatus('succeeded');
    });

    const replaced = String(mocks.replace.mock.calls.at(-1)?.[0]);
    const params = new URLSearchParams(replaced.split('?')[1] ?? '');
    expect(replaced.startsWith('/projects/project-1?')).toBe(true);
    expect(params.get('view')).toBe('releases');
    expect(params.get(RELEASE_ORDER_QUERY_PARAM)).toBe('gallery');
    expect(params.get(RELEASE_ORDER_STATUS_PARAM)).toBe('succeeded');
  });

  it('drops filter params from the URL when cleared', async () => {
    mocks.params = new URLSearchParams('view=releases&relQuery=old&relStatus=draft');
    await render();

    await act(async () => {
      latest.setQuery('   ');
      latest.setStatus(null);
    });
    const replaced = String(mocks.replace.mock.calls.at(-1)?.[0]);
    expect(replaced).toBe('/projects/project-1?view=releases');
  });

  it('validates the status whitelist for deep links', () => {
    expect(readReleaseOrderStatusParam('awaiting_approval')).toBe('awaiting_approval');
    expect(readReleaseOrderStatusParam('withdrawn')).toBe('withdrawn');
    expect(readReleaseOrderStatusParam('stageId')).toBeNull();
    expect(readReleaseOrderStatusParam(null)).toBeNull();
  });

  async function render() {
    await act(async () => {
      root.render(
        <Probe
          onHook={(value) => {
            latest = value;
          }}
        />,
      );
    });
  }

  function Probe({ onHook }: { onHook: (value: ReturnType<typeof useReleaseOrders>) => void }) {
    onHook(useReleaseOrders('project-1'));
    return null;
  }
});
