// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderStep } from '../types/release-order.types';
import {
  detailHook as makeDetailHook,
  type DetailHook,
  type HeaderProps,
  type StepperProps,
} from './release-order-detail-panel.spec-fixtures';
import { ReleaseOrderDetailPanel } from './release-order-detail-panel';
import { releaseGateCatalogFixture } from './release-gate-catalog.spec-fixtures';
const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  load: vi.fn(),
  buildLatest: vi.fn(),
  builds: {} as { building: boolean; buildLatest: ReturnType<typeof vi.fn> },
  detailHook: {} as DetailHook,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => mocks.searchParams,
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'zh',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({ LoadingState: () => <div>loading</div> }));
vi.mock('@/components/ui', () => ({
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
}));
vi.mock('../hooks/use-release-order-detail', () => ({
  useReleaseOrderDetail: () => mocks.detailHook,
}));
vi.mock('../hooks/use-release-order-evidence', () => ({
  useReleaseOrderEvidence: () => ({
    evidence: null,
    loading: false,
    error: '',
    load: mocks.load,
  }),
}));
vi.mock('../hooks/use-release-builds', () => ({
  useReleaseBuilds: () => mocks.builds,
}));
vi.mock('../hooks/use-release-gate-catalog', () => ({
  useReleaseGateCatalog: () => ({
    catalog: releaseGateCatalogFixture(),
    loading: false,
    error: '',
    load: vi.fn(),
  }),
}));
vi.mock('./release-order-detail-header', () => ({
  ReleaseOrderDetailHeader: ({ detail, onBuildLatest }: HeaderProps) => (
    <header>
      <button
        data-build-latest
        disabled={detail.counts.releaseRuns > 0}
        onClick={onBuildLatest}
      >
        build
      </button>
    </header>
  ),
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
    mocks.buildLatest.mockReset().mockResolvedValue(null);
    mocks.builds = { building: false, buildLatest: mocks.buildLatest };
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
  it('selects canonical Build and invokes the shared controller from the header', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&step=preflight');
    mocks.detailHook = detailHook('preflight', 'order-1', 0);
    await render(root);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-build-latest]')?.click(),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1?releaseOrderId=order-1&step=build',
      { scroll: false },
    );
    expect(mocks.buildLatest).toHaveBeenCalledOnce();
  });
  it('dispatches no build when the owned detail has a frozen Production artifact', async () => {
    mocks.detailHook = detailHook('production');
    await render(root);
    const action = container.querySelector<HTMLButtonElement>('[data-build-latest]')!;
    expect(action.disabled).toBe(true);
    await act(async () => action.click());
    expect(mocks.buildLatest).not.toHaveBeenCalled();
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
function detailHook(resumeStep: ReleaseOrderStep, releaseOrderId = 'order-1', releaseRuns = 1) {
  return makeDetailHook(resumeStep, mocks.load, releaseOrderId, releaseRuns);
}
