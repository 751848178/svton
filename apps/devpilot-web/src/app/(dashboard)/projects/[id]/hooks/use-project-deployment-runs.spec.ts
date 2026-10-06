import { describe, expect, it } from 'vitest';
import {
  deploymentRunQuery,
  EMPTY_DEPLOYMENT_FILTERS,
  isLegacyDeploymentQueryError,
} from './use-project-deployment-runs';

describe('deploymentRunQuery', () => {
  it('requests one look-ahead row for truthful pagination', () => {
    expect(deploymentRunQuery('project-1', EMPTY_DEPLOYMENT_FILTERS, 2)).toEqual({
      projectId: 'project-1',
      attentionFirst: true,
      skip: 40,
      take: 21,
    });
  });

  it('passes server-side filters without inventing client-only matches', () => {
    expect(
      deploymentRunQuery(
        'project-1',
        {
          environmentId: 'env-1',
          status: 'failed',
          releaseOrderId: 'release-1',
          startedFrom: '2026-08-01',
          startedTo: '2026-08-27',
        },
        0,
      ),
    ).toMatchObject({
      environmentId: 'env-1',
      status: 'failed',
      releaseOrderId: 'release-1',
      startedFrom: '2026-08-01T00:00:00.000Z',
      startedTo: '2026-08-27T23:59:59.999Z',
    });
  });

  it('recognizes only rolling-deployment query compatibility failures', () => {
    expect(isLegacyDeploymentQueryError(new Error('property skip should not exist'))).toBe(true);
    expect(
      isLegacyDeploymentQueryError(new Error('property attentionFirst should not exist')),
    ).toBe(true);
    expect(isLegacyDeploymentQueryError(new Error('Unauthorized'))).toBe(false);
  });
});
