// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem } from '../types/release-order.types';
import { ReleaseBuildLogDrawer } from './release-build-log-drawer';

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
}));

describe('ReleaseBuildLogDrawer', () => {
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

  it('fails closed for unredacted history while retaining exact terminal evidence', async () => {
    await render(
      build({
        status: 'failed',
        errorCode: 'BUILD_COMMAND_FAILED',
        errorMessage: 'password=[REDACTED]',
        logSummary: { redacted: false, lines: ['sentinel-secret'] },
      }),
    );
    expect(container.textContent).toContain('build-1');
    expect(container.textContent).toContain('BUILD_COMMAND_FAILED: password=[REDACTED]');
    expect(container.textContent).toContain('releaseBuildLogsUnavailable');
    expect(container.textContent).not.toContain('sentinel-secret');
  });

  it('shows redacted lines and explicit truncation evidence', async () => {
    await render(
      build({
        logSummary: {
          redacted: true,
          truncated: true,
          sourceLineCount: 240,
          lines: ['[api] $ pnpm build', 'result succeeded'],
        },
      }),
    );
    expect(container.textContent).toContain('[api] $ pnpm build');
    expect(container.textContent).toContain('result succeeded');
    expect(container.textContent).toContain('releaseBuildLogsTruncated');
  });

  it('keeps a requested deep link open on detail errors and retries in place', async () => {
    const onRetry = vi.fn();
    await act(async () => {
      root.render(
        <ReleaseBuildLogDrawer
          run={null}
          requestedBuildRunId="build-deep-link"
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

  async function render(run: ReleaseBuildItem) {
    await act(async () => {
      root.render(
        <ReleaseBuildLogDrawer
          run={run}
          onClose={vi.fn()}
        />,
      );
    });
  }
});

function build(overrides: Partial<ReleaseBuildItem>): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 1,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    sourceRepository: null,
    status: 'succeeded',
    logReference: 'build-log://build-1',
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-08-06T00:00:00.000Z',
    finishedAt: '2026-08-06T00:01:00.000Z',
    createdAt: '2026-08-06T00:00:00.000Z',
    manifest: { id: 'manifest-1', digest: 'sha256:digest-1', items: [] },
    ...overrides,
  };
}
