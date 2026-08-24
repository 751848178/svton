// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { ReleaseStagingLogDrawer } from './release-staging-log-drawer';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Drawer: ({ open, children, title }: React.PropsWithChildren<{ open: boolean; title: string }>) =>
    open ? <section aria-label={title}>{children}</section> : null,
  LoadingState: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  ErrorBanner: ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
    <div role="alert">
      {message}
      <button onClick={onRetry}>retry</button>
    </div>
  ),
  LinkButton: ({ href, children }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe('ReleaseStagingLogDrawer', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('shows isolated logs, structured technical evidence, and separate business status', async () => {
    await render(stagingRun(), build());
    expect(container.textContent).toContain('releaseStagingDeploymentRunIdrun-1');
    expect(container.textContent).toContain('workload exact Manifest started');
    expect(container.textContent).toContain('releaseStagingVerificationPassed');
    expect(container.textContent).toContain('releaseStagingBusinessPending');
    expect(container.textContent).toContain('releaseStagingBusinessResultDetail');
    expect(container.querySelector('[role="log"]')?.textContent).toContain('health passed');
    expect(container.querySelector('a')?.getAttribute('href')).toContain('runId=run-1');
    // PX-31：技术证据结构化（探针状态提为字段），raw JSON 折叠进未展开的 details。
    expect(container.textContent).toContain('releaseEvidenceProbe.healthProbe');
    const details = container.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(false);
    expect(details?.textContent).toContain('"healthProbe"');
  });

  it('folds raw technical JSON behind a closed disclosure and shortens raw cuids (PX-31/PX-3)', async () => {
    const run = {
      ...stagingRun(),
      id: 'cmsn5pyqs01bd3nfoljnee97t',
      result: {
        gitInvoked: false,
        manifestId: 'manifest-1',
        deploymentUri: 'file:///srv/picshare/current',
        artifactSizeBytes: 40824690,
        runtimeEnvironmentFileMode: '0600',
        workloadReady: { status: 'not_configured' },
        healthProbe: { status: 'not_configured' },
        httpProbe: { status: 'not_configured' },
      },
    } as ReleaseStagingDeploymentItem;
    await render(run, build());
    const text = container.textContent ?? '';
    expect(text).toContain('38.9MB（40824690 字节）');
    expect(text).toContain('0600');
    expect(text).toContain('releaseEvidenceGitInvoked');
    const raw = container.querySelector('[data-testid="staging-technical-raw-json"]');
    expect(raw?.textContent).toContain('"artifactSizeBytes": 40824690');
    // PX-3：字段与标题不渲染 25 位 raw cuid（折叠为前 8 位 + …）。
    expect(text).toContain('cmsn5pyq…');
    expect(text).not.toContain('cmsn5pyqs01bd3nfoljnee97t');
  });

  it('keeps a route-backed requested run open on load errors and retries in place', async () => {
    const onRetry = vi.fn();
    await act(async () => {
      root.render(
        <ReleaseStagingLogDrawer
          projectId="project-1"
          run={null}
          build={null}
          requestedRunId="run-deep-link"
          loading={false}
          error="network offline"
          onRetry={onRetry}
          onClose={vi.fn()}
        />,
      );
    });
    expect(container.querySelector('section')).not.toBeNull();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('network offline');
    act(() => container.querySelector('button')?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });

  async function render(run: ReleaseStagingDeploymentItem, item: ReleaseBuildItem) {
    await act(async () => {
      root.render(
        <ReleaseStagingLogDrawer
          projectId="project-1"
          run={run}
          build={item}
          loading={false}
          error=""
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
  }
});

function stagingRun(): ReleaseStagingDeploymentItem {
  return {
    id: 'run-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    targetType: 'server',
    executorKey: 'release-artifact',
    adapterKey: 'ssh-v1',
    dryRun: false,
    branch: 'main',
    commitSha: 'a'.repeat(40),
    logs: ['workload exact Manifest started', 'health passed'],
    result: {
      workloadReady: { status: 'passed' },
      healthProbe: { status: 'passed' },
      httpProbe: { status: 'passed' },
    },
    error: null,
    startedAt: '2026-08-06T00:00:00.000Z',
    finishedAt: '2026-08-06T00:01:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
  };
}

function build(): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 1,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    sourceRepository: null,
    status: 'succeeded',
    logReference: null,
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-08-06T00:00:00.000Z',
    finishedAt: '2026-08-06T00:01:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
    manifest: { id: 'manifest-1', digest: 'sha256:exact', items: [] },
  };
}
