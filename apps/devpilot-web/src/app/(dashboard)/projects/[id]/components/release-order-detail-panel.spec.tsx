// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseWorkbenchStep } from '../components/release-workbench/release-workbench-steps.model';
import {
  detailHook as makeDetailHook,
  type DetailHook,
  type WorkbenchProps,
} from './release-order-detail-panel.spec-fixtures';
import { ReleaseOrderDetailPanel } from './release-order-detail-panel';
import { releaseGateCatalogFixture } from './release-gate-catalog.spec-fixtures';
const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  replace: vi.fn(),
  load: vi.fn(),
  buildLatest: vi.fn(),
  builds: {} as { building: boolean; buildLatest: ReturnType<typeof vi.fn> },
  deployments: {} as Record<string, unknown>,
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
vi.mock('@svton/ui', () => ({
  LoadingState: () => <div>loading</div>,
  EmptyState: ({ text }: { text?: string }) => <div>{text}</div>,
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <aside>{children}</aside> : null,
}));
vi.mock('@/components/ui', () => ({
  ErrorBanner: ({ message }: { message: string }) => <div>{message}</div>,
  StatusTag: ({ label }: { label?: string }) => <span>{label}</span>,
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
vi.mock('../hooks/use-release-staging-deployments', () => ({
  useReleaseStagingDeployments: () => mocks.deployments,
}));
vi.mock('../hooks/use-release-gate-catalog', () => ({
  useReleaseGateCatalog: () => ({
    catalog: releaseGateCatalogFixture(),
    loading: false,
    error: '',
    load: vi.fn(),
  }),
}));
vi.mock('./release-workbench/release-order-detail-workbench', () => ({
  ReleaseOrderDetailWorkbench: ({
    navigation,
    onBuildLatest,
    detail,
  }: WorkbenchProps) => (
    <div data-release={navigation.release} data-step={navigation.step}>
      {(['preflight', 'build', 'staging'] as ReleaseWorkbenchStep[]).map((step) => (
        <button key={step} data-step={step} onClick={() => navigation.selectStep(step)}>
          {step}
        </button>
      ))}
      <button data-release-production onClick={() => navigation.selectRelease('production')}>
        production
      </button>
      <button
        data-build-latest
        disabled={detail.counts.releaseRuns > 0}
        onClick={onBuildLatest}
      >
        build
      </button>
    </div>
  ),
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
    mocks.deployments = {
      deploying: false,
      deploy: vi.fn().mockResolvedValue(null),
      items: [],
      total: 0,
      loading: false,
      loadedSuccessfully: true,
      error: '',
      load: vi.fn(),
    };
    mocks.detailHook = { scope: null, detail: null, loading: true, error: '', load: mocks.load };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('defaults to the staging chain node with a derived step and no URL rewrite', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1');
    mocks.detailHook = detailHook('staging');
    await render(root);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(container.querySelector('[data-release="staging"]')).not.toBeNull();
    expect(container.querySelector('[data-release="staging"]')?.getAttribute('data-step')).toBe(
      'staging',
    );
  });

  it('keeps a bare deployment focus deep link as a direct run-log drawer', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1&deploymentRunId=run-9');
    mocks.detailHook = detailHook('staging');
    await render(root);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('maps the legacy production step deep link onto the production chain node', async () => {
    mocks.searchParams = new URLSearchParams(
      'releaseOrderId=order-1&step=production&releaseRunId=rel-1',
    );
    mocks.detailHook = detailHook('production');
    await render(root);
    expect(mocks.replace.mock.calls[0]?.[0]).toBe(
      '/projects/project-1/releases?releaseOrderId=order-1&release=production&releaseRunId=rel-1',
    );
  });

  it('switches the inline step through the URL', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1');
    mocks.detailHook = detailHook('staging');
    await render(root);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-step="build"]')?.click(),
    );
    expect(mocks.replace.mock.calls.at(-1)?.[0]).toBe(
      '/projects/project-1/releases?releaseOrderId=order-1&step=build',
    );
  });

  it('switches to the production chain node through the URL', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1');
    mocks.detailHook = detailHook('staging');
    await render(root);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-release-production]')?.click(),
    );
    expect(mocks.replace.mock.calls.at(-1)?.[0]).toBe(
      '/projects/project-1/releases?releaseOrderId=order-1&release=production',
    );
  });

  it('selects the build step and invokes the shared build controller', async () => {
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-1');
    mocks.detailHook = detailHook('preflight', 'order-1', 0);
    await render(root);
    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-build-latest]')?.click(),
    );
    expect(mocks.replace).toHaveBeenCalledWith(
      '/projects/project-1/releases?releaseOrderId=order-1&step=build',
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
    mocks.searchParams = new URLSearchParams('releaseOrderId=order-a');
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
function detailHook(
  resumeStep: Parameters<typeof makeDetailHook>[0],
  releaseOrderId = 'order-1',
  releaseRuns = 1,
) {
  return makeDetailHook(resumeStep, mocks.load, releaseOrderId, releaseRuns);
}
