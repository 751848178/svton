import { normalizeEnvironmentConfigRevisionList } from './environment-config-revision-response.utils';

describe('environment config revision response resource status', () => {
  it('marks legacy references as needs_configuration without inventing bindings', () => {
    const response = normalizeEnvironmentConfigRevisionList({
      environmentId: 'env-1',
      revisions: [{
        plainVariables: {},
        secretReferences: [],
        resourceReferences: [{ id: 'resource-1', kind: 'resource_instance' }],
        routeSnapshot: {},
        policyReferences: [],
      }],
    });

    expect(response.revisions[0].resourceReferences[0]).toMatchObject({
      id: 'resource-1',
      bindingStatus: 'needs_configuration',
    });
    expect(response.revisions[0].resourceReferences[0]).not.toHaveProperty('componentKey');
    expect(response.revisions[0].resourceReferences[0]).not.toHaveProperty('envBindings');
  });
});
