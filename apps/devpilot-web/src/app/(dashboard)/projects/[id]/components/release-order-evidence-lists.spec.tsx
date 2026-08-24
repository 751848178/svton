import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { ReleaseStagingEvidenceList } from './release-staging-evidence-list';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key}:${JSON.stringify(values)}` : `${namespace}.${key}`,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  LinkButton: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('release order evidence lists', () => {
  it('keeps repeated Staging runs for one Manifest and exposes canonical professional links', () => {
    const items = [stagingDeployment('staging-2'), stagingDeployment('staging-1')];
    const html = renderToStaticMarkup(
      <ReleaseStagingEvidenceList
        items={items}
        builds={[stagingBuild()]}
        total={2}
        focusedRunId="staging-1"
        deploying={false}
        onOpenLog={vi.fn()}
        onDeploy={vi.fn()}
      />,
    );
    // PX-3/ROD-4：行首短 ID（title 全文），构建列 #revision 为主 + BuildRun 短 ID。
    expect(html).toContain('title="staging-2"');
    expect(html).toContain('title="staging-1"');
    expect(html).toContain('BuildRun build-1');
    expect(html).toContain('title="manifest-1 · sha256:exact"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('projects.runStatusCompleted');
    expect(html.match(/>projects\.viewReleaseStagingLogs<\/button>/g)).toHaveLength(2);
    expect(html.match(/>projects\.deployExactManifest<\/button>/g)).toHaveLength(2);
    expect(html).toContain('scope="row"');
    expect(html.match(/projects\.releaseStagingBusinessPending/g)).toHaveLength(2);
  });
});

function stagingDeployment(id: string): ReleaseStagingDeploymentItem {
  return {
    id,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-env',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    targetType: 'server',
    executorKey: 'release-artifact',
    adapterKey: 'ssh-v1',
    dryRun: false,
    branch: 'main',
    commitSha: 'a'.repeat(40),
    logs: ['health passed'],
    result: {
      workloadReady: { status: 'passed' },
      healthProbe: { status: 'passed' },
      httpProbe: { status: 'passed' },
    },
    error: null,
    startedAt: '2026-08-05T00:00:00Z',
    finishedAt: '2026-08-05T00:01:00Z',
    createdAt: '2026-08-05T00:00:00Z',
  };
}

function stagingBuild() {
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
    startedAt: '2026-08-05T00:00:00Z',
    finishedAt: '2026-08-05T00:01:00Z',
    createdAt: '2026-08-05T00:00:00Z',
    manifest: { id: 'manifest-1', digest: 'sha256:exact', items: [] },
  } satisfies ReleaseBuildItem;
}
