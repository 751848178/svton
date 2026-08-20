// @vitest-environment jsdom

import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProjectDeliverySummary } from '../../types/project-delivery-summary.types';
import type { ReleaseOrderEvidence } from '../../types/release-order-evidence.types';
import type { ReleaseOrderDetail } from '../../types/release-order.types';
import { ReleaseWorkbenchHeader } from './release-workbench-header';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${Object.values(values).join('/')}` : key,
}));
vi.mock('@phosphor-icons/react', () => ({ CaretDown: () => <span /> }));
vi.mock('@/components/ui', () => ({
  Button: ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('ReleaseWorkbenchHeader', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { React: typeof React }).React = React;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
      .IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('keeps only compact release facts and no stage CTA', async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => root.render(
      <ReleaseWorkbenchHeader
        detail={detail}
        projectSummary={summary}
        evidence={evidence}
        onBack={vi.fn()}
      />,
    ));

    expect(container.textContent).toContain('Project Alpha');
    expect(container.textContent).toContain('releaseOrderDetailHeading:2.4.0');
    expect(container.textContent).toContain('releaseStepStagingTitle');
    expect(container.textContent).toContain('main @ 12345678');
    expect(container.textContent).toContain('releaseWorkbenchStagingVersion:2.3.9');
    expect(container.querySelector('details')).toBeNull();
    expect(container.querySelectorAll('button')).toHaveLength(1);
    expect(container.textContent).not.toContain('buildLatestCode');
    await act(async () => root.unmount());
  });
});

const detail = {
  id: 'order-full-identifier',
  projectId: 'project-1',
  releaseVersion: '2.4.0',
  note: 'Candidate release',
  counts: { buildRuns: 1, manifests: 1, releaseRuns: 0 },
  lifecycle: { status: 'staging', phase: 'staging' },
  resumeStep: 'staging',
  preflight: { repository: { branch: 'main' } },
} as unknown as ReleaseOrderDetail;

const summary = {
  project: { id: 'project-1', name: 'Project Alpha' },
  currentVersions: {
    staging: { releaseVersion: '2.3.9' },
    production: { releaseVersion: '2.3.8' },
  },
} as unknown as ProjectDeliverySummary;

const evidence = {
  buildRuns: {
    items: [
      {
        id: 'build-1',
        sourceBranch: 'main',
        sourceCommitSha: '1234567890abcdef',
        createdAt: '2026-08-20T01:00:00.000Z',
        status: 'succeeded',
        manifest: {
          id: 'manifest-full-identifier',
          digest: 'sha256:full-digest',
          createdAt: '2026-08-20T01:00:00.000Z',
          buildRun: {
            id: 'build-1',
            revision: 1,
            sourceBranch: 'main',
            sourceCommitSha: '1234567890abcdef',
          },
          items: [],
        },
      },
    ],
  },
  stagingDeploymentRuns: { items: [] },
  productionReleaseRuns: { items: [] },
} as unknown as ReleaseOrderEvidence;
