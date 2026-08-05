import {
  deliveryHref,
  readDeliveryView,
  readReleaseOrderStep,
  releaseOrderHref,
  releaseOrderListHref,
  readSettingsSection,
  resolveLegacyProjectHref,
  settingsHref,
} from './project-route.utils';

describe('project route compatibility', () => {
  it.each([
    [
      'releases',
      'releasePlanId=release-1&stageId=stage-1',
      '/projects/project%2F1?releasePlanId=release-1&stageId=stage-1',
    ],
    ['deployments', 'runId=run-1', '/projects/project%2F1?runId=run-1&view=deployments'],
    [
      'repository',
      'analysisRunId=analysis-1',
      '/projects/project%2F1/settings?analysisRunId=analysis-1&section=repository',
    ],
    [
      'environments',
      'environmentId=env-1',
      '/projects/project%2F1/settings?environmentId=env-1&section=environments',
    ],
    ['resources', '', '/projects/project%2F1/settings?section=resources'],
    ['webhooks', '', '/projects/project%2F1/settings?section=webhooks'],
    ['settings', '', '/projects/project%2F1/settings?section=general'],
    ['overview', '', '/projects/project%2F1'],
  ])('adapts the legacy %s tab and preserves focused IDs', (tab, query, expected) => {
    const params = new URLSearchParams(query);
    params.set('tab', tab);
    expect(resolveLegacyProjectHref('project/1', params)).toBe(expected);
  });

  it('reads only supported delivery views and settings sections', () => {
    expect(readDeliveryView(new URLSearchParams('view=environment-versions'))).toBe(
      'environment-versions',
    );
    expect(readDeliveryView(new URLSearchParams('view=unknown'))).toBe('releases');
    expect(readSettingsSection(new URLSearchParams('section=resources'))).toBe('resources');
    expect(readSettingsSection(new URLSearchParams('section=release-policy'))).toBe(
      'release-policy',
    );
    expect(readSettingsSection(new URLSearchParams('section=unknown'))).toBe('repository');
  });

  it('drops incompatible focused IDs when switching areas', () => {
    const current = new URLSearchParams(
      'runId=run-1&analysisRunId=analysis-1&environmentId=env-1&releasePlanId=release-1&releaseOrderId=order-1&step=build&buildRunId=build-1',
    );
    expect(deliveryHref('project-1', 'environment-versions', current)).toBe(
      '/projects/project-1?view=environment-versions',
    );
    expect(settingsHref('project-1', 'resources', current)).toBe(
      '/projects/project-1/settings?section=resources',
    );
  });

  it('builds stable release detail, step and log deep links', () => {
    const current = new URLSearchParams('view=environment-versions&analysisRunId=analysis-1');
    expect(releaseOrderHref('project/1', 'order-1', 'build', current, 'build-1')).toBe(
      '/projects/project%2F1?releaseOrderId=order-1&step=build&buildRunId=build-1',
    );
    expect(readReleaseOrderStep(new URLSearchParams('step=production'), 'preflight')).toBe(
      'production',
    );
    expect(readReleaseOrderStep(new URLSearchParams('step=unknown'), 'build')).toBe('build');
    expect(
      releaseOrderListHref(
        'project-1',
        new URLSearchParams('releaseOrderId=order-1&step=build&buildRunId=build-1'),
      ),
    ).toBe('/projects/project-1');
  });

  it('owns Staging and Production focus ids only inside their exact step', () => {
    const current = new URLSearchParams(
      'buildRunId=old-build&deploymentRunId=old-deploy&releaseRunId=old-release',
    );
    expect(
      releaseOrderHref('project-1', 'order-1', 'staging', current, {
        deploymentRunId: 'staging-1',
      }),
    ).toBe('/projects/project-1?releaseOrderId=order-1&step=staging&deploymentRunId=staging-1');
    expect(
      releaseOrderHref('project-1', 'order-1', 'production', current, {
        releaseRunId: 'release-1',
        deploymentRunId: 'production-1',
      }),
    ).toBe(
      '/projects/project-1?releaseOrderId=order-1&step=production&releaseRunId=release-1&deploymentRunId=production-1',
    );
  });

  it.each([
    ['', 'staging'],
    ['step=', 'staging'],
    ['step=unknown', 'staging'],
    ['step=Production', 'staging'],
    ['step=%50roduction', 'staging'],
    ['step=unknown&step=build', 'staging'],
    ['step=build&step=unknown', 'staging'],
    ['step=build&step=production', 'staging'],
    ['step=preflight', 'preflight'],
    ['step=build', 'build'],
    ['step=staging', 'staging'],
    ['step=production', 'production'],
  ])('resolves route %p against the server resume step', (query, expected) => {
    expect(readReleaseOrderStep(new URLSearchParams(query), 'staging')).toBe(expected);
  });

  it('removes an incompatible build focus while canonicalizing a step', () => {
    expect(
      releaseOrderHref(
        'project-1',
        'order-1',
        'production',
        new URLSearchParams('step=unknown&buildRunId=foreign-build'),
      ),
    ).toBe('/projects/project-1?step=production&releaseOrderId=order-1');
  });
});
