import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseOrdersHook } from '../hooks/use-release-orders';
import { ReleaseOrdersPanel } from './release-orders-panel';

const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('@svton/ui', () => ({
  EmptyState: ({ text }: { text: string }) => <div>{text}</div>,
  LoadingState: () => <div>loading</div>,
}));
vi.mock('@/components/ui', () => ({ ErrorBanner: () => <div>error</div> }));
vi.mock('./release-order-detail-panel', () => ({
  ReleaseOrderDetailPanel: () => <div>detail</div>,
}));
vi.mock('./release-order-list-toolbar', () => ({
  ReleaseOrderListToolbar: () => <div>toolbar</div>,
}));
vi.mock('./release-order-list-row', () => ({
  ReleaseOrderListRow: ({ item }: { item: { id: string } }) => <div>{item.id}</div>,
}));

describe('ReleaseOrdersPanel', () => {
  it('preserves the server-ranked row order without local sorting', () => {
    const html = renderToStaticMarkup(
      <ReleaseOrdersPanel
        projectId="project-1"
        orders={orders(['older-active', 'newer-draft'])}
      />,
    );
    expect(html.indexOf('older-active')).toBeLessThan(html.indexOf('newer-draft'));
  });

  it('distinguishes initial and server-filtered empty states', () => {
    expect(
      renderToStaticMarkup(
        <ReleaseOrdersPanel
          projectId="project-1"
          orders={orders([])}
        />,
      ),
    ).toContain('releaseOrdersEmpty');
    expect(
      renderToStaticMarkup(
        <ReleaseOrdersPanel
          projectId="project-1"
          orders={{ ...orders([]), query: 'missing' }}
        />,
      ),
    ).toContain('releaseOrdersFilteredEmpty');
  });
});

function orders(ids: string[]) {
  return {
    items: ids.map((id) => ({ id })),
    total: ids.length,
    query: '',
    status: null,
    setQuery: vi.fn(),
    setStatus: vi.fn(),
    loading: false,
    creating: false,
    error: '',
    load: vi.fn(),
    create: vi.fn(),
  } as unknown as ReleaseOrdersHook;
}
