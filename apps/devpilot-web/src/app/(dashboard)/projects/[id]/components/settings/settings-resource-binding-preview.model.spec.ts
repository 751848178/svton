import {
  buildResourceBindingPreview,
  resourceDraftIssues,
} from './settings-resource-binding-preview.model';

describe('resource binding draft preview', () => {
  const instance = {
    id: 'resource-1',
    kind: 'resource_instance' as const,
    resourceType: {
      id: 'mysql', key: 'mysql', name: 'MySQL', category: 'database',
      envTemplate: 'DATABASE_URL=${url}\nDATABASE_HOST=${host}',
    },
  };

  it('previews template keys and selected component before saving', () => {
    expect(buildResourceBindingPreview(instance, 'api', [])).toEqual({
      componentKey: 'api',
      envBindings: [
        { sourceKey: 'DATABASE_HOST', targetEnvKey: 'DATABASE_HOST' },
        { sourceKey: 'DATABASE_URL', targetEnvKey: 'DATABASE_URL' },
      ],
      status: 'draft',
    });
  });

  it('shows persisted mappings as effective instead of rebuilding them', () => {
    expect(buildResourceBindingPreview(instance, 'web', [{
      id: 'resource-1', kind: 'resource_instance', name: 'database',
      sharedEnvironmentIds: ['env-1'], risk: 'medium', impact: 'database',
      componentKey: 'api',
      envBindings: [{ sourceKey: 'DATABASE_URL', targetEnvKey: 'API_DATABASE_URL' }],
    }])).toMatchObject({
      componentKey: 'api',
      envBindings: [{ sourceKey: 'DATABASE_URL', targetEnvKey: 'API_DATABASE_URL' }],
      status: 'effective',
    });
  });

  it('marks legacy references as needs_configuration and blocks revision save', () => {
    const legacy = {
      id: 'resource-1', kind: 'resource_instance' as const, name: 'database',
      sharedEnvironmentIds: ['env-1'], risk: 'medium' as const, impact: 'database',
      bindingStatus: 'needs_configuration' as const,
    };

    expect(buildResourceBindingPreview(instance, null, [legacy])).toMatchObject({
      componentKey: null,
      status: 'needs_configuration',
    });
    expect(resourceDraftIssues([legacy], [legacy])).toEqual([
      'resource_instance:resource-1:component',
      'resource_instance:resource-1:mappings',
    ]);
  });
});
