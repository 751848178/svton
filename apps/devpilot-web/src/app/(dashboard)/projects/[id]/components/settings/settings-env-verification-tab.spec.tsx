import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvVerificationTab } from './settings-env-verification-tab';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('./settings-subtab-shell', () => ({
  SubtabShell: ({ actions, children }: { actions?: React.ReactNode; children: React.ReactNode }) => (
    <section>{actions}{children}</section>
  ),
}));
vi.mock('./settings-observability-modal', () => ({
  SettingsObservabilityModal: () => <button type="button">observability-editor</button>,
}));

describe('EnvVerificationTab', () => {
  it('renders persisted rules, probe results, timestamps, and deployment evidence links', () => {
    const html = renderToStaticMarkup(
      <EnvVerificationTab
        projectId="project-1"
        value="local_acceptance_v1"
        onChange={vi.fn()}
        environment={{ id: 'env-prod', key: 'production', name: '生产环境' } as never}
        sites={[{
          id: 'site-1',
          name: 'Picshare',
          primaryDomain: 'picshare.example.com',
          runtimeType: 'reverse_proxy',
          status: 'active',
          environment: { id: 'env-prod' },
        } as never]}
        deploymentRuns={[{
          id: 'run-1',
          projectId: 'project-1',
          environment: 'production',
          projectEnvironment: { id: 'env-prod' },
          startedAt: '2026-08-27T08:00:00Z',
          result: {
            siteProbe: {
              primaryDomain: 'picshare.example.com',
              http: { status: 'passed', statusCode: 200, checkedAt: '2026-08-27T08:00:30Z' },
            },
          },
        } as never]}
        revision={{
          revision: 7,
          observabilitySnapshot: {
            profile: 'local_acceptance_v1',
            metrics: 'local-health-probe-v1',
            logs: 'local-runtime-logs-v1',
          },
        } as never}
        evidenceError=""
        onRetryEvidence={vi.fn()}
      />,
    );
    expect(html).toContain('environmentVerificationLocalWarning');
    expect(html).toContain('local-health-probe-v1');
    expect(html).toContain('picshare.example.com');
    expect(html).toContain('environmentVerificationResultPassed');
    expect(html).toContain('/projects/project-1/deployments?runId=run-1');
  });

  it('renders an honest unavailable state and a contextual retry when run evidence fails', () => {
    const html = renderToStaticMarkup(
      <EnvVerificationTab
        projectId="project-1"
        value=""
        onChange={vi.fn()}
        environment={{ id: 'env-prod', key: 'production', name: '生产环境' } as never}
        sites={[]}
        deploymentRuns={[]}
        revision={null}
        evidenceError="network failed"
        onRetryEvidence={vi.fn()}
      />,
    );
    expect(html).toContain('environmentVerificationLoadFailed');
    expect(html).toContain('environmentVerificationRetry');
    expect(html).toContain('environmentVerificationResultUnconfigured');
    expect(html).not.toContain('environmentVerificationResultPassed');
  });
});
