import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDeliveryContent } from './project-delivery-content';

const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('@svton/ui', () => ({
  Tabs: ({
    items,
    activeKey,
  }: {
    items: Array<{ key: string; label: string; children: ReactNode }>;
    activeKey: string;
  }) => (
    <nav>
      {items.map((item) => (
        <span key={item.key}>{item.label}</span>
      ))}
      <section>{items.find((item) => item.key === activeKey)?.children}</section>
    </nav>
  ),
}));
vi.mock('./release-orders-panel', () => ({ ReleaseOrdersPanel: () => <div>orders-panel</div> }));
vi.mock('./environment-versions-panel', () => ({
  EnvironmentVersionsPanel: () => <div>environment-panel</div>,
}));

describe('ProjectDeliveryContent', () => {
  const orders = {} as Parameters<typeof ProjectDeliveryContent>[0]['orders'];

  beforeEach(() => {
    mocks.searchParams = new URLSearchParams();
  });

  it('renders only the active Release Orders child by default', () => {
    const html = renderToStaticMarkup(
      <ProjectDeliveryContent
        projectId="project-1"
        orders={orders}
      />,
    );
    expect(html).toContain('tabReleaseOrders');
    expect(html).toContain('tabEnvironmentVersions');
    expect(html).toContain('orders-panel');
    expect(html).not.toContain('environment-panel');
    expect(html).not.toContain('releasePolicy');
    expect(html).not.toContain('deployments');
  });

  it('renders only the active Environment Versions child', () => {
    mocks.searchParams = new URLSearchParams('view=environment-versions');
    const html = renderToStaticMarkup(
      <ProjectDeliveryContent
        projectId="project-1"
        orders={orders}
      />,
    );

    expect(html).toContain('environment-panel');
    expect(html).not.toContain('orders-panel');
  });
});
