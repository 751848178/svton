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
        recoveryHref="/projects/project-1?view=environment-versions"
        focusedReleaseRunId="release-1"
        focusedDeploymentRunId="production-2"
        onFocus={vi.fn()}
        onOpenLog={vi.fn()}
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
    expect(html.match(/projects\.focusDeploymentRunEvidenceForRun/g)).toHaveLength(2);
    expect(html.match(/projects\.focusReleaseRunEvidence/g)).toHaveLength(1);
    expect(html).toContain('projects.releaseProductionColumnRun');
    expect(html).toContain('projects.releaseProductionColumnArtifact');
    expect(html).toContain('projects.releaseProductionColumnResult');
    expect(html).toContain('projects.releaseProductionColumnVerification');
    expect(html).toContain('projects.releaseBuildColumnDurationTime');
    expect(html).toContain('projects.releaseBuildColumnActions');
    expect(html).toContain('projects.releaseRunCardRun');
    expect(html).toContain('projects.releaseRunCardEnvironment');
    expect(html).toContain('projects.releaseRunCardFrozenArtifact');
    expect(html).toContain('projects.releaseRunCardStatus');
    expect(html).toContain('projects.releaseRunCardCreatedAt');
    expect(html.match(/projects\.viewProductionLogsForRun/g)).toHaveLength(2);
  });

  it('renders a running in-flight indicator and recovery affordance for failed ReleaseRuns', () => {
    const running = productionRun();
    running.status = 'running';
    const failed = productionRun();
    failed.id = 'release-failed';
    failed.operationApproval.status = 'rejected';
    failed.status = 'failed';
    const html = renderToStaticMarkup(
      <ReleaseProductionEvidenceList
        projectId="project-1"
        items={[failed, running]}
        total={2}
        recoveryHref="/projects/project-1?view=environment-versions"
        onFocus={vi.fn()}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('data-running-indicator="true"');
    expect(html).toContain('projects.releaseProductionRunningBanner');
    expect(html.match(/projects\.releaseProductionRecoveryLink/g)).toHaveLength(1);
    expect(html).toContain('projects.releaseRunCardStatus');
  });

  it('renders the site/DNS/TLS/HTTP evidence section for a focused DeploymentRun', () => {
    const production = productionRun();
    production.deploymentRuns[0] = {
      ...production.deploymentRuns[0],
      siteProbe: {
        version: 1,
        primaryDomain: 'demo.f437.example',
        finalUrl: 'https://demo.f437.example',
        probedAt: '2026-08-06T12:00:00Z',
        dns: {
          status: 'unavailable',
          hostname: 'demo.f437.example',
          records: null,
          error: { code: 'ENOTFOUND', message: 'queryA ENOTFOUND' },
          checkedAt: '2026-08-06T12:00:00Z',
        },
        tls: {
          status: 'unavailable',
          host: 'demo.f437.example',
          port: 443,
          servername: 'demo.f437.example',
          cert: null,
          error: { code: 'ENOTFOUND', message: 'queryA ENOTFOUND' },
          checkedAt: '2026-08-06T12:00:00Z',
        },
        http: {
          status: 'passed',
          url: 'http://127.0.0.1:23992',
          finalUrl: 'https://demo.f437.example',
          statusCode: 200,
          bodySignature: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          error: null,
          checkedAt: '2026-08-06T12:00:00Z',
        },
      },
      routeSwitch: {
        version: 1,
        siteId: 'site-1',
        primaryDomain: 'demo.f437.example',
        deploymentRunId: 'production-1',
        releaseRunId: 'release-1',
        targetRef: 'filesystem-release-target',
        proxyTarget: 'http://127.0.0.1:23992',
        domains: ['demo.f437.example'],
        status: 'switched',
        reasonCode: 'site_switched',
        switchedAt: '2026-08-06T12:00:01Z',
      },
    };
    const html = renderToStaticMarkup(
      <ReleaseProductionEvidenceList
        projectId="project-1"
        items={[production]}
        total={1}
        recoveryHref="/projects/project-1?view=environment-versions"
        focusedReleaseRunId="release-1"
        focusedDeploymentRunId="production-1"
        onFocus={vi.fn()}
        onOpenLog={vi.fn()}
      />,
    );
    expect(html).toContain('projects.releaseSiteEvidenceTitle');
    expect(html).toContain('projects.releaseSiteProbeSwitched');
    expect(html).toContain('demo.f437.example');
    expect(html).toContain('projects.releaseSiteDnsProbe');
    expect(html).toContain('projects.releaseSiteProbeUnavailable');
    expect(html).toContain('projects.releaseSiteTlsProbe');
    expect(html).toContain('projects.releaseSiteHttpProbe');
    expect(html).toContain('projects.releaseSiteProbePassed');
    expect(html).toContain(
      'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    );
    expect(html).toContain('data-site-probe-section="true"');
    expect(html).toContain('projects.releaseSiteProbeErrorDetail');
    expect(html).toContain('ENOTFOUND');
    expect(html).not.toContain('queryA ENOTFOUND');
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
    logs: ['health passed'],
    result: {
      workloadReady: { status: 'passed' },
      healthProbe: { status: 'passed' },
      httpProbe: { status: 'passed' },
    },
    startedAt: '2026-08-05T00:00:00Z',
    finishedAt: '2026-08-05T00:01:00Z',
    createdAt: '2026-08-05T00:00:00Z',
    environment: { id: 'staging-env', name: 'Staging', baselineRole: 'staging' },
    manifest: manifest(),
    siteProbe: null,
    routeSwitch: null,
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
    mode: 'standard',
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
      risk: 'high',
      summary: '生产发布 1.0.0 / Build #1',
      requesterId: 'user-1',
      reviewerId: 'reviewer-1',
      requester: { id: 'user-1', name: 'Requester', email: 'requester@example.com' },
      reviewer: { id: 'reviewer-1', name: 'Reviewer', email: 'reviewer@example.com' },
      reviewComment: null,
      requestedAt: '2026-08-05T00:00:00Z',
      reviewedAt: '2026-08-05T00:01:00Z',
      consumedAt: null,
      expiresAt: null,
    },
    legacyPromotionRecovery: null,
    stagingProof: {
      deploymentRunId: 'staging-proof-1',
      environmentId: 'staging-env',
      finishedAt: '2026-08-05T00:01:00Z',
    },
    deploymentRuns: [first, second],
  };
}
