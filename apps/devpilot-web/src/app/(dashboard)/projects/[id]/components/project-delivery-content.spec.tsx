import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectDeliveryContent } from './project-delivery-content';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@svton/ui', () => ({
  Tabs: ({ items }: { items: Array<{ key: string; label: string; children: ReactNode }> }) => (
    <nav>
      {items.map((item) => (
        <section key={item.key}>
          {item.label}
          {item.children}
        </section>
      ))}
    </nav>
  ),
}));
vi.mock('./release-orders-panel', () => ({ ReleaseOrdersPanel: () => <div>orders-panel</div> }));
vi.mock('./environment-versions-panel', () => ({
  EnvironmentVersionsPanel: () => <div>environment-panel</div>,
}));

describe('ProjectDeliveryContent', () => {
  it('exposes only the two high-frequency delivery tabs', () => {
    const html = renderToStaticMarkup(
      <ProjectDeliveryContent
        projectId="project-1"
        createOpen={false}
        onCreateOpenChange={vi.fn()}
      />,
    );
    expect(html).toContain('tabReleaseOrders');
    expect(html).toContain('tabEnvironmentVersions');
    expect(html).toContain('orders-panel');
    expect(html).toContain('environment-panel');
    expect(html).not.toContain('releasePolicy');
    expect(html).not.toContain('deployments');
  });
});
