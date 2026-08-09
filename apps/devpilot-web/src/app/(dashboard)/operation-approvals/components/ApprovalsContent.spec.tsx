import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalsContent } from './ApprovalsContent';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('../hooks/use-approvals', () => ({
  useApprovals: () => ({
    approvals: [],
    status: 'pending',
    setStatus: vi.fn(),
    loading: false,
    actingId: '',
    error: '',
    stats: { total: 5, pending: 2, approved: 1, rejected: 1, highRisk: 1 },
    review: vi.fn(),
    execute: vi.fn(),
    reload: vi.fn(),
  }),
}));
vi.mock('@/components/ui', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  ErrorBanner: () => null,
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Select: () => <select aria-label="status" />,
  MetricCard: ({ label, value }: { label: string; value: number }) => (
    <div data-metric={label}>{value}</div>
  ),
}));
vi.mock('@svton/ui', () => ({
  LoadingState: () => null,
  EmptyState: () => <div>empty</div>,
}));
vi.mock('./approval-card', () => ({ ApprovalCard: () => null }));

describe('ApprovalsContent responsive metrics', () => {
  it('uses two narrow columns and restores five columns on desktop', () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const html = renderToStaticMarkup(<ApprovalsContent />);

    expect(html).toContain('grid-cols-2');
    expect(html).toContain('sm:grid-cols-3');
    expect(html).toContain('md:grid-cols-5');
    expect(html.match(/data-metric=/g)).toHaveLength(5);
  });
});
