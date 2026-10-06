// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseOrdersPanel } from './release-orders-panel';

const mocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({ LoadingState: () => null }));
vi.mock('@/components/ui', () => ({ EmptyState: () => null, ErrorBanner: () => null }));
vi.mock('./release-order-list-toolbar', () => ({ ReleaseOrderListToolbar: () => null }));
vi.mock('./release-order-detail-panel', () => ({ ReleaseOrderDetailPanel: () => null }));
vi.mock('./release-orders-run-drawers', () => ({
  ReleaseOrdersBuildRunDrawer: (props: { focus: { buildRunId: string } }) => (
    <div data-testid="build-drawer">{props.focus.buildRunId}</div>
  ),
  ReleaseOrdersDeploymentRunDrawer: (props: { focus: { deploymentRunId: string } }) => (
    <div data-testid="deployment-drawer">{props.focus.deploymentRunId}</div>
  ),
}));
vi.mock('./release-order-list-row', () => ({
  ReleaseOrderListRow: (props: { onOpen: () => void }) => (
    <tr>
      <td>
        <button onClick={props.onOpen}>detail</button>
      </td>
    </tr>
  ),
}));

describe('ReleaseOrdersPanel row actions', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.push.mockReset();
    mocks.replace.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('does not expose build, deployment, or evidence drawer shortcuts', async () => {
    await act(async () =>
      root.render(
        <ReleaseOrdersPanel
          projectId="project-1"
          orders={orders()}
        />,
      ),
    );
    expect(
      Array.from(container.querySelectorAll('button')).map((node) => node.textContent),
    ).toEqual(['detail']);
    expect(container.querySelector('[data-testid="deployment-drawer"]')).toBeNull();
    expect(container.querySelector('[data-testid="build-drawer"]')).toBeNull();
  });

  it('still navigates to the release order detail for 查看发布单', async () => {
    await act(async () =>
      root.render(
        <ReleaseOrdersPanel
          projectId="project-1"
          orders={orders()}
        />,
      ),
    );
    const detail = Array.from(container.querySelectorAll('button')).find(
      (node) => node.textContent === 'detail',
    )!;
    await act(async () => detail.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(mocks.push).toHaveBeenCalledWith('/projects/project-1/releases/order-1');
  });
});

function orders() {
  return {
    query: '',
    status: '',
    total: 1,
    error: '',
    loading: false,
    items: [
      {
        id: 'order-1',
        source: { buildRunId: 'build-3' },
        build: { recentSuccessfulManifest: { buildRunId: 'build-2' } },
        deployment: { latest: { id: 'deploy-1' } },
      },
    ],
    setQuery: vi.fn(),
    setStatus: vi.fn(),
    load: vi.fn(),
  } as never;
}
