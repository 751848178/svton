// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseOrdersPanel } from './release-orders-panel';

const mocks = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams('view=releases'),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({ LoadingState: () => null }));
vi.mock('@/components/ui', () => ({ EmptyState: () => null, ErrorBanner: () => null }));
vi.mock('./release-order-list-toolbar', () => ({ ReleaseOrderListToolbar: () => null }));
vi.mock('./release-order-detail-panel', () => ({ ReleaseOrderDetailPanel: () => null }));
vi.mock('./release-order-list-row', () => ({
  ReleaseOrderListRow: (props: { onOpenDeployment: () => void }) => (
    <tr>
      <td>
        <button onClick={props.onOpenDeployment}>deployment</button>
      </td>
    </tr>
  ),
}));

describe('ReleaseOrdersPanel deployment navigation', () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    mocks.replace.mockReset();
    container = document.createElement('div');
    root = createRoot(container);
  });
  afterEach(async () => act(async () => root.unmount()));

  it('opens the deployment record view instead of release detail', async () => {
    await act(async () =>
      root.render(
        <ReleaseOrdersPanel
          projectId="project-1"
          orders={orders()}
        />,
      ),
    );
    const button = container.querySelector('button')!;
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    // IA 重构：部署记录跟随发布单 → /releases 路径 + Drawer 深链（含 order 上下文）。
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1/releases?deploymentRunId=deploy-1&releaseOrderId=order-1',
    );
  });
});

function orders() {
  return {
    query: '',
    status: '',
    total: 1,
    error: '',
    loading: false,
    items: [{ id: 'order-1', deployment: { latest: { id: 'deploy-1' } } }],
    setQuery: vi.fn(),
    setStatus: vi.fn(),
    load: vi.fn(),
  } as never;
}
