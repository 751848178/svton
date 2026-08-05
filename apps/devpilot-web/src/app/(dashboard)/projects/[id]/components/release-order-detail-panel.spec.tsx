// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseOrderDetail, ReleaseOrderStep } from '../types/release-order.types';
import { ReleaseOrderDetailPanel } from './release-order-detail-panel';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  load: vi.fn(),
  detailHook: {} as DetailHook,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({ LoadingState: () => <div>loading</div> }));
vi.mock('@/components/ui', () => ({
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('../hooks/use-release-order-detail', () => ({
  useReleaseOrderDetail: () => mocks.detailHook,
}));
vi.mock('./release-order-detail-header', () => ({
  ReleaseOrderDetailHeader: () => <header>header</header>,
}));
vi.mock('./release-order-stepper', () => ({
  ReleaseOrderStepper: ({ selectedStep, onSelect, children }: StepperProps) => (
    <div data-active-step={selectedStep}>
      {(['preflight', 'build', 'staging', 'production'] as ReleaseOrderStep[]).map((step) => (
        <button
          key={step}
          data-step={step}
          onClick={() => onSelect(step)}
        >
          {step}
        </button>
      ))}
      {children}
    </div>
  ),
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

describe('ReleaseOrderDetailPanel route contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.searchParams = new URLSearchParams();
    mocks.replace.mockReset();
    mocks.load.mockReset().mockResolvedValue(undefined);
    mocks.detailHook = { scope: null, detail: null, loading: true, error: '', load: mocks.load };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('waits for detail before canonicalizing and strips an incompatible focus', async () => {
    mocks.searchParams = new URLSearchParams('buildRunId=foreign-build');
    await render(root);
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.detailHook = detailHook('staging');
    await render(root);
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1?releaseOrderId=order-1&step=staging',
      { scroll: false },
    );
  });
  it('retains Build focus until the scoped Build list can prove ownership', async () => {
    mocks.searchParams = new URLSearchParams('buildRunId=foreign-build');
    mocks.detailHook = detailHook('build');
    await render(root);
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1?buildRunId=foreign-build&releaseOrderId=order-1&step=build',
      { scroll: false },
    );
  });
  it('normalizes invalid and duplicate steps but preserves a unique valid viewed step', async () => {
    mocks.searchParams = new URLSearchParams('step=unknown&step=build');
    mocks.detailHook = detailHook('production');
    await render(root);
    expect(mocks.replace.mock.calls[0]?.[0]).toBe(
      '/projects/project-1?step=production&releaseOrderId=order-1',
    );
    mocks.replace.mockReset();
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&step=build');
    mocks.detailHook = detailHook('staging');
    await render(root);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-active-step="build"]')).not.toBeNull();
  });
  it('changes only the singular viewed URL', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&step=production');
    mocks.detailHook = detailHook('production');
    await render(root);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-step="build"]')?.click(),
    );
    expect(mocks.replace.mock.calls.at(-1)?.[0]).toBe(
      '/projects/project-1?releaseOrderId=order-1&step=build',
    );
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it('does not canonicalize order B from retained order A detail', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-a&step=production');
    mocks.detailHook = detailHook('production', 'order-a');
    await render(root, 'order-a');
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.searchParams = new URLSearchParams('releaseOrderId=order-b');
    await render(root, 'order-b');
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector('header')).toBeNull();
    expect(container.textContent).toBe('releaseOrderDetailUnavailable');
  });
});
async function render(root: Root, releaseOrderId = 'order-1') {
  await act(async () =>
    root.render(
      <ReleaseOrderDetailPanel
        projectId="project-1"
        releaseOrderId={releaseOrderId}
        onOrdersChanged={vi.fn()}
      />,
    ),
  );
}
function detailHook(resumeStep: ReleaseOrderStep, releaseOrderId = 'order-1'): DetailHook {
  return {
    scope: scopedRequestIdentity('project-1', releaseOrderId),
    detail: detail(resumeStep, releaseOrderId),
    loading: false,
    error: '',
    load: mocks.load,
  };
}

function detail(resumeStep: ReleaseOrderStep, releaseOrderId = 'order-1'): ReleaseOrderDetail {
  return {
    id: releaseOrderId,
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: null,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T01:00:00.000Z',
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
  };
}
interface DetailHook {
  scope: string | null;
  detail: ReleaseOrderDetail | null;
  loading: boolean;
  error: string;
  load: () => Promise<unknown>;
}
interface StepperProps {
  selectedStep: ReleaseOrderStep;
  onSelect: (step: ReleaseOrderStep) => void;
  children: ReactNode;
}
