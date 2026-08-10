import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ReleaseOrderListItem } from '../types/release-order-list.types';
import { ReleaseOrderListRow } from './release-order-list-row';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
  BlockedState: ({ reason }: { reason: React.ReactNode }) => <div data-blocked>{reason}</div>,
}));

describe('ReleaseOrderListRow', () => {
  it('renders the real source, counts, Manifest, deployment, last execution, and action', () => {
    const html = renderToStaticMarkup(
      <ReleaseOrderListRow
        item={item()}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain('2.4.1');
    expect(html).toContain('main@cccccccc');
    expect(html).toContain('failed build keeps prior manifest');
    expect(html).toContain('releaseOrderBuildCount');
    expect(html).toContain('&quot;count&quot;:3');
    expect(html).toContain('releaseOrderRecentManifest');
    expect(html).toContain('releaseEnvironmentStaging · releaseExecutionStatusCompleted');
    expect(html).toContain('releaseOrderListStepProduction');
    expect(html).toContain('releaseExecutionStatusAwaitingApproval');
    expect(html).toContain('viewReleaseOrder');
  });

  it('shows locked branch without inventing a Commit or Manifest', () => {
    const draft = item();
    draft.source = {
      branch: 'main',
      commitSha: null,
      buildRunId: null,
      buildRevision: null,
      buildStatus: null,
    };
    draft.build = { count: 0, recentSuccessfulManifest: null };
    draft.deployment = { count: 0, latest: null };
    const html = renderToStaticMarkup(
      <ReleaseOrderListRow
        item={draft}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain('releaseOrderSourcePending');
    expect(html).toContain('releaseOrderNoManifest');
    expect(html).toContain('releaseOrderNoDeployment');
  });

  it('renders the server-derived failure kind without replacing lifecycle status', () => {
    const failed = item();
    failed.lifecycle = {
      ...failed.lifecycle,
      status: 'failed',
      failureKind: 'evidence_mismatch',
    };
    const html = renderToStaticMarkup(
      <ReleaseOrderListRow
        item={failed}
        onOpen={() => {}}
      />,
    );
    expect(html).toContain('releaseOrderStatusFailed');
    expect(html).toContain('releaseOrderFailureEvidenceMismatch');
  });
});

function item(): ReleaseOrderListItem {
  return {
    id: 'order-1',
    projectId: 'project-1',
    releaseVersion: '2.4.1',
    note: 'failed build keeps prior manifest',
    persistedStatus: 'active',
    lifecycle: {
      status: 'awaiting_approval',
      phase: 'production',
      sourceType: 'release_run',
      sourceId: 'release-run-1',
      sourceStatus: 'awaiting_approval',
      occurredAt: '2026-08-04T08:00:00.000Z',
    },
    createdAt: '2026-08-04T01:00:00.000Z',
    source: {
      branch: 'main',
      commitSha: 'c'.repeat(40),
      buildRunId: 'build-3',
      buildRevision: 3,
      buildStatus: 'failed',
    },
    build: {
      count: 3,
      recentSuccessfulManifest: {
        id: 'manifest-success-2',
        digest: `sha256:${'b'.repeat(64)}`,
        buildRunId: 'build-2',
        buildRevision: 2,
        createdAt: '2026-08-04T05:00:00.000Z',
      },
    },
    deployment: {
      count: 2,
      latest: {
        id: 'deployment-2',
        environmentId: 'staging',
        environmentRole: 'staging',
        environmentName: 'Staging',
        status: 'completed',
        artifactManifestId: 'manifest-success-2',
        buildRunId: 'build-2',
        occurredAt: '2026-08-04T06:00:00.000Z',
      },
    },
    lastExecution: {
      step: 'production',
      sourceType: 'release_run',
      sourceId: 'release-run-1',
      status: 'awaiting_approval',
      occurredAt: '2026-08-04T08:00:00.000Z',
    },
    lastExecutedAt: '2026-08-04T08:00:00.000Z',
  };
}
