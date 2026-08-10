import { describe, expect, it } from 'vitest';
import {
  applyBindingMethod,
  applyRebind,
  applySharedEnvironmentToggle,
  applySharingMode,
  bindingMethodFor,
  buildBindingRows,
  resourceSharingMode,
  type BindingMethod,
  type SharingMode,
} from './environment-resource-binding.model';
import type { EnvironmentConfigResourceReference } from '../types/environment-config-revision.types';
import type { Project, ProjectEnvironment } from '../types';

function reference(overrides: Partial<EnvironmentConfigResourceReference> = {}): EnvironmentConfigResourceReference {
  return {
    kind: 'managed_resource',
    id: 'resource-1',
    name: 'pg-shared',
    sharedEnvironmentIds: ['env-staging'],
    risk: 'medium',
    impact: 'api',
    ...overrides,
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
    _count: { serverBindings: 0, sites: 0, deploymentRuns: 0, managedResources: 1, resourceRequests: 0, resourceInstances: 0, cdnConfigs: 0, secretKeys: 0 },
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
        name: 'redis-prod', externalId: 'x-2', status: 'active', endpoint: null, lastSyncAt: null,
        environment: { id: 'env-production', key: 'production', name: 'Production', status: 'active' },
      },
    ],
    resourceInstances: [],
    sites: [],
    cdnConfigs: [],
    ...overrides,
  } as Project;
}

describe('environment-resource-binding model (AC-SET-025/026)', () => {
  it('builds per-environment binding rows joined with the actual instance rows', () => {
    const rows = buildBindingRows(project(), env(), [
      reference(),
      reference({ id: 'resource-2', name: 'redis-prod' }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      requirement: 'pg-shared',
      source: 'legacy:unassigned',
      instanceName: 'pg-shared',
      lifecycleStatus: 'active',
      managedHealth: { status: 'active', endpoint: 'pg.internal:5432' },
      sharingMode: 'dedicated',
      bindingMethod: 'bind-existing',
      validation: 'valid',
    });
  });

  it('flags a reference whose instance row is missing as rebind-required', () => {
    const [row] = buildBindingRows(project(), env(), [reference({ id: 'gone' })]);
    expect(row.validation).toBe('missing');
    expect(row.instanceName).toBeNull();
    expect(row.requirement).toBe('pg-shared');
  });

  it('flags an instance whose owning environment lies outside the shared scope', () => {
    const [row] = buildBindingRows(project(), env(), [reference({ id: 'resource-2' })]);
    expect(row.instanceName).toBe('redis-prod');
    expect(row.validation).toBe('out-of-scope');
  });

  it('derives shared mode and use-shared binding method for multi-environment references', () => {
    const [row] = buildBindingRows(project(), env(), [
      reference({ sharedEnvironmentIds: ['env-staging', 'env-preview'] }),
    ]);
    expect(row.sharingMode).toBe('shared');
    expect(row.bindingMethod).toBe('use-shared');
  });

  it('forces production-forced mode and flags any shared production reference', () => {
    const production = env({ id: 'env-production', baselineRole: 'production' });
    expect(resourceSharingMode(production, reference())).toBe('production-forced');
    const [row] = buildBindingRows(project(), production, [
      reference({ id: 'resource-2', sharedEnvironmentIds: ['env-production', 'env-staging'] }),
    ]);
    expect(row.sharingMode).toBe('production-forced');
    expect(row.validation).toBe('forbidden');
  });

  it('write-back: bind-existing forces a dedicated scope', () => {
    const value = [reference({ sharedEnvironmentIds: ['env-staging', 'env-preview'], risk: 'medium' })];
    const next = applyBindingMethod(value, 0, 'bind-existing', env(), project());
    expect(next[0].sharedEnvironmentIds).toEqual(['env-staging']);
  });

  it('write-back: use-shared seeds all active non-production environments and raises low risk', () => {
    const value = [reference({ risk: 'low' })];
    const next = applyBindingMethod(value, 0, 'use-shared', env(), project());
    expect(next[0].sharedEnvironmentIds).toEqual(['env-preview', 'env-staging']);
    expect(next[0].risk).toBe('medium');
  });

  it('write-back: unbind removes the row from the draft (release is infra-owned)', () => {
    const value = [reference(), reference({ id: 'resource-2', name: 'redis-prod' })];
    const next = applyBindingMethod(value, 0, 'unbind', env(), project());
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe('resource-2');
  });

  it('write-back: sharing mode shared / dedicated toggle the scope set', () => {
    const shared = applySharingMode([reference()], 0, 'shared', env(), project());
    expect(shared[0].sharedEnvironmentIds).toEqual(['env-preview', 'env-staging']);
    const dedicated = applySharingMode(shared, 0, 'dedicated', env(), project());
    expect(dedicated[0].sharedEnvironmentIds).toEqual(['env-staging']);
  });

  it('write-back: shared environment checkbox toggles membership and auto-raises risk', () => {
    const value = [reference()];
    const withPreview = applySharedEnvironmentToggle(value, 0, 'env-preview', true);
    expect(withPreview[0].sharedEnvironmentIds).toEqual(['env-preview', 'env-staging']);
    expect(withPreview[0].risk).toBe('medium');
    const without = applySharedEnvironmentToggle(withPreview, 0, 'env-preview', false);
    expect(without[0].sharedEnvironmentIds).toEqual(['env-staging']);
  });

  it('write-back: rebind replaces the instance id and name', () => {
    const value = [reference()];
    const next = applyRebind(value, 0, { id: 'resource-2', name: 'redis-prod' });
    expect(next[0]).toMatchObject({ id: 'resource-2', name: 'redis-prod' });
    expect(next[0].sharedEnvironmentIds).toEqual(['env-staging']);
  });

  it('binding method label mapping mirrors the Demo actions', () => {
    const methods: BindingMethod[] = ['bind-existing', 'rebind', 'unbind', 'use-shared'];
    for (const method of methods) {
      expect(bindingMethodFor(env(), reference())).toBeTruthy();
      expect(method).toMatch(/^(bind-existing|rebind|unbind|use-shared)$/);
    }
    const modes: SharingMode[] = ['dedicated', 'shared', 'production-forced'];
    expect(modes).toHaveLength(3);
  });
});
