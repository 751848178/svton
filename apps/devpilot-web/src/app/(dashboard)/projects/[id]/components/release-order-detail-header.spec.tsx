// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseOrderDetailHeader } from './release-order-detail-header';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));
vi.mock('@phosphor-icons/react', () => ({ Hammer: () => <span data-hammer /> }));
vi.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
    title,
    'aria-describedby': describedBy,
  }: ButtonProps) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      aria-describedby={describedBy}
      data-loading={loading || undefined}
    >
      {children}
    </button>
  ),
  StatusTag: ({ label }: { label: string }) => <span data-status>{label}</span>,
}));

describe('ReleaseOrderDetailHeader', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('shows release facts and owns the enabled Build latest primary action', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onBack = vi.fn();
    const onBuildLatest = vi.fn();
    await act(async () =>
      root.render(
        <ReleaseOrderDetailHeader
          detail={detail}
          building={false}
          onBack={onBack}
          onBuildLatest={onBuildLatest}
        />,
      ),
    );

    expect(container.textContent).toContain('releaseOrderDetailHeading:2.4.0');
    expect(container.textContent).toContain('releaseOrderIdentityMeta:order-1');
    expect(container.textContent).toContain('releaseOrderVersionMeta:2.4.0');
    expect(container.textContent).toContain('releaseOrderBranchMeta:main');
    expect(container.textContent).toContain('releaseOrderLatestStepMeta:releaseStepBuildTitle');
    const buttons = container.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]?.textContent).toBe('backToReleaseOrders');
    expect(buttons[1]?.textContent).toContain('buildLatestCode');
    expect(buttons[1]?.disabled).toBe(false);
    await act(async () => buttons[0]?.click());
    await act(async () => buttons[1]?.click());
    expect(onBack).toHaveBeenCalledOnce();
    expect(onBuildLatest).toHaveBeenCalledOnce();
    await act(async () =>
      root.render(
        <ReleaseOrderDetailHeader
          detail={detail}
          building
          onBack={onBack}
          onBuildLatest={onBuildLatest}
        />,
      ),
    );
    expect(Array.from(container.querySelectorAll('button')).at(-1)?.disabled).toBe(true);
    await act(async () => root.unmount());
  });

  it('keeps the action visible but blocks it after Production freezes an artifact', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const onBuildLatest = vi.fn();
    await act(async () =>
      root.render(
        <ReleaseOrderDetailHeader
          detail={{ ...detail, counts: { ...detail.counts, releaseRuns: 1 } }}
          building={false}
          onBack={vi.fn()}
          onBuildLatest={onBuildLatest}
        />,
      ),
    );

    expect(container.textContent).toContain('releaseProductionArtifactFrozen');
    const action = Array.from(container.querySelectorAll('button')).at(-1)!;
    expect(action.disabled).toBe(true);
    expect(action.title).toBe('releaseBuildFrozenReason');
    const reasonId = action.getAttribute('aria-describedby')!;
    const reason = Array.from(container.querySelectorAll('[id]')).find(
      (element) => element.id === reasonId,
    );
    expect(reason?.textContent).toBe('releaseBuildFrozenReason');
    await act(async () => action.click());
    expect(onBuildLatest).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  title?: string;
  'aria-describedby'?: string;
}

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
