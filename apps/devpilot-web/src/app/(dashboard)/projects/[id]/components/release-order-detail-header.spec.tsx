// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseOrderDetailHeader } from './release-order-detail-header';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  StatusTag: ({ label }: { label: string }) => <span data-status>{label}</span>,
}));

describe('ReleaseOrderDetailHeader', () => {
  it('shows order, version, canonical branch and latest lifecycle phase without a primary action', async () => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    const container = document.createElement('div');
    const root = createRoot(container);
    const onBack = vi.fn();
    await act(async () =>
      root.render(
        <ReleaseOrderDetailHeader
          detail={detail}
          onBack={onBack}
        />,
      ),
    );

    expect(container.textContent).toContain('releaseOrderDetailHeading:2.4.0');
    expect(container.textContent).toContain('releaseOrderIdentityMeta:order-1');
    expect(container.textContent).toContain('releaseOrderVersionMeta:2.4.0');
    expect(container.textContent).toContain('releaseOrderBranchMeta:main');
    expect(container.textContent).toContain('releaseOrderLatestStepMeta:releaseStepBuildTitle');
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0]?.textContent).toBe('backToReleaseOrders');
    await act(async () => buttons[0]?.click());
    expect(onBack).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
  });
});

const detail: ReleaseOrderDetail = {
  id: 'order-1',
  projectId: 'project-1',
  releaseVersion: '2.4.0',
  note: 'Release note',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T01:00:00.000Z',
  counts: { buildRuns: 2, manifests: 1, releaseRuns: 0 },
  persistedStatus: 'active',
  lifecycle: {
    status: 'failed',
    phase: 'build',
    sourceType: 'build_run',
    sourceId: 'build-2',
    sourceStatus: 'failed',
    occurredAt: '2026-08-05T01:00:00.000Z',
    failureKind: 'failed',
  },
  resumeStep: 'production',
  preflight: {
    ready: true,
    repository: { ready: true, branch: 'main', identityRevisionId: 'r1', identityRevision: 1 },
    staging: { ready: true },
    production: { ready: true },
  },
};
