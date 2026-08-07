/**
 * F445 focused Web spec: env-summary 部署目标 fact shows the provider-matched
 * CURRENT target summary instead of a bare count (AC-SET-017/023).
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentSettingsSummary } from './environment-settings-summary';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

describe('EnvironmentSettingsSummary target fact (F445)', () => {
  it('shows the provider-matched current target summary when resolved', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsSummary
        environment={env()}
        revision={null}
        policyCount={0}
        deploymentRunCount={2}
        versionsHref="/projects/p1/delivery?view=environment-versions"
        deploymentsHref="/projects/p1/delivery?view=deployments"
        currentTarget={{
          bindingId: 'b1',
          serverId: 'server-1',
          providerKey: 'ssh-v1',
          targetRef: 'ssh://deploy@10.0.0.1:22/srv/app',
          root: '/srv/app',
          server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'online' },
          sharedEnvironmentIds: [],
          versionHash: 'a'.repeat(64),
        }}
      />,
    );

    expect(html).toContain('envSummaryTarget');
    expect(html).toContain('envSummaryTargetActive');
    expect(html).not.toContain('envSummaryTargetValue');
  });

  it('falls back to the bound count when no current target is resolved', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsSummary
        environment={env()}
        revision={null}
        policyCount={0}
        deploymentRunCount={0}
        versionsHref="/projects/p1/delivery?view=environment-versions"
        deploymentsHref="/projects/p1/delivery?view=deployments"
        currentTarget={null}
      />,
    );

    expect(html).toContain('envSummaryTargetValue');
    expect(html).not.toContain('envSummaryTargetActive');
  });
});

describe('EnvironmentSettingsSummary revision strip detail (F447 AC-SET-039)', () => {
  it('shows revision, source, time, change summary and createdBy together', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsSummary
        environment={env()}
        revision={{
          id: 'rev-3',
          revision: 3,
          snapshotHash: 'abcd'.repeat(16),
          plainVariables: {},
          secretReferences: [],
          resourceReferences: [],
          routeSnapshot: {},
          policyReferences: [],
          source: 'project_management',
          createdAt: '2026-07-01T00:00:00Z',
          current: true,
          changeSummary: '导入 DATABASE_URL 并绑定数据库',
          createdBy: { id: 'user-1', name: '张三', email: 'zhang@example.com' },
        }}
        policyCount={0}
        deploymentRunCount={0}
        versionsHref="/projects/p1/delivery?view=environment-versions"
        deploymentsHref="/projects/p1/delivery?view=deployments"
        currentTarget={null}
      />,
    );

    expect(html).toContain('configRevisionStripLabel');
    expect(html).toContain('R3');
    expect(html).toContain('project_management');
    expect(html).toContain('导入 DATABASE_URL 并绑定数据库');
    expect(html).toContain('张三');
  });

  it('renders honest placeholders when the revision has no summary or creator name', () => {
    const html = renderToStaticMarkup(
      <EnvironmentSettingsSummary
        environment={env()}
        revision={{
          id: 'rev-3',
          revision: 3,
          snapshotHash: 'abcd'.repeat(16),
          plainVariables: {},
          secretReferences: [],
          resourceReferences: [],
          routeSnapshot: {},
          policyReferences: [],
          source: 'project_intake',
          createdAt: '2026-07-01T00:00:00Z',
          current: true,
        }}
        policyCount={0}
        deploymentRunCount={0}
        versionsHref="/projects/p1/delivery?view=environment-versions"
        deploymentsHref="/projects/p1/delivery?view=deployments"
        currentTarget={null}
      />,
    );

    expect(html).toContain('configRevisionNoSummary');
    expect(html).toContain('project_intake');
  });
});

function env() {
  return {
    id: 'env-staging',
    key: 'staging',
    name: 'Staging',
    status: 'active',
    sortOrder: 1,
    baselineRole: 'staging',
    identityLockedAt: '2026-07-01T00:00:00Z',
    currentConfigRevisionId: 'rev-3',
    serverBindings: [
      { id: 'b1', role: 'deploy', server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'active' } },
    ],
    _count: { serverBindings: 1, sites: 0, deploymentRuns: 2, managedResources: 0, resourceRequests: 0, resourceInstances: 0, cdnConfigs: 0, secretKeys: 0 },
  } as never;
}
