// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderDetail } from '../types/release-order.types';
import { ReleaseOrderDetailPanel } from './release-order-detail-panel';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  load: vi.fn(),
  detailHook: {} as {
    detail: ReleaseOrderDetail | null;
    loading: boolean;
    error: string;
    load: () => Promise<unknown>;
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  LoadingState: () => <div>loading</div>,
  Tabs: ({
    activeKey,
    items,
    onChange,
  }: {
    activeKey: string;
    items: Array<{ key: string; children: ReactNode }>;
    onChange: (key: string) => void;
  }) => (
    <div data-active-step={activeKey}>
      {items.map((item) => (
        <button
          key={item.key}
          data-step={item.key}
          onClick={() => onChange(item.key)}
        >
          {item.key}
        </button>
      ))}
      {items.find((item) => item.key === activeKey)?.children}
    </div>
  ),
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  ErrorBanner: () => <div>error</div>,
  StatusTag: () => <div>status</div>,
}));
vi.mock('../hooks/use-release-order-detail', () => ({
  useReleaseOrderDetail: () => mocks.detailHook,
}));
vi.mock('./release-order-build-step', () => ({ ReleaseOrderBuildStep: () => <div>build</div> }));
vi.mock('./release-order-preflight-step', () => ({
  ReleaseOrderPreflightStep: () => <div>preflight</div>,
}));
vi.mock('./release-order-staging-step', () => ({
  ReleaseOrderStagingStep: () => <div>staging</div>,
}));
vi.mock('./release-order-production-step', () => ({
  ReleaseOrderProductionStep: () => <div>production</div>,
}));

describe('ReleaseOrderDetailPanel resume route', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.searchParams = new URLSearchParams();
    mocks.replace.mockReset();
    mocks.load.mockReset();
    mocks.load.mockResolvedValue(undefined);
    mocks.detailHook = { detail: null, loading: true, error: '', load: mocks.load };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('waits for detail before canonicalizing a missing route to server resume', async () => {
    mocks.searchParams = new URLSearchParams('buildRunId=foreign-build');
    await render(root);
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.detailHook = detailHook('staging');
    await render(root);
    expect(mocks.replace).toHaveBeenCalledOnce();
    expect(mocks.replace.mock.calls[0]?.[0]).toBe(
      '/projects/project-1?releaseOrderId=order-1&step=staging',
    );
    expect(container.querySelector('[data-active-step="staging"]')).not.toBeNull();
  });

  it('normalizes invalid routes but preserves a valid viewed step across refetch', async () => {
    mocks.searchParams = new URLSearchParams('step=unknown&buildRunId=foreign-build');
    mocks.detailHook = detailHook('production');
    await render(root);
    expect(mocks.replace.mock.calls[0]?.[0]).toBe(
      '/projects/project-1?step=production&releaseOrderId=order-1',
    );

    mocks.replace.mockReset();
    mocks.searchParams = new URLSearchParams('step=build&step=production');
    mocks.detailHook = detailHook('build');
    await render(root);
    expect(mocks.replace.mock.calls[0]?.[0]).toBe(
      '/projects/project-1?step=build&releaseOrderId=order-1',
    );

    mocks.replace.mockReset();
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&step=build');
    mocks.detailHook = detailHook('production');
    await render(root);
    mocks.detailHook = detailHook('staging');
    await render(root);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-active-step="build"]')).not.toBeNull();
  });

  it('changes only the viewed URL when another valid step is selected', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&step=production');
    mocks.detailHook = detailHook('production');
    await render(root);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-step="preflight"]')?.click();
    });
    expect(mocks.replace.mock.calls.at(-1)?.[0]).toBe(
      '/projects/project-1?releaseOrderId=order-1&step=preflight',
    );
    expect(mocks.load).not.toHaveBeenCalled();
    expect(mocks.detailHook.detail?.resumeStep).toBe('production');
  });
});

async function render(root: Root) {
  await act(async () => {
    root.render(
      <ReleaseOrderDetailPanel
        projectId="project-1"
        releaseOrderId="order-1"
        onOrdersChanged={vi.fn()}
      />,
    );
  });
}

function detailHook(resumeStep: ReleaseOrderDetail['resumeStep']): {
  detail: ReleaseOrderDetail;
  loading: boolean;
  error: string;
  load: typeof mocks.load;
} {
  return {
    detail: {
      id: 'order-1',
      projectId: 'project-1',
      releaseVersion: '2.4.1',
      note: null,
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
      counts: { buildRuns: 1, manifests: 1, releaseRuns: 1 },
      persistedStatus: 'active',
      lifecycle: {
        status: 'production',
        phase: 'production',
        sourceType: 'release_run',
        sourceId: 'release-1',
        sourceStatus: 'running',
        occurredAt: '2026-08-05T01:00:00.000Z',
      },
      resumeStep,
      preflight: {
        ready: true,
        repository: { ready: true, branch: 'main', identityRevisionId: 'r1', identityRevision: 1 },
        staging: { ready: true },
        production: { ready: true },
      },
    },
    loading: false,
    error: '',
    load: mocks.load,
  };
}
