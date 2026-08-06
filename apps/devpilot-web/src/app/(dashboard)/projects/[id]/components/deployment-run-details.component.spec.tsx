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
