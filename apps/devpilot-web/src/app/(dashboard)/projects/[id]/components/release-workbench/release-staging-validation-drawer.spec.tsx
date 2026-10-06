// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { ReleaseStagingValidationDrawer } from './release-staging-validation-drawer';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Drawer: ({ open, children, title }: React.PropsWithChildren<{ open: boolean; title: string }>) =>
    open ? <section aria-label={title}>{children}</section> : null,
  LoadingState: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
  ErrorBanner: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

describe('ReleaseStagingValidationDrawer', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT: boolean;
        React: typeof React;
      }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    container = document.createElement('div');
    root = createRoot(container);
  });

  afterEach(async () => act(async () => root.unmount()));

  it('keeps the exact run open and shows four independently sourced evidence blocks', async () => {
    await act(async () => {
      root.render(
        <ReleaseStagingValidationDrawer
          projectId="project-1"
          run={run()}
          build={null}
          loading={false}
          error=""
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('run-1');
    expect(container.textContent).toContain('manifest-1');
    expect(container.textContent).toContain('result.workloadReady.status');
    expect(container.textContent).toContain('2026-08-28');
    expect(container.querySelectorAll('[data-testid^="staging-validation-"]')).toHaveLength(4);
    expect(container.querySelector('[role="log"]')?.textContent).toContain('runtime log');
  });

  it('does not substitute the run finish time when check evidence is absent', async () => {
    await act(async () => {
      root.render(
        <ReleaseStagingValidationDrawer
          projectId="project-1"
          run={{ ...run(), result: {} }}
          build={null}
          loading={false}
          error=""
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain('releaseStagingValidationGap');
    const evidence = container.querySelector('[data-testid="staging-validation-workloadReady"]');
    expect(evidence?.textContent).toContain('-');
    expect(evidence?.textContent).not.toContain('2026-08-28T02:00:00.000Z');
  });
});

function run(): ReleaseStagingDeploymentItem {
  return {
    id: 'run-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    targetType: 'release-artifact',
    executorKey: 'server',
    adapterKey: 'local',
    dryRun: false,
    branch: 'main',
    commitSha: 'a'.repeat(40),
    logs: ['runtime log'],
    error: null,
    startedAt: '2026-08-28T01:00:00.000Z',
    finishedAt: '2026-08-28T02:00:00.000Z',
    createdAt: '2026-08-28T01:00:00.000Z',
    result: { workloadReady: { status: 'passed', checkedAt: '2026-08-28T01:30:00.000Z' } },
  };
}
