import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReleaseStagingDeploymentItem } from '../../types/release-order.types';
import { ReleaseStepDeployPanel } from './release-step-deploy-panel';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReleaseStepDeployPanel', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
  });

  it('keeps the main deployment step human-readable and moves machine evidence to the drawer', () => {
    const html = renderToStaticMarkup(
      <ReleaseStepDeployPanel
        deployment={fixture()}
        builds={[]}
        stagingEnvironment={{ id: 'staging-1', name: 'Staging' }}
        onOpenLog={vi.fn()}
      />,
    );

    expect(html).toContain('Staging');
    expect(html).toContain('releaseStagingEvidenceMovedHint');
    expect(html).not.toContain('run-1');
    expect(html).not.toContain('manifest-1');
    expect(html).not.toContain('sha256:abc');
    expect(html).not.toContain('releaseStagingStage.verify_manifest_digest');
  });

  it('renders the deployment empty state without fabricated fields', () => {
    const html = renderToStaticMarkup(
      <ReleaseStepDeployPanel
        deployment={null}
        builds={[]}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('releaseRoundNoDeploy');
    expect(html).not.toContain('releaseStagingCurrentRun');
  });

  it('uses the basic deployment summary without backend run names or build references', () => {
    const html = renderToStaticMarkup(
      <ReleaseStepDeployPanel
        basic
        deployment={fixture()}
        builds={[]}
        stagingEnvironment={{ id: 'staging-1', name: 'Staging' }}
        showEvidenceHint={false}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('releaseBasicCurrentDeployment');
    expect(html).not.toContain('releaseStagingCurrentRun');
    expect(html).not.toContain('releaseStagingSummaryBuild');
  });
});

function fixture(): ReleaseStagingDeploymentItem {
  return {
    id: 'run-1',
    projectId: 'project-1',
    releaseOrderId: 'release-1',
    environmentId: 'staging-1',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    targetType: 'release-artifact',
    executorKey: 'release-artifact',
    adapterKey: 'local-filesystem-v1',
    dryRun: false,
    branch: 'master',
    commitSha: 'abc',
    params: { manifestId: 'manifest-1', manifestDigest: 'sha256:abc' },
    commandPlan: { steps: ['verify_manifest_digest'] },
    logs: [],
    result: { artifactVerified: true },
    error: null,
    startedAt: '2026-08-10T11:00:00.000Z',
    finishedAt: '2026-08-10T11:00:01.000Z',
    createdAt: '2026-08-10T11:00:00.000Z',
  };
}
