import {
  buildManagedResourceWhere,
  buildResourceActionRunWhere,
  buildResourceConnectionRunWhere,
  buildResourceMetricSnapshotWhere,
  buildResourceQueryRunWhere,
} from './resource-control-query.utils';

describe('resource-control query utils', () => {
  it('builds scoped managed resource filters', () => {
    expect(buildManagedResourceWhere('team-1', {
      resourceId: 'resource-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      provider: 'docker',
      kind: 'docker_container',
      status: 'unknown',
    })).toEqual({
      teamId: 'team-1',
      id: 'resource-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      provider: 'docker',
      kind: 'docker_container',
      status: 'unknown',
    });
  });

  it('builds action run filters through the managed resource relation', () => {
    expect(buildResourceActionRunWhere('team-1', {
      projectId: 'project-1',
      environmentId: 'env-1',
      action: 'sync',
      status: 'completed',
    })).toEqual({
      teamId: 'team-1',
      action: 'sync',
      status: 'completed',
      resource: {
        is: {
          projectId: 'project-1',
          environmentId: 'env-1',
        },
      },
    });
  });

  it('builds direct resource scope filters for metric, connection, and query runs', () => {
    const cutoff = new Date('2026-07-02T00:00:00.000Z');
    const scope = {
      resourceId: 'resource-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      provider: 'docker',
      kind: 'docker_container',
      status: 'completed',
    };

    expect(buildResourceMetricSnapshotWhere('team-1', {
      ...scope,
      metricSource: 'docker_stats',
    }, cutoff)).toEqual({
      teamId: 'team-1',
      sampledAt: { gte: cutoff },
      resourceId: 'resource-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      status: 'completed',
      provider: 'docker',
      kind: 'docker_container',
      metricSource: 'docker_stats',
    });
    expect(buildResourceConnectionRunWhere('team-1', scope)).toEqual({
      teamId: 'team-1',
      resourceId: 'resource-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      status: 'completed',
      provider: 'docker',
      kind: 'docker_container',
    });
    expect(buildResourceQueryRunWhere('team-1', {
      ...scope,
      queryType: 'sql',
    })).toEqual({
      teamId: 'team-1',
      resourceId: 'resource-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      status: 'completed',
      provider: 'docker',
      kind: 'docker_container',
      queryType: 'sql',
    });
  });
});
