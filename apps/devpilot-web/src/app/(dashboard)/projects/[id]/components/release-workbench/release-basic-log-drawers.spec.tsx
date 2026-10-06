import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  ReleaseBuildItem,
  ReleaseStagingDeploymentItem,
} from '../../types/release-order.types';
import { ReleaseBasicBuildLogDrawer } from './release-basic-build-log-drawer';
import { ReleaseBasicStagingLogDrawer } from './release-basic-staging-log-drawer';

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@svton/ui', () => ({
  Drawer: ({ open, children, title }: React.PropsWithChildren<{ open: boolean; title: string }>) =>
    open ? <section aria-label={title}>{children}</section> : null,
  LoadingState: ({ text }: { text: string }) => <div>{text}</div>,
}));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  ErrorBanner: ({ message }: { message: string }) => <div role="alert">{message}</div>,
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

describe('basic release log drawers', () => {
  it('shows terminal status, times, and logs without advanced evidence surfaces', () => {
    const html = renderToStaticMarkup(
      <>
        <ReleaseBasicBuildLogDrawer
          run={build()}
          onClose={vi.fn()}
        />
        <ReleaseBasicStagingLogDrawer
          run={deployment()}
          loading={false}
          error=""
          onRetry={vi.fn()}
          onClose={vi.fn()}
        />
      </>,
    );

    expect(html).toContain('build finished');
    expect(html).toContain('deployment finished');
    expect(html).toContain('releaseBuildStartedAt');
    expect(html).toContain('releaseBuildFinishedAt');
    expect(html).toContain('releaseBuildStatusSucceeded');
    expect(html).toContain('runStatusCompleted');
    expect(html).not.toContain('sourceCommitSha');
    expect(html).not.toContain('sha256:');
    expect(html).not.toContain('deploymentEvidenceOverview');
    expect(html).not.toContain('releaseRunTechnicalDetails');
    expect(html).not.toContain('releaseStagingBusinessResult');
  });
});

function build(): ReleaseBuildItem {
  return {
    id: 'build-1',
    releaseOrderId: 'order-1',
    revision: 1,
    sourceBranch: 'main',
    sourceCommitSha: 'a'.repeat(40),
    sourceRepository: null,
    status: 'succeeded',
    logReference: 'build-log://build-1',
    logSummary: { redacted: true, lines: ['build finished'] },
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-09-03T00:00:00.000Z',
    finishedAt: '2026-09-03T00:00:10.000Z',
    createdAt: '2026-09-03T00:00:00.000Z',
    manifest: { id: 'manifest-1', digest: `sha256:${'b'.repeat(64)}`, items: [] },
  };
}

function deployment(): ReleaseStagingDeploymentItem {
  return {
    id: 'deployment-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    targetType: 'server',
    executorKey: 'release-artifact',
    adapterKey: 'local-filesystem-v1',
    dryRun: false,
    branch: 'main',
    commitSha: 'a'.repeat(40),
    logs: ['deployment finished'],
    result: { artifactVerified: true },
    error: null,
    startedAt: '2026-09-03T00:01:00.000Z',
    finishedAt: '2026-09-03T00:01:01.000Z',
    createdAt: '2026-09-03T00:01:00.000Z',
  };
}
