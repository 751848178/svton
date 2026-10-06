import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem } from '../../types/release-order.types';
import { ReleaseStepBuildPanel } from './release-step-build-panel';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReleaseStepBuildPanel', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
  });

  it('shows exact BuildRun, time and Manifest facts even when resources are empty', () => {
    const run = fixture();
    const html = render(run);

    expect(html).toContain(`master @ ${run.sourceCommitSha}`);
    expect(html).toContain(run.manifest?.id);
    expect(html).toContain(run.manifest?.digest);
    expect(html).toContain('releaseBuildArtifactCountValue:{&quot;count&quot;:0}');
    expect(html).toContain('releaseLifecycleBuildResourcesEmpty');
    expect(html).toContain('releaseBuildStartedAt');
    expect(html).toContain('releaseBuildFinishedAt');
  });

  it('keeps an active run truthful when finish time and Manifest are absent', () => {
    const run = fixture({ status: 'running', finishedAt: null, manifest: null });
    const html = render(run);

    expect(html).toContain('releaseBuildRunningFinished');
    expect(html).toContain('releaseBuildManifestUnavailable');
    expect(html).not.toContain('releaseBuildArtifactCountValue');
  });

  it('renders only the server error code and message for a failed run', () => {
    const html = render(
      fixture({
        status: 'failed',
        errorCode: 'BUILD_COMMAND_FAILED',
        errorMessage: 'pnpm build exited 1',
        manifest: null,
      }),
    );

    expect(html).toContain('构建命令失败：pnpm build exited 1');
  });
});

function render(build: ReleaseBuildItem) {
  return renderToStaticMarkup(
    <ReleaseStepBuildPanel
      build={build}
      building={false}
      onOpenLog={vi.fn()}
    />,
  );
}

function fixture(overrides: Partial<ReleaseBuildItem> = {}): ReleaseBuildItem {
  return {
    id: 'build-10',
    releaseOrderId: 'order-1',
    revision: 10,
    sourceBranch: 'master',
    sourceCommitSha: '8e7c465d56e68dafcef0dfbc480fe721044b0fb3',
    sourceRepository: null,
    status: 'succeeded',
    logReference: 'build-log-10',
    logSummary: null,
    gateSummary: null,
    errorCode: null,
    errorMessage: null,
    startedAt: '2026-08-10T10:05:41.000Z',
    finishedAt: '2026-08-10T10:07:23.000Z',
    createdAt: '2026-08-10T10:05:41.000Z',
    manifest: {
      id: 'manifest-10',
      digest: 'sha256:32bf01d5cd4a0000000000000000000000000000000000000000000000000000',
      items: [],
    },
    ...overrides,
  };
}
