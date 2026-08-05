// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildsController } from '../hooks/use-release-builds';
import { scopedRequestIdentity } from '../hooks/use-scoped-request-guard';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { ReleaseOrderBuildStep } from './release-order-build-step';
const mocks = vi.hoisted(() => ({
  hook: {} as HookResult,
  detail: null as null | {
    run: ReleaseBuildItem | null;
    loaded: boolean;
    error: string;
    notFound: boolean;
    retry: ReturnType<typeof vi.fn>;
  },
}));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  ErrorBanner: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));
vi.mock('./release-build-log-drawer', () => ({
  ReleaseBuildLogDrawer: ({
    run,
    requestedBuildRunId,
    error,
  }: {
    run: ReleaseBuildItem | null;
    requestedBuildRunId?: string;
    error?: string;
  }) => (
    <div
      data-focused-run={run?.id || ''}
      data-requested-run={requestedBuildRunId || ''}
      data-detail-error={error || ''}
    />
  ),
}));
vi.mock('../hooks/use-release-build-detail', () => ({
  useReleaseBuildDetail: (
    _projectId: string,
    _releaseOrderId: string,
    _buildRunId: string | undefined,
    summary: ReleaseBuildItem | null,
  ) =>
    mocks.detail || {
      run: summary,
      loaded: true,
      error: '',
      notFound: !summary,
      retry: vi.fn(),
    },
}));
describe('ReleaseOrderBuildStep focused build normalization', () => {
  let root: Root;
  let container: HTMLDivElement;
  let onCloseLog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
    onCloseLog = vi.fn();
    mocks.detail = null;
    mocks.hook = hook({ loading: true, loadedSuccessfully: false });
  });
  afterEach(async () => act(async () => root.unmount()));

  it.each([
    ['loading', { loading: true, loadedSuccessfully: false, error: '' }],
    ['error', { loading: false, loadedSuccessfully: false, error: 'failed' }],
  ])('retains a foreign focus while the scoped list is %s', async (_name, state) => {
    mocks.hook = hook(state);
    await render(root, onCloseLog);
    expect(onCloseLog).not.toHaveBeenCalled();
  });
  it('shows an initial load error without also claiming the history is empty', async () => {
    mocks.hook = hook({ loading: false, loadedSuccessfully: false, error: 'failed' });
    await render(root, onCloseLog);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('failed');
    expect(container.textContent).not.toContain('releaseBuildEmpty');
  });
  it('keeps a deep link on a retryable exact-detail error', async () => {
    mocks.hook = hook({ loading: false, loadedSuccessfully: true, items: [] });
    mocks.detail = {
      run: null,
      loaded: true,
      error: 'network offline',
      notFound: false,
      retry: vi.fn(),
    };
    await render(root, onCloseLog);
    expect(onCloseLog).not.toHaveBeenCalled();
    expect(container.querySelector('[data-requested-run="build-1"]')).not.toBeNull();
    expect(container.querySelector('[data-detail-error="network offline"]')).not.toBeNull();
  });
  it('removes a foreign focus only after a successful scoped list load', async () => {
    mocks.hook = hook({ loading: false, loadedSuccessfully: true, items: [] });
    await render(root, onCloseLog);
    expect(onCloseLog).toHaveBeenCalledOnce();
  });
  it('keeps and opens an owned build focus after successful load', async () => {
    mocks.hook = hook({ loading: false, loadedSuccessfully: true, items: [build] });
    await render(root, onCloseLog);
    expect(onCloseLog).not.toHaveBeenCalled();
    expect(container.querySelector('[data-focused-run="build-1"]')).not.toBeNull();
    expect(container.textContent).not.toContain('buildLatestCode');
  });

  it('hides order A focus and cleans only after order B succeeds', async () => {
    const scopeA = scopedRequestIdentity('project-1', 'order-a');
    const scopeB = scopedRequestIdentity('project-1', 'order-b');
    mocks.hook = hook({
      scope: scopeA,
      successfulScope: scopeA,
      loadedSuccessfully: true,
      items: [{ ...build, releaseOrderId: 'order-a' }],
    });
    await render(root, onCloseLog, 'order-b');
    expect(container.querySelector('[data-focused-run="build-1"]')).toBeNull();
    expect(onCloseLog).not.toHaveBeenCalled();

    mocks.hook = hook({ scope: scopeB, error: 'B failed' });
    await render(root, onCloseLog, 'order-b');
    expect(onCloseLog).not.toHaveBeenCalled();

    mocks.hook = hook({ scope: scopeB, successfulScope: scopeB, loadedSuccessfully: true });
    await render(root, onCloseLog, 'order-b');
    expect(onCloseLog).toHaveBeenCalledOnce();
  });
});

async function render(root: Root, onCloseLog: () => void, releaseOrderId = 'order-1') {
  await act(async () => {
    root.render(
      <ReleaseOrderBuildStep
        projectId="project-1"
        releaseOrderId={releaseOrderId}
        builds={mocks.hook as ReleaseBuildsController}
        focusedBuildRunId="build-1"
        onOpenLog={vi.fn()}
        onCloseLog={onCloseLog}
      />,
    );
  });
}

interface HookResult {
  scope: string | null;
  successfulScope: string | null;
  items: ReleaseBuildItem[];
  total: number;
  loading: boolean;
  loadedSuccessfully: boolean;
  building: boolean;
  error: string;
  load: ReturnType<typeof vi.fn>;
  buildLatest: ReturnType<typeof vi.fn>;
}

function hook(overrides: Partial<HookResult>): HookResult {
  const scope = scopedRequestIdentity('project-1', 'order-1');
  const loadedSuccessfully = overrides.loadedSuccessfully || false;
  return {
    scope,
    successfulScope: loadedSuccessfully ? scope : null,
    items: [],
    total: 0,
    loading: false,
    loadedSuccessfully,
    building: false,
    error: '',
    load: vi.fn(),
    buildLatest: vi.fn(),
    ...overrides,
  };
}

const build: ReleaseBuildItem = {
  id: 'build-1',
  releaseOrderId: 'order-1',
  revision: 1,
  sourceBranch: 'main',
  sourceCommitSha: 'a'.repeat(40),
  status: 'succeeded',
  errorCode: null,
  startedAt: null,
  finishedAt: null,
  createdAt: '2026-08-05T00:00:00.000Z',
  manifest: null,
} as ReleaseBuildItem;
