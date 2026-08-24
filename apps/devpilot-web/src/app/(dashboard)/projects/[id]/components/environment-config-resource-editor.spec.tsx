import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentConfigResourceEditor } from './environment-config-resource-editor';
import type { Project, ProjectEnvironment } from '../types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@svton/ui', () => ({
  Input: (props: Record<string, unknown>) => <input {...props} />,
  Select: (props: Record<string, unknown>) => <select {...(props as object)}>{(props as { children?: React.ReactNode }).children}</select>,
  Textarea: (props: Record<string, unknown>) => <textarea {...props} />,
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Modal: () => null,
}));

describe('EnvironmentConfigResourceEditor (AC-SET-026 selectors)', () => {
  it('renders the add-candidate bar and per-row binding-method/sharing selects', () => {
    const html = renderToStaticMarkup(
      <EnvironmentConfigResourceEditor
        project={project()}
        environment={env()}
        value={[reference()]}
        onChange={() => undefined}
        currentReferences={[reference()]}
      />,
    );

    expect(html).toContain('configResourceReferences');
    expect(html).toContain('configResourceSelect');
    expect(html).toContain('configReferenceAdd');
    expect(html).toContain('envResourceBindExisting');
    expect(html).toContain('envResourceRebind');
    expect(html).toContain('envResourceUnbind');
    expect(html).toContain('envResourceUseShared');
    expect(html).toContain('envResourceSharingScopeLabel');
    expect(html).toContain('envResourceSharingDedicated');
    expect(html).toContain('envResourceSharingShared');
    expect(html).toContain('envResourceBindingNeedsConfiguration');
    expect(html).toContain('envResourceLegacyUnassigned');
    expect(html).toContain('envResourceSelectComponent');
  });

  it('locks production rows to 环境专用 (forced) and disables the shared options', () => {
    const production = env({ id: 'env-production', baselineRole: 'production' });
    const html = renderToStaticMarkup(
      <EnvironmentConfigResourceEditor
        project={project()}
        environment={production}
        value={[reference()]}
        onChange={() => undefined}
        currentReferences={[reference()]}
      />,
    );

    expect(html).toContain('envResourceSharingProductionForced');
    expect(html).toContain('envResourceSharingProdForbidden');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('envResourceSharingShared');
  });

  it('reveals shared-environment checkboxes for non-production shared rows', () => {
    const html = renderToStaticMarkup(
      <EnvironmentConfigResourceEditor
        project={project()}
        environment={env()}
        value={[reference({ sharedEnvironmentIds: ['env-staging', 'env-preview'] })]}
        onChange={() => undefined}
        currentReferences={[reference({ sharedEnvironmentIds: ['env-staging', 'env-preview'] })]}
      />,
    );

    expect(html).toContain('type="checkbox"');
    expect(html).toContain('Preview');
  });

  it('offers no create/release affordance in the project settings surface', () => {
    const html = renderToStaticMarkup(
      <EnvironmentConfigResourceEditor
        project={project()}
        environment={env()}
        value={[reference()]}
        onChange={() => undefined}
        currentReferences={[reference()]}
      />,
    );

    expect(html).not.toMatch(/申请|创建|释放|create|release/i);
  });
});

function reference(overrides: Partial<{ sharedEnvironmentIds: string[] }> = {}) {
  return {
    kind: 'managed_resource' as const,
    id: 'resource-1',
    name: 'pg-shared',
    sharedEnvironmentIds: overrides.sharedEnvironmentIds ?? ['env-staging'],
    risk: 'medium' as const,
    impact: 'api',
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

function project(): Project {
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
    ],
    resourceInstances: [],
    sites: [],
    cdnConfigs: [],
  } as Project;
}
