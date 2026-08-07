// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../types/release-order-evidence.types';
import { ReleaseProductionLogDrawer } from './release-production-log-drawer';

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

describe('ReleaseProductionLogDrawer', () => {
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

  it('shows redacted logs, structured evidence, and separate technical/business conclusions', async () => {
    await render(productionRun());
    expect(container.textContent).toContain('releaseProductionDeploymentRunIdrun-1');
    expect(container.textContent).toContain('releaseProductionReleaseRunIdrelease-1');
    expect(container.textContent).toContain('"workloadReady"');
    expect(container.textContent).toContain('releaseStagingVerificationPassed');
    expect(container.textContent).toContain('releaseStagingBusinessPending');
    expect(container.textContent).toContain('releaseProductionTechnicalResultDetail');
    expect(container.querySelector('[role="log"]')?.textContent).toContain('health passed');
    expect(container.querySelector('a')?.getAttribute('href')).toContain('runId=run-1');
  });

  it('keeps a route-backed requested run open on load errors and retries in place', async () => {
    const onRetry = vi.fn();
    await act(async () => {
      root.render(
        <ReleaseProductionLogDrawer
          projectId="project-1"
          run={null}
          releaseRun={null}
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

  async function render(run: ReleaseEvidenceDeploymentRun) {
    await act(async () => {
      root.render(
        <ReleaseProductionLogDrawer
          projectId="project-1"
          run={run}
          releaseRun={{ id: 'release-1' } as ReleaseEvidenceProductionRun}
          loading={false}
          error=""
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
  }
});

function productionRun(): ReleaseEvidenceDeploymentRun {
  return {
    id: 'run-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    releaseRunId: 'release-1',
    environmentId: 'prod-env-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    executorKey: 'release-artifact',
    adapterKey: 'ssh-v1',
    branch: 'main',
    commitSha: 'a'.repeat(40),
    error: null,
    logs: ['production exact Manifest started', 'health passed'],
    result: {
      workloadReady: { status: 'passed' },
      healthProbe: { status: 'passed' },
      httpProbe: { status: 'passed' },
    },
    startedAt: '2026-08-06T00:00:00.000Z',
    finishedAt: '2026-08-06T00:01:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
    environment: { id: 'prod-env-1', name: 'Production', baselineRole: 'production' },
    manifest: {
      id: 'manifest-1',
      digest: 'sha256:exact',
      createdAt: '2026-08-06T00:00:00.000Z',
      buildRun: {
        id: 'build-1',
        revision: 1,
        sourceBranch: 'main',
        sourceCommitSha: 'a'.repeat(40),
      },
      items: [],
    },
    siteProbe: null,
    routeSwitch: null,
  };
}
