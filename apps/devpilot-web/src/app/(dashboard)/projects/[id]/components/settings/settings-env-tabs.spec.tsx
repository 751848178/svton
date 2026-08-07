import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvProtectionTab } from './settings-env-protection-tab';
import { EnvResourcesTab } from './settings-env-resources-tab';
import { EnvRoutesTab } from './settings-env-routes-tab';
import { EnvTargetsTab } from './settings-env-targets-tab';
import { EnvVariablesTab } from './settings-env-variables-tab';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('@/components/ui', () => ({
  StatusTag: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock('../../hooks/use-environment-actions', () => ({
  useEnvironmentActions: () => ({
    acting: false,
    update: vi.fn(),
    archive: vi.fn(),
    bindServer: vi.fn(),
    unbindServer: vi.fn(),
  }),
}));
vi.mock('../environment-bind-server-block', () => ({
  BindServerBlock: () => <div>bind-server-block</div>,
}));
vi.mock('../environment-config-resource-editor', () => ({
  EnvironmentConfigResourceEditor: () => <div>resource-reference-editor</div>,
}));
vi.mock('../environment-env-vars-section', () => ({
  EnvironmentEnvVarsSection: () => <div>env-vars-section</div>,
}));
vi.mock('../environment-write-actions', () => ({
  EnvironmentWriteActions: () => <div>write-actions</div>,
}));
vi.mock('../environment-copy-panel', () => ({
  EnvironmentCopyPanel: () => <div>copy-panel</div>,
}));
vi.mock('../environment-sync-panel', () => ({
  EnvironmentSyncPanel: () => <div>sync-panel</div>,
}));

describe('settings environment subtab contents', () => {
  it('部署目标 lists bound servers, keeps bind actions in-project and links /servers', () => {
    const html = renderToStaticMarkup(
      <EnvTargetsTab environment={env()} detail={detail()} />,
    );

    expect(html).toContain('envTabTargets');
    expect(html).toContain('envTabHelperTargets');
    expect(html).toContain('stg-web');
    expect(html).toContain('10.0.0.1');
    expect(html).toContain('bind-server-block');
    expect(html).toContain('href="/servers?projectId=project-1"');
    expect(html).toContain('envModuleLinkServers');
  });

  it('资源绑定 shows resource counts, reference editor and /resource-instances link', () => {
    const html = renderToStaticMarkup(
      <EnvResourcesTab
        environment={env()}
        detail={detail()}
        resources={[]}
        onResourcesChange={() => undefined}
      />,
    );

    expect(html).toContain('envTabResources');
    expect(html).toContain('envTabHelperResources');
    expect(html).toContain('envCountServers');
    expect(html).toContain('resource-reference-editor');
    expect(html).toContain('href="/resource-instances?projectId=project-1"');
    expect(html).toContain('envModuleLinkResources');
  });

  it('变量与密钥 keeps env vars editing and secret references in-project, links /keys', () => {
    const html = renderToStaticMarkup(
      <EnvVariablesTab
        environment={env()}
        detail={detail()}
        secretIds={['s1']}
        onSecretIdsChange={() => undefined}
      />,
    );

    expect(html).toContain('envTabVariables');
    expect(html).toContain('envTabHelperVariables');
    expect(html).toContain('env-vars-section');
    expect(html).toContain('configSecretReferences');
    expect(html).toContain('DB_PASSWORD');
    expect(html).toContain('href="/keys?projectId=project-1&amp;environmentId=env-staging"');
    expect(html).toContain('envModuleLinkKeys');
  });

  it('域名与入口 shows the route snapshot editor and bound sites, links /sites', () => {
    const html = renderToStaticMarkup(
      <EnvRoutesTab
        environment={env()}
        detail={detail()}
        route={{
          domains: 'staging.picshare.example.com',
          dnsProvider: 'cloudflare',
          tlsRequired: true,
          proxyTarget: 'web:3000',
        }}
        onRouteChange={() => undefined}
      />,
    );

    expect(html).toContain('envTabRoutes');
    expect(html).toContain('envTabHelperRoutes');
    expect(html).toContain('configRouteSnapshot');
    expect(html).toContain('staging.picshare.example.com');
    expect(html).toContain('configTlsRequired');
    expect(html).toContain('envRoutesBoundSites');
    expect(html).toContain('picshare.example.com');
    expect(html).toContain(
      'href="/sites?projectId=project-1&amp;environmentId=env-staging"',
    );
    expect(html).toContain('envModuleLinkSites');
  });

  it('保护规则 shows policy references, identity lock and lifecycle actions, links /operation-approvals', () => {
    const html = renderToStaticMarkup(
      <EnvProtectionTab
        environment={env()}
        detail={detail()}
        policies={[{ id: 'p1', name: 'Production approval', effect: 'allow' }]}
        policyIds={['p1']}
        onPolicyIdsChange={() => undefined}
      />,
    );

    expect(html).toContain('envTabProtection');
    expect(html).toContain('envTabHelperProtection');
    expect(html).toContain('configPolicyReferences');
    expect(html).toContain('Production approval');
    expect(html).toContain('envIdentitySectionTitle');
    expect(html).toContain('staging');
    expect(html).toContain('envIdentityLocked');
    expect(html).toContain('write-actions');
    expect(html).toContain('copy-panel');
    expect(html).toContain('sync-panel');
    expect(html).toContain('href="/operation-approvals"');
    expect(html).toContain('envModuleLinkApprovals');
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
    _count: { serverBindings: 1, sites: 2, deploymentRuns: 5, managedResources: 1, resourceRequests: 0, resourceInstances: 2, cdnConfigs: 1, secretKeys: 1 },
  } as never;
}

function detail() {
  return {
    loading: false,
    error: '',
    project: {
      id: 'project-1',
      name: 'Picshare',
      environments: [env()],
      sites: [
        {
          id: 'site-1',
          name: 'Picshare staging',
          primaryDomain: 'picshare.example.com',
          runtimeType: 'static',
          status: 'active',
          environment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
        },
      ],
      secretKeys: [
        {
          id: 's1',
          name: 'DB_PASSWORD',
          type: 'vault',
          description: null,
          createdAt: '2026-07-01T00:00:00Z',
          environment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
        },
      ],
      resourceInstances: [],
      managedResources: [],
    },
    deploymentRuns: [],
    loadProject: vi.fn(),
  } as never;
}
