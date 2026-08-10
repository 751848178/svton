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
  Modal: ({ open }: { open: boolean }) => (open ? <div>modal-open</div> : null),
  Select: () => <div>select</div>,
}));
vi.mock('@svton/ui', () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Modal: ({ open }: { open: boolean }) => (open ? <div>modal-open</div> : null),
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
vi.mock('../../hooks/use-environment-deployment-targets', () => ({
  useEnvironmentDeploymentTargets: () => ({
    data: null,
    loading: true,
    error: '',
    reload: vi.fn(),
  }),
}));
vi.mock('../environment-bind-server-block', () => ({
  BindServerBlock: () => <div>bind-server-block</div>,
}));
vi.mock('../environment-config-resource-editor', () => ({
  EnvironmentConfigResourceEditor: () => <div>resource-reference-editor</div>,
}));
vi.mock('../../hooks/use-resource-connection-health', () => ({
  useResourceConnectionHealth: () => ({
    probes: { 'resource-1': { status: 'ok', at: '2026-07-01T00:00:00Z' } },
    loading: false,
    error: '',
    reload: vi.fn(),
  }),
}));
vi.mock('../../hooks/use-resource-instance-injections', () => ({
  useResourceInstanceInjections: () => [
    { key: 'DATABASE_URL', label: 'PostgreSQL / pg-shared-nonprod' },
  ],
}));
vi.mock('../environment-env-vars-section', () => ({
  EnvironmentEnvVarsSection: () => <div>env-vars-section</div>,
}));
vi.mock('../environment-plain-vars-editor', () => ({
  EnvironmentPlainVarsEditor: () => <div>plain-vars-editor</div>,
}));
vi.mock('../environment-env-import-modal', () => ({
  EnvironmentEnvImportModal: () => <div>env-import-modal</div>,
}));
vi.mock('../environment-env-review-modal', () => ({
  EnvironmentEnvReviewModal: () => <div>env-review-modal</div>,
}));
vi.mock('../environment-staged-banner', () => ({
  EnvironmentStagedBanner: () => <div>staged-banner</div>,
}));
vi.mock('../environment-env-copy-dialog', () => ({
  EnvironmentEnvCopyDialog: () => <div>env-copy-dialog</div>,
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
  it('部署目标 shows the Demo table with the provider-matched current target and badge', () => {
    const html = renderToStaticMarkup(
      <EnvTargetsTab environment={env()} detail={detail()} targets={targets()} />,
    );

    expect(html).toContain('envTabTargets');
    expect(html).toContain('envTabHelperTargets');
    expect(html).toContain('envTargetTableComponent');
    expect(html).toContain('envTargetTableRunTarget');
    expect(html).toContain('envTargetTableRegionNamespace');
    expect(html).toContain('envTargetTableScale');
    expect(html).toContain('envTargetTableStatus');
    expect(html).toContain('stg-web');
    expect(html).toContain('10.0.0.1');
    expect(html).toContain('ssh://deploy@10.0.0.1:22/srv/app');
    expect(html).toContain('envTargetCurrentBadge');
    expect(html).toContain('envTargetAdjust');
    expect(html).toContain('envTargetIsolationDefault');
    expect(html).toContain('envTargetVersionHashLabel');
    expect(html).toContain('envTargetStatusOnline');
    expect(html).toContain('bind-server-block');
    expect(html).toContain('href="/servers?projectId=project-1"');
    expect(html).toContain('envModuleLinkServers');
  });

  it('资源绑定 shows resource counts, frozen revision badge, reference editor and /resource-instances link', () => {
    const html = renderToStaticMarkup(
      <EnvResourcesTab
        environment={env()}
        detail={detail()}
        resources={[]}
        onResourcesChange={() => undefined}
        revision={revision()}
      />,
    );

    expect(html).toContain('envTabResources');
    expect(html).toContain('envTabHelperResources');
    expect(html).toContain('envCountServers');
    expect(html).toContain('envResourceFrozenRevision');
    expect(html).toContain('envResourceTableEmpty');
    expect(html).toContain('envResourceCalloutOwnership');
    expect(html).toContain('envResourceCalloutFrozen');
    expect(html).toContain('resource-reference-editor');
    expect(html).toContain('href="/resource-instances?projectId=project-1"');
    expect(html).toContain('envModuleLinkResources');
  });

  it('资源绑定 renders the Demo 6-column table from the frozen revision refs with shared scope and health', () => {
    const html = renderToStaticMarkup(
      <EnvResourcesTab
        environment={env()}
        detail={detail()}
        resources={[
          {
            kind: 'managed_resource', id: 'resource-1', name: 'pg-shared',
            sharedEnvironmentIds: ['env-staging', 'env-preview'], risk: 'medium', impact: 'api',
          },
        ]}
        onResourcesChange={() => undefined}
        revision={revision()}
      />,
    );

    expect(html).toContain('envResourceTableRequirement');
    expect(html).toContain('envResourceTableSource');
    expect(html).toContain('envResourceTableBindingMethod');
    expect(html).toContain('envResourceTableInstance');
    expect(html).toContain('envResourceTableSharing');
    expect(html).toContain('envResourceTableValidation');
    expect(html).toContain('pg-shared');
    expect(html).toContain('api');
    expect(html).toContain('envResourceSharingShared');
    expect(html).toContain('envResourceUseShared');
    expect(html).toContain('envResourceHealthOk');
    expect(html).toContain('envResourceValidationValid');
    expect(html).not.toMatch(/申请|创建云资源|release/i);
    expect(html).not.toContain('/resource-instances/create');
  });

  it('变量与密钥 shows the Demo 6-column table, snapshot callout, secret refs masked, history and /keys link', () => {
    const html = renderToStaticMarkup(
      <EnvVariablesTab
        environment={env()}
        detail={detail()}
        secretIds={['s1']}
        onSecretIdsChange={() => undefined}
        revision={revision()}
        revisions={[revision()]}
        environments={[env()]}
      />,
    );

    expect(html).toContain('envTabVariables');
    expect(html).toContain('envTabHelperVariables');
    expect(html).toContain('envVarsSnapshotCallout');
    expect(html).toContain('envVarsTableTitle');
    expect(html).toContain('envVarsCurrentBadge');
    expect(html).toContain('envVarsTableKey');
    expect(html).toContain('envVarsTableScope');
    expect(html).toContain('envVarsTableSource');
    expect(html).toContain('envVarsTableValue');
    expect(html).toContain('envVarsTableRequirement');
    expect(html).toContain('envVarsTableValidation');
    expect(html).toContain('envVarsSourcePlain');
    expect(html).toContain('envVarsSourceSecret');
    expect(html).toContain('envVarsSourceResource');
    expect(html).toContain('vault://DB_PASSWORD@');
    expect(html).toContain('••••••••');
    expect(html).toContain('configSecretReferences');
    expect(html).toContain('envVarsCopyButton');
    expect(html).toContain('configRevisionHistoryTitle');
    expect(html).toContain('href="/keys?projectId=project-1&amp;environmentId=env-staging"');
    expect(html).toContain('envModuleLinkKeys');
    expect(html).not.toMatch(/s3cr3t|plaintext/i);
  });

  it('域名与入口 shows the Demo 6-column table with per-domain rows, DNS/TLS columns, badge and callouts', () => {
    const html = renderToStaticMarkup(
      <EnvRoutesTab
        environment={env()}
        detail={detail()}
        route={{
          domains: 'staging.picshare.example.com',
          dnsProvider: 'cloudflare',
          tlsRequired: true,
          proxyTarget: 'web:3000',
          entries: [
            { domain: 'staging.picshare.example.com', path: '/', component: 'web', port: 3000, tlsMode: 'managed_cert' },
          ],
        }}
        onRouteChange={() => undefined}
        revision={revision()}
      />,
    );

    expect(html).toContain('envTabRoutes');
    expect(html).toContain('envTabHelperRoutes');
    expect(html).toContain('envRoutesTitle');
    expect(html).toContain('envRoutesCurrentBadge');
    expect(html).toContain('envRoutesAddEntry');
    expect(html).toContain('envRoutesTableDomain');
    expect(html).toContain('envRoutesTablePath');
    expect(html).toContain('envRoutesTableComponent');
    expect(html).toContain('envRoutesTableTls');
    expect(html).toContain('envRoutesTableDns');
    expect(html).toContain('envRoutesTableProbe');
    expect(html).toContain('staging.picshare.example.com');
    expect(html).toContain('web : 3000');
    expect(html).toContain('envRoutesDnsUnavailable');
    expect(html).toContain('envRoutesTlsUnavailable');
    expect(html).toContain('envRoutesCalloutOwnership');
    expect(html).toContain('envRoutesCalloutFrozen');
    expect(html).toContain('envRoutesReadinessLabel');
    expect(html).toContain('envRoutesGateUnavailable');
    expect(html).toContain('envRoutesBoundSites');
    expect(html).toContain('picshare.example.com');
    expect(html).toContain(
      'href="/sites?projectId=project-1&amp;environmentId=env-staging"',
    );
    expect(html).toContain('envModuleLinkSites');
  });

  it('域名与入口 renders real DNS/TLS/probe states and the drill-down link from site + run evidence', () => {
    const html = renderToStaticMarkup(
      <EnvRoutesTab
        environment={env()}
        detail={detail()}
        route={{
          domains: 'demo.f437.example',
          dnsProvider: '',
          tlsRequired: true,
          proxyTarget: 'web:3000',
          entries: [
            { domain: 'demo.f437.example', path: '/', component: 'web', port: 3000, tlsMode: 'managed_cert' },
          ],
        }}
        onRouteChange={() => undefined}
        revision={revision()}
        deploymentRuns={[
          {
            id: 'run-1',
            projectId: 'project-1',
            environment: null,
            targetType: 'release',
            dryRun: false,
            source: 'release_order',
            status: 'completed',
            branch: null,
            commitSha: null,
            commandPlan: {},
            error: null,
            startedAt: '2026-08-06T18:27:00.000Z',
            finishedAt: '2026-08-06T18:28:00.000Z',
            result: {
              siteProbe: {
                primaryDomain: 'demo.f437.example',
                dns: { status: 'resolved', checkedAt: '2026-08-06T18:27:00.000Z' },
                tls: { status: 'valid', checkedAt: '2026-08-06T18:27:00.000Z' },
                http: { status: 'passed', statusCode: 200, checkedAt: '2026-08-06T18:27:00.000Z' },
              },
              routeSwitch: { status: 'switched' },
            },
          },
        ]}
      />,
    );

    expect(html).toContain('envRoutesDnsActive');
    expect(html).toContain('envRoutesTlsValid');
    expect(html).toContain('envRoutesProbeHttp');
    expect(html).toContain('200');
    expect(html).toContain('envRoutesGateReady');
    expect(html).toContain(
      'href="/projects/project-1?view=deployments&amp;runId=run-1"',
    );
    expect(html).toContain('envRoutesEvidenceLink');
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

  it('保护规则 identity lock label follows the server rule: any DeploymentRun locks', () => {
    const runLocked = renderToStaticMarkup(
      <EnvProtectionTab
        environment={{
          id: 'env-staging',
          key: 'staging',
          name: 'Staging',
          status: 'active',
          sortOrder: 1,
          baselineRole: 'staging',
          identityLockedAt: null,
          currentConfigRevisionId: 'rev-3',
          serverBindings: [],
          _count: { serverBindings: 1, sites: 2, deploymentRuns: 3, managedResources: 1, resourceRequests: 0, resourceInstances: 2, cdnConfigs: 1, secretKeys: 1 },
        } as never}
        detail={detail()}
        policies={[]}
        policyIds={[]}
        onPolicyIdsChange={() => undefined}
      />,
    );
    expect(runLocked).toContain('envIdentityLocked');
    expect(runLocked).not.toContain('envIdentityUnlocked');

    const unlocked = renderToStaticMarkup(
      <EnvProtectionTab
        environment={{
          id: 'env-staging',
          key: 'staging',
          name: 'Staging',
          status: 'active',
          sortOrder: 1,
          baselineRole: 'staging',
          identityLockedAt: null,
          currentConfigRevisionId: 'rev-3',
          serverBindings: [],
          _count: { serverBindings: 1, sites: 2, deploymentRuns: 0, managedResources: 1, resourceRequests: 0, resourceInstances: 2, cdnConfigs: 1, secretKeys: 1 },
        } as never}
        detail={detail()}
        policies={[]}
        policyIds={[]}
        onPolicyIdsChange={() => undefined}
      />,
    );
    expect(unlocked).toContain('envIdentityUnlocked');
    expect(unlocked).not.toContain('envIdentityLocked');
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
    config: {
      envVars: {
        NODE_ENV: 'production',
        PUBLIC_SITE_URL: 'https://staging.picshare.example.com',
      },
    },
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
        {
          id: 'site-2',
          name: 'F437 demo site',
          primaryDomain: 'demo.f437.example',
          runtimeType: 'reverse_proxy',
          status: 'active',
          lastSyncAt: '2026-08-06T18:27:00.000Z',
          dns: {
            status: 'resolved',
            records: ['198.18.11.9'],
            hostname: 'demo.f437.example',
            checkedAt: '2026-08-06T18:27:00.000Z',
          },
          tls: {
            status: 'valid',
            expiresAt: '2026-09-07T00:00:00.000Z',
            probe: {
              status: 'valid',
              host: 'demo.f437.example',
              port: 443,
              checkedAt: '2026-08-06T18:27:00.000Z',
            },
          },
          routeSwitch: {
            status: 'switched',
            domains: ['demo.f437.example'],
            releaseRunId: 'release-1',
            deploymentRunId: 'run-1',
            switchedAt: '2026-08-06T18:27:00.000Z',
          },
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
      resourceInstances: [
        {
          id: 'ri-1',
          name: 'pg-shared-nonprod',
          status: 'active',
          projectEnvironment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
          resourceType: {
            key: 'postgres',
            name: 'PostgreSQL',
            envTemplate: 'DATABASE_URL=postgres://shared/db',
          },
        },
      ],
      managedResources: [
        {
          id: 'resource-1', sourceType: 'instance', provider: 'aws', kind: 'postgres',
          name: 'pg-shared', externalId: 'x-1', status: 'active', endpoint: 'pg.internal:5432',
          environment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
        },
      ],
    },
    deploymentRuns: [],
    loadProject: vi.fn(),
  } as never;
}

function revision() {
  return {
    id: 'rev-3',
    revision: 3,
    snapshotHash: 'abcd1234'.repeat(8),
    plainVariables: {},
    secretReferences: [],
    resourceReferences: [
      {
        kind: 'resource_instance',
        id: 'ri-1',
        name: 'pg-shared-nonprod',
        sharedEnvironmentIds: ['env-staging'],
        risk: 'medium',
        impact: 'api',
      },
    ],
    routeSnapshot: {},
    policyReferences: [],
    source: 'project_management',
    createdAt: '2026-07-01T00:00:00Z',
    current: true,
  } as never;
}

function targets() {
  return {
    data: {
      providerKey: 'ssh-v1',
      currentTarget: {
        bindingId: 'b1',
        serverId: 'server-1',
        providerKey: 'ssh-v1',
        targetRef: 'ssh://deploy@10.0.0.1:22/srv/app',
        root: '/srv/app',
        server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'online' },
        sharedEnvironmentIds: [],
        versionHash: 'a'.repeat(64),
      },
      bindings: [
        {
          id: 'b1',
          role: 'deploy',
          status: 'active',
          createdAt: '2026-07-01T00:00:00Z',
          updatedAt: '2026-07-01T00:00:00Z',
          providerKey: 'ssh-v1',
          sharedEnvironmentIds: [],
          metadata: { releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/app' } },
          server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'online' },
        },
      ],
    },
    loading: false,
    error: '',
    reload: vi.fn(),
  } as never;
}
