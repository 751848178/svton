// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDeliveryRoute } from './project-delivery-route';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  pathname: '/projects/project-1',
  replace: vi.fn(),
  summary: null as unknown,
  orders: { marker: 'orders' },
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'project-1' }),
  useSearchParams: () => mocks.searchParams,
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  EmptyState: () => <div>empty</div>,
  LoadingState: () => <div>loading</div>,
}));
vi.mock('@/components/ui', () => ({
  ErrorBanner: () => <div>error</div>,
  PageHeader: () => <div>header</div>,
}));
vi.mock('../hooks/use-project-delivery-summary', () => ({
  useProjectDeliverySummary: () => ({
    summary: mocks.summary,
    loading: false,
    error: null,
    refresh: vi.fn(),
  }),
}));
vi.mock('../hooks/use-release-orders', () => ({ useReleaseOrders: () => mocks.orders }));
vi.mock('./project-workbench-header', () => ({
  ProjectWorkbenchHeader: () => <div>workbench-header</div>,
}));
vi.mock('./project-context-issue', () => ({
  ProjectContextIssue: ({ message, actionLabel }: { message: string; actionLabel: string }) => (
    <div>
      {message} · {actionLabel}
    </div>
  ),
}));
vi.mock('./project-delivery-content', () => ({
  ProjectDeliveryContent: () => <div>release-orders</div>,
}));
vi.mock('./release-order-create-modal', () => ({
  ReleaseOrderCreateModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div role="dialog">
        <button type="button" onClick={onClose}>
          close-create
        </button>
      </div>
    ) : null,
}));

describe('ProjectDeliveryRoute workbench shell', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    root = createRoot(container);
    mocks.searchParams = new URLSearchParams('view=releases');
    mocks.summary = summary();
  });
  afterEach(async () => act(async () => root.unmount()));

  it('renders one release workbench without environment comparison cards', async () => {
    await act(async () => root.render(<ProjectDeliveryRoute projectId="project-1" />));
    expect(container.textContent).toContain('workbench-header');
    expect(container.textContent).toContain('release-orders');
    expect(container.textContent).toContain('projectDeliveryIssueMessage');
    expect(container.textContent).toContain('projectDeliveryActionBindTarget');
    expect(container.textContent).not.toContain('environment-versions-active-child');
  });

  it('opens the release modal from the canonical create query', async () => {
    mocks.searchParams = new URLSearchParams('view=releases&create=true');
    await act(async () => root.render(<ProjectDeliveryRoute projectId="project-1" />));
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
  });

  it('WIZ-2: closing the create modal strips the create query so the modal can reopen', async () => {
    mocks.searchParams = new URLSearchParams('view=releases&create=true');
    await act(async () => root.render(<ProjectDeliveryRoute projectId="project-1" />));
    const closeButton = container.querySelector<HTMLButtonElement>('[role="dialog"] button');
    expect(closeButton).not.toBeNull();
    await act(async () => closeButton!.click());
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith('/projects/project-1?view=releases', {
      scroll: false,
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

function summary() {
  return {
    project: { id: 'project-1', name: 'Project 1' },
    repository: { canonicalUrl: 'file:///repo', defaultBranch: 'master' },
    checkpoints: [
      {
        id: 'targets',
        scope: 'production',
        status: 'blocked',
        reasonCodes: ['TARGET_MISSING'],
        action: { kind: 'bind_target', href: '/settings' },
      },
    ],
    nextAction: { kind: 'bind_target', href: '/settings' },
  } as never;
}
