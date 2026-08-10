import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: null }),
  useTeamStore: () => ({ currentTeam: null }),
}));

import {
  buildReleaseOrderListCacheKey,
  buildReleaseOrderListEndpoint,
  createReleaseOrderAndRefresh,
} from './use-release-orders';

describe('release order list client contract', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sends query, derived lifecycle status and bounded take to the server', () => {
    expect(
      buildReleaseOrderListEndpoint('project/1', {
        query: ' build #3 & digest ',
        status: 'awaiting_approval',
        take: 50,
      }),
    ).toBe(
      'GET:/projects/project%2F1/delivery/releases?take=50&query=build+%233+%26+digest&status=awaiting_approval',
    );
    expect(
      buildReleaseOrderListEndpoint('project-1', { query: '  ', status: null, take: 50 }),
    ).toBe('GET:/projects/project-1/delivery/releases?take=50');
  });

  it('isolates SWR by actor, team, project, and full query URL', () => {
    const endpoint = 'GET:/projects/project-1/delivery/releases?take=50&status=failed';
    expect(buildReleaseOrderListCacheKey(endpoint, 'project-1', 'actor-1', 'team-1')).toEqual([
      'actor-1',
      'team-1',
      'project-1',
      endpoint,
    ]);
    expect(buildReleaseOrderListCacheKey(endpoint, 'project-1', null, 'team-1')).toBeNull();
    expect(buildReleaseOrderListCacheKey(endpoint, 'project-1', 'actor-1', null)).toBeNull();
    expect(buildReleaseOrderListCacheKey(endpoint, '', 'actor-1', 'team-1')).toBeNull();
  });

  it('refetches the rich list after create and never constructs a partial row', async () => {
    const created = { id: 'order-new', releaseVersion: '2.5.0' };
    mocks.apiRequest.mockResolvedValue(created);
    const refresh = vi.fn().mockResolvedValue(undefined);
    const input = { releaseVersion: '2.5.0', note: 'Optional' };

    await expect(createReleaseOrderAndRefresh('project-1', input, refresh)).resolves.toBe(created);
    expect(mocks.apiRequest).toHaveBeenCalledWith(
      'POST:/projects/project-1/delivery/releases',
      input,
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
