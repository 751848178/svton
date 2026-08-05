import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../types/release-order-evidence.types';
import { ReleaseProductionEvidenceList } from './release-production-evidence-list';
import { ReleaseStagingEvidenceList } from './release-staging-evidence-list';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) =>
    values ? `${namespace}.${key}:${JSON.stringify(values)}` : `${namespace}.${key}`,
}));
vi.mock('@/components/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  LinkButton: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));

describe('release order evidence lists', () => {
  it('keeps repeated Staging runs for one Manifest and exposes canonical professional links', () => {
    const items = [deployment('staging-2'), deployment('staging-1')];
    const html = renderToStaticMarkup(
      <ReleaseStagingEvidenceList
        projectId="project-1"
        items={items}
        total={2}
        focusedRunId="staging-1"
        onFocus={vi.fn()}
      />,
    );
    expect(html).toContain('DeploymentRun staging-2');
    expect(html).toContain('DeploymentRun staging-1');
    expect(html).toContain('BuildRun build-1 / #1');
    expect(html).toContain('Manifest manifest-1 / sha256:exact');
    expect(html).toContain('/projects/project-1?view=deployments&amp;runId=staging-1');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('projects.releaseEvidenceDetails');
  });

  it('renders ReleaseRun, approval, staging proof and every Production DeploymentRun', () => {
    const production = productionRun();
    const html = renderToStaticMarkup(
      <ReleaseProductionEvidenceList
        projectId="project-1"
        items={[production]}
        total={1}
        focusedReleaseRunId="release-1"
        focusedDeploymentRunId="production-2"
        onFocus={vi.fn()}
      />,
    );
    expect(html).toContain('ReleaseRun release-1');
    expect(html).toContain('projects.releaseProductionApproval approved');
    expect(html).toContain('Staging DeploymentRun staging-proof-1');
    expect(html).toContain('DeploymentRun production-1');
    expect(html).toContain('DeploymentRun production-2');
    expect(html).toContain('/projects/project-1?view=deployments&amp;runId=production-2');
    expect(html.match(/projects\.releaseEvidenceDetails/g)).toHaveLength(3);
  });
});

function manifest() {
  return {
    id: 'manifest-1',
    digest: 'sha256:exact',
    createdAt: '2026-08-05T00:00:00Z',
    buildRun: { id: 'build-1', revision: 1, sourceBranch: 'main', sourceCommitSha: 'a'.repeat(40) },
    items: [{ componentKey: 'project-bundle', artifactType: 'zip', digest: 'sha256:exact' }],
  };
}

function deployment(id: string): ReleaseEvidenceDeploymentRun {
  return {
    id,
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    releaseRunId: null,
    environmentId: 'staging-env',
    artifactManifestId: 'manifest-1',
    status: 'completed',
    executorKey: 'release-artifact',
    adapterKey: 'local-materialize',
    branch: 'main',
    commitSha: 'a'.repeat(40),
    error: null,
    startedAt: '2026-08-05T00:00:00Z',
    finishedAt: '2026-08-05T00:01:00Z',
    createdAt: '2026-08-05T00:00:00Z',
    environment: { id: 'staging-env', name: 'Staging', baselineRole: 'staging' },
    manifest: manifest(),
  };
}

function productionRun(): ReleaseEvidenceProductionRun {
  const first = { ...deployment('production-1'), releaseRunId: 'release-1' };
  const second = { ...deployment('production-2'), releaseRunId: 'release-1' };
  return {
    id: 'release-1',
    projectId: 'project-1',
    releaseOrderId: 'order-1',
    environmentId: 'staging-env',
    artifactManifestId: 'manifest-1',
    status: 'succeeded',
    verifiedDigest: 'sha256:exact',
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: '2026-08-05T00:02:00Z',
    environment: { id: 'staging-env', name: 'Production', baselineRole: 'production' },
    manifest: manifest(),
    operationApproval: {
      id: 'approval-1',
      status: 'approved',
      requestedAt: '2026-08-05T00:00:00Z',
      reviewedAt: '2026-08-05T00:01:00Z',
    },
    stagingProof: {
      deploymentRunId: 'staging-proof-1',
      environmentId: 'staging-env',
      finishedAt: '2026-08-05T00:01:00Z',
    },
    deploymentRuns: [first, second],
  };
}
