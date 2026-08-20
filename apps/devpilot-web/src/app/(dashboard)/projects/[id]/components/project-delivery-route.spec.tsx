// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDeliveryRoute } from './project-delivery-route';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  orders: { marker: 'shared-orders-owner' },
  modalOrders: [] as unknown[],
  useProjectDeliverySummary: vi.fn(),
  useReleaseOrders: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  EmptyState: () => <div>empty</div>,
  LoadingState: () => <div>loading</div>,
  Tabs: ({
    items,
    activeKey,
  }: {
    items: Array<{ key: string; children: ReactNode }>;
    activeKey: string;
  }) => <div>{items.find((item) => item.key === activeKey)?.children}</div>,
}));
vi.mock('@/components/ui', () => ({
  ErrorBanner: () => <div>error</div>,
  PageHeader: () => <div>header</div>,
}));
vi.mock('../hooks/use-project-delivery-summary', () => ({
  useProjectDeliverySummary: mocks.useProjectDeliverySummary,
}));
vi.mock('../hooks/use-release-orders', () => ({
  useReleaseOrders: mocks.useReleaseOrders,
}));
vi.mock('./project-delivery-header', () => ({
  ProjectDeliveryHeader: () => <div>project-header</div>,
}));
vi.mock('./project-delivery-summary', () => ({
  ProjectDeliveryEnvironmentStrip: () => <div>versions</div>,
  ProjectDeliveryWeakSummary: ({ onOpenRelease }: { onOpenRelease?: () => void }) => (
    <div>
      summary
      {onOpenRelease ? <button onClick={onOpenRelease}>create-release-order</button> : null}
    </div>
  ),
}));
vi.mock('./release-orders-panel', () => ({
  ReleaseOrdersPanel: () => <div>release-orders-active-child</div>,
}));
vi.mock('./environment-versions-panel', () => ({
  EnvironmentVersionsPanel: () => <div>environment-versions-active-child</div>,
}));
vi.mock('./release-order-create-modal', () => ({
  ReleaseOrderCreateModal: ({ open, orders }: { open: boolean; orders: unknown }) => {
    mocks.modalOrders.push(orders);
    return open ? (
      <div role="dialog">
        <input aria-label="release-version" />
        <textarea aria-label="optional-note" />
      </div>
    ) : null;
  },
}));

describe('ProjectDeliveryRoute create action owner', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.modalOrders = [];
    mocks.useProjectDeliverySummary.mockReturnValue({
      summary: {
        project: { id: 'project-1', name: 'Project 1' },
        nextAction: { kind: 'open_release', href: '/projects/project-1?section=delivery' },
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    mocks.useReleaseOrders.mockReturnValue(mocks.orders);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it.each([
    ['releases', 'release-orders-active-child', 'environment-versions-active-child'],
    ['environment-versions', 'environment-versions-active-child', 'release-orders-active-child'],
  ])('opens the same modal from the %s active child', async (view, active, inactive) => {
    mocks.searchParams = new URLSearchParams(`view=${view}`);
    await act(async () => {
      root.render(
        <ProjectDeliveryRoute
          projectId="project-1"
          initialSummary={undefined}
        />,
      );
    });

    expect(container.textContent).toContain(active);
    expect(container.textContent).not.toContain(inactive);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('button')).filter(
        (button) => button.textContent === 'create-release-order',
      ),
    ).toHaveLength(1);
    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="release-version"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="optional-note"]')).not.toBeNull();
    expect(container.textContent).not.toContain(inactive);
    expect(mocks.modalOrders.every((orders) => orders === mocks.orders)).toBe(true);
  });

  it('does not request release orders before the scoped summary exists', async () => {
    mocks.useProjectDeliverySummary.mockReturnValue({
      summary: null,
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    await act(async () => {
      root.render(<ProjectDeliveryRoute projectId="project-1" />);
    });

    expect(mocks.useReleaseOrders).toHaveBeenCalledWith('');
  });

  it('does not expose a competing create action while the server owns another checkpoint', async () => {
    mocks.useProjectDeliverySummary.mockReturnValue({
      summary: {
        project: { id: 'project-1', name: 'Project 1' },
        nextAction: {
          kind: 'bind_target',
          href: '/projects/project-1/settings?section=environments&env=staging&envTab=targets',
        },
      },
      loading: false,
      error: null,
      refresh: vi.fn(),
    });
    await act(async () => {
      root.render(<ProjectDeliveryRoute projectId="project-1" />);
    });

    expect(container.textContent).not.toContain('create-release-order');
  });

  it('removes project-level summary chrome while a release workbench is focused', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&step=preflight');
    await act(async () => {
      root.render(<ProjectDeliveryRoute projectId="project-1" />);
    });

    expect(container.textContent).toContain('release-orders-active-child');
    expect(container.textContent).not.toContain('project-header');
    expect(container.textContent).not.toContain('summary');
    expect(container.textContent).not.toContain('versions');
  });
});
