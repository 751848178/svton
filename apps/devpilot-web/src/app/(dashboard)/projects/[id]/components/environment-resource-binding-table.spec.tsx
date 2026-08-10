import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentResourceBindingTable } from './environment-resource-binding-table';
import type { Project, ProjectEnvironment } from '../types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));
vi.mock('../hooks/use-resource-connection-health', () => ({
  useResourceConnectionHealth: (projectId: string) => ({
    probes: projectId === 'project-error'
      ? {}
      : {
          'resource-1': { status: 'ok', at: '2026-07-01T00:00:00Z' },
          'resource-3': { status: 'failed', at: null },
        },
    loading: false,
    error: projectId === 'project-error' ? 'load failed' : '',
    reload: vi.fn(),
  }),
}));

describe('EnvironmentResourceBindingTable (AC-SET-025/029/032)', () => {
  it('renders the Demo 6-column table with bound instances from the revision references', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={env()}
        resources={[
          reference('resource-1', 'pg-shared', ['env-staging'], 'api'),
          reference('resource-2', 'redis-stg', ['env-staging', 'env-preview'], 'api / worker'),
        ]}
      />,
    );

    expect(html).toContain('envResourceTableRequirement');
    expect(html).toContain('envResourceTableSource');
    expect(html).toContain('envResourceTableBindingMethod');
    expect(html).toContain('envResourceTableInstance');
    expect(html).toContain('envResourceTableSharing');
    expect(html).toContain('envResourceTableValidation');
    expect(html).toContain('pg-shared');
    expect(html).toContain('redis-stg');
    expect(html).toContain('api / worker');
    expect(html).toContain('envResourceValidationValid');
  });

  it('shows explicit shared-scope and binding-method labels per row', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={env()}
        resources={[
          reference('resource-1', 'pg-shared', ['env-staging'], 'api'),
          reference('resource-2', 'redis-stg', ['env-staging', 'env-preview'], 'api / worker'),
        ]}
      />,
    );

    expect(html).toContain('envResourceSharingDedicated');
    expect(html).toContain('envResourceBindExisting');
    expect(html).toContain('envResourceSharingShared');
    expect(html).toContain('envResourceUseShared');
  });

  it('marks a production reference shared with non-production as forbidden with the anti-share label', () => {
    const production = env({ id: 'env-production', baselineRole: 'production' });
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={production}
        resources={[reference('resource-2', 'redis-prod', ['env-production', 'env-staging'], 'api')]}
      />,
    );

    expect(html).toContain('envResourceSharingProductionForced');
    expect(html).toContain('envResourceSharingProdForbidden');
    expect(html).toContain('envResourceValidationForbidden');
  });

  it('shows lifecycle status only for resource_instance rows (honest: no probes)', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={env()}
        resources={[reference('inst-1', 'pg-stg-instance', ['env-staging'], 'api', 'resource_instance')]}
      />,
    );

    expect(html).toContain('active');
    expect(html).not.toContain('envResourceHealthOk');
    expect(html).not.toContain('envResourceHealthNone');
  });

  it('wires real ManagedResource.status + connection probe reads per bound managed resource', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={env()}
        resources={[reference('resource-1', 'pg-shared', ['env-staging'], 'api')]}
      />,
    );

    expect(html).toContain('pg.internal:5432');
    expect(html).toContain('envResourceHealthOk');
    expect(html).toContain('envResourceHealthProbeAt');
  });

  it('shows honest unavailable connection status when probe reads fail', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project({ id: 'project-error' })}
        environment={env()}
        resources={[reference('resource-1', 'pg-shared', ['env-staging'], 'api')]}
      />,
    );

    expect(html).toContain('envResourceHealthUnavailable');
  });

  it('shows no connection probe label when no probe run exists for the resource', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={env()}
        resources={[reference('resource-2', 'redis-stg', ['env-staging'], 'worker')]}
      />,
    );

    expect(html).toContain('envResourceHealthNone');
  });

  it('renders an empty state and NO create/release affordance', () => {
    const html = renderToStaticMarkup(
      <EnvironmentResourceBindingTable project={project()} environment={env()} resources={[]} />,
    );
    expect(html).toContain('envResourceTableEmpty');
    const busy = renderToStaticMarkup(
      <EnvironmentResourceBindingTable
        project={project()}
        environment={env()}
        resources={[reference('resource-1', 'pg-shared', ['env-staging'], 'api')]}
      />,
    );
    expect(busy).not.toMatch(/create|release|申请|创建|释放/i);
    expect(busy).not.toContain('/resource-instances/create');
  });
});

function reference(
  id: string,
  name: string,
  sharedEnvironmentIds: string[],
  impact: string,
  kind: 'managed_resource' | 'resource_instance' = 'managed_resource',
) {
  return {
    kind, id, name, sharedEnvironmentIds,
    risk: (sharedEnvironmentIds.length > 1 ? 'medium' : 'low') as 'medium' | 'low',
    impact,
  };
}

function env(overrides: Partial<ProjectEnvironment> = {}): ProjectEnvironment {
  return {
    id: 'env-staging',
    key: 'staging',
    name: 'Staging',
    status: 'active',
    sortOrder: 1,
    baselineRole: 'staging',
    identityLockedAt: null,
    currentConfigRevisionId: 'rev-1',
    serverBindings: [],
    _count: { serverBindings: 0, sites: 0, deploymentRuns: 0, managedResources: 3, resourceRequests: 0, resourceInstances: 1, cdnConfigs: 0, secretKeys: 0 },
    ...overrides,
  } as ProjectEnvironment;
}

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: 'project-1',
    name: 'Picshare',
    description: null,
    gitRepo: null,
    downloadUrl: null,
    config: null,
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    environments: [
      env(),
      env({ id: 'env-preview', key: 'preview', name: 'Preview', baselineRole: null }),
      env({ id: 'env-production', key: 'production', name: 'Production', baselineRole: 'production' }),
    ],
    managedResources: [
      {
        id: 'resource-1', sourceType: 'instance', provider: 'aws', kind: 'postgres',
        name: 'pg-shared', externalId: 'x-1', status: 'active', endpoint: 'pg.internal:5432',
        environment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
      },
      {
        id: 'resource-2', sourceType: 'instance', provider: 'aws', kind: 'redis',
        name: 'redis-stg', externalId: 'x-2', status: 'active', endpoint: null, lastSyncAt: null,
        environment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
      },
      {
        id: 'resource-3', sourceType: 'instance', provider: 'aws', kind: 'elasticsearch',
        name: 'es-shared', externalId: 'x-3', status: 'active', endpoint: null, lastSyncAt: null,
        environment: { id: 'env-preview', key: 'preview', name: 'Preview', status: 'active' },
      },
    ],
    resourceInstances: [
      {
        id: 'inst-1', name: 'pg-stg-instance', status: 'active', expiresAt: null,
        createdAt: '2026-07-01T00:00:00Z',
        projectEnvironment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
        resourceType: { id: 'rt-1', key: 'postgres', name: 'PostgreSQL', category: 'database', envTemplate: 'DATABASE_URL=${url}\n' },
        request: null,
      },
    ],
    sites: [],
    cdnConfigs: [],
    ...overrides,
  } as Project;
}
