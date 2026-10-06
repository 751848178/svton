import { describe, expect, it } from 'vitest';
import type { Site } from '@/app/(dashboard)/sites/types';
import {
  buildDomainRevisionDraft,
  buildProjectDomainTargets,
  domainExists,
  initialDomainWorkflowForm,
  selectProjectDomainEnvironments,
} from './project-domain-workflow.model';

const site = {
  id: 'site-1', name: 'web', primaryDomain: 'app.example.com', aliases: [],
  runtimeType: 'reverse_proxy', runtimeConfig: null, tls: null, accessPolicy: null,
  status: 'pending', lastSyncAt: null, syncError: null, createdAt: '2026-08-27T00:00:00Z',
} as Site;

describe('project domain workflow model', () => {
  it('only offers active services in the locked environment with real ports', () => {
    const targets = buildProjectDomainTargets([{ id: 'app-1', name: 'App', services: [
      { id: 'svc-1', name: 'web', kind: 'container', status: 'active', ports: ['3000:8080'],
        environment: { id: 'env-1', key: 'staging', name: 'Staging', status: 'active' } },
      { id: 'svc-2', name: 'old', kind: 'container', status: 'archived', ports: [9000],
        environment: { id: 'env-1', key: 'staging', name: 'Staging', status: 'active' } },
    ] }], 'env-1');
    expect(targets).toMatchObject([{ applicationId: 'app-1', serviceId: 'svc-1', port: 8080 }]);
  });

  it('preserves sibling revision facts and replaces the edited domain entry', () => {
    const current = {
      id: 'rev-1', revision: 1, snapshotHash: 'hash', plainVariables: {},
      secretReferences: [], resourceReferences: [], policyReferences: [], source: 'test',
      createdAt: '2026-08-27T00:00:00Z', current: true,
      routeSnapshot: { dnsProvider: 'cloudflare', entries: [
        { domain: 'app.example.com', path: '/', component: 'old', port: 3000, tlsMode: 'none' as const },
        { domain: 'api.example.com', path: '/api', component: 'api', port: 4000, tlsMode: 'managed_cert' as const },
      ] },
    };
    const draft = buildDomainRevisionDraft({
      current,
      originalDomain: 'app.example.com',
      target: { key: 'a:s:8080', applicationId: 'a', serviceId: 's', component: 'web',
        port: 8080, serverId: null, serverLabel: null, siteId: 'site-1' },
      form: { targetKey: 'a:s:8080', path: 'web', name: 'web',
        primaryDomain: 'www.example.com', aliases: '', tlsMode: 'managed_cert', changeReason: '更新入口' },
    });
    expect(draft.routeSnapshot).toMatchObject({ dnsProvider: 'cloudflare', tlsRequired: true });
    expect((draft.routeSnapshot.entries as unknown[])).toHaveLength(2);
    expect(draft.routeSnapshot.entries).toContainEqual(expect.objectContaining({
      domain: 'www.example.com', path: '/web', serviceId: 's', port: 8080,
    }));
  });

  it('locks edit target to the service already bound to the site', () => {
    const form = initialDomainWorkflowForm({
      site,
      targets: [{ key: 'a:s:3000', applicationId: 'a', serviceId: 's', component: 'web',
        port: 3000, serverId: null, serverLabel: null, siteId: 'site-1' }],
      revision: null,
    });
    expect(form.targetKey).toBe('a:s:3000');
    expect(domainExists([site], 'APP.EXAMPLE.COM', site.id)).toBe(false);
  });

  it('keeps an active environment reachable when a real Site references it', () => {
    const seed = {
      source: 'project_config',
      initializedBy: 'ProjectEnvironmentService.ensureDefaultsForProject',
    };
    const environments = [
      { id: 'dev', key: 'dev', name: 'Dev', status: 'active', sortOrder: 1, config: seed,
        _count: { serverBindings: 0, sites: 0, deploymentRuns: 1, managedResources: 0,
          resourceRequests: 0, resourceInstances: 0, cdnConfigs: 0, secretKeys: 0 } },
      { id: 'production', key: 'production', name: 'Production', status: 'active', sortOrder: 2, config: seed },
      { id: 'unused', key: 'unused', name: 'Unused', status: 'active', sortOrder: 3, config: seed },
    ];
    const selected = selectProjectDomainEnvironments(environments, [
      { ...site, environment: { id: 'production', key: 'production', name: 'Production', status: 'active' } },
    ]);
    expect(selected.map((item) => item.id)).toEqual(['dev', 'production']);
  });
});
