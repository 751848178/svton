import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { DeploymentRun } from '../types/operations';
import { DeploymentRunDetails } from './deployment-run-details.component';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('./deploy-var-preview', () => ({ DeployVarPreview: () => null }));
vi.mock('./deployment-stage-timeline.component', () => ({ DeploymentStageTimeline: () => null }));
vi.mock('./release-site-probe-evidence', () => ({
  ReleaseSiteProbeEvidence: () => <div>site-probe-evidence-rendered</div>,
}));

describe('DeploymentRunDetails copy', () => {
  it('localizes approval, risk and executor statuses without exposing raw codes', () => {
    const html = renderToStaticMarkup(<DeploymentRunDetails run={fixture()} />);

    expect(html).toContain('releaseApprovalStatusApproved');
    expect(html).toContain('riskHigh');
    expect(html).toContain('runStatusUnknown');
    expect(html).toContain('releaseEnvironmentStaging');
    expect(html).not.toContain('future_executor_status');
    expect(html).not.toContain('&quot;approved&quot;');
    expect(html).not.toContain('&quot;high&quot;');
  });

  it('renders the structured site probe evidence for runs carrying result.siteProbe (AC-SET-049 drill-down landing)', () => {
    const run = {
      ...fixture(),
      result: {
        siteProbe: {
          primaryDomain: 'demo.f437.example',
          dns: { status: 'resolved', checkedAt: '2026-08-06T18:27:00Z' },
          tls: { status: 'valid', checkedAt: '2026-08-06T18:27:00Z' },
          http: { status: 'passed', statusCode: 200, checkedAt: '2026-08-06T18:27:00Z' },
        },
        routeSwitch: { status: 'switched' },
      },
    };
    const html = renderToStaticMarkup(<DeploymentRunDetails run={run} />);
    expect(html).toContain('site-probe-evidence-rendered');
  });

  it('does not render the probe evidence section when the run has no siteProbe', () => {
    const html = renderToStaticMarkup(<DeploymentRunDetails run={fixture()} />);
    expect(html).not.toContain('site-probe-evidence-rendered');
  });
});

function fixture(): DeploymentRun {
  return {
    id: 'deployment-1',
    projectId: 'project-1',
    environment: 'staging',
    targetType: 'application',
    dryRun: false,
    source: 'manual',
    status: 'running',
    branch: 'main',
    commitSha: 'a'.repeat(40),
    commandPlan: null,
    error: null,
    startedAt: '2026-08-05T00:00:00Z',
    finishedAt: null,
    operationApproval: { id: 'approval-1', status: 'approved', risk: 'high' },
    serverExecutionJob: {
      id: 'job-1',
      status: 'future_executor_status',
      queueMode: 'serial',
      attempt: 1,
      maxAttempts: 3,
      queuedAt: '2026-08-05T00:00:00Z',
    },
  };
}
