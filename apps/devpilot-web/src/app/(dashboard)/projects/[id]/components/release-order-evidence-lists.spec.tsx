import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type {
  ReleaseEvidenceDeploymentRun,
  ReleaseEvidenceProductionRun,
} from '../types/release-order-evidence.types';
import type { ReleaseBuildItem, ReleaseStagingDeploymentItem } from '../types/release-order.types';
import { ReleaseProductionEvidenceList } from './release-production-evidence-list';
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
    expect(html).toContain('DeploymentRun staging-2');
    expect(html).toContain('DeploymentRun staging-1');
    expect(html).toContain('BuildRun build-1 · R1');
    expect(html).toContain('Manifest manifest-1');
    expect(html).toContain('/projects/project-1?view=deployments&amp;runId=staging-1');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('projects.runStatusCompleted');
    expect(html.match(/>projects\.viewReleaseStagingLogs<\/button>/g)).toHaveLength(2);
    expect(html.match(/>projects\.deployExactManifest<\/button>/g)).toHaveLength(2);
    expect(html).toContain('scope="row"');
    expect(html).toContain('projects.viewReleaseStagingLogsForRun');
    expect(html).toContain('projects.deployExactManifestForRun');
    expect(html.match(/projects\.releaseStagingBusinessPending/g)).toHaveLength(2);
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
    expect(html).toContain(
      'projects.releaseProductionApproval · projects.releaseApprovalStatusApproved',
    );
    expect(html).toContain('projects.runStatusSucceeded');
    expect(html).toContain('projects.releaseEnvironmentProduction');
    expect(html).toContain('projects.releaseEnvironmentStaging DeploymentRun staging-proof-1');
    expect(html).toContain('DeploymentRun production-1');
    expect(html).toContain('DeploymentRun production-2');
    expect(html).toContain('/projects/project-1?view=deployments&amp;runId=production-2');
    expect(html.match(/projects\.focusDeploymentRunEvidence/g)).toHaveLength(2);
    expect(html.match(/projects\.focusReleaseRunEvidence/g)).toHaveLength(1);
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
