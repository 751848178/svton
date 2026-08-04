import { vi } from 'vitest';

vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: null }),
  useTeamStore: () => ({ currentTeam: null }),
}));

import {
  buildProjectDeliverySummaryCacheKey,
  shouldShowProjectDeliverySummaryLoading,
  shouldUseInitialProjectDeliverySummary,
} from './use-project-delivery-summary';

const endpoint = 'GET:/projects/project-1/delivery/summary';
const scope = { actorId: 'actor-1', teamId: 'team-1', projectId: 'project-1' };

describe('project delivery summary cache isolation', () => {
  it('keys client data by actor, team, project, and endpoint', () => {
    const key = buildProjectDeliverySummaryCacheKey(endpoint, 'project-1', 'actor-1', 'team-1');
    expect(key).toEqual(['actor-1', 'team-1', 'project-1', endpoint]);
    expect(buildProjectDeliverySummaryCacheKey(endpoint, 'project-1', null, 'team-1')).toBeNull();
    expect(buildProjectDeliverySummaryCacheKey(endpoint, 'project-1', 'actor-1', null)).toBeNull();
    expect(buildProjectDeliverySummaryCacheKey(endpoint, '', 'actor-1', 'team-1')).toBeNull();
  });

  it('never reuses SSR fallback across actor, team, or project scope', () => {
    expect(
      shouldUseInitialProjectDeliverySummary('project-1', 'actor-1', 'team-1', scope, false),
    ).toBe(true);
    expect(
      shouldUseInitialProjectDeliverySummary('project-1', 'actor-2', 'team-1', scope, false),
    ).toBe(false);
    expect(
      shouldUseInitialProjectDeliverySummary('project-1', 'actor-1', 'team-2', scope, false),
    ).toBe(false);
    expect(
      shouldUseInitialProjectDeliverySummary('project-2', 'actor-1', 'team-1', scope, false),
    ).toBe(false);
  });

  it('keeps the SSR summary visible on the first revalidating frame', () => {
    expect(shouldUseInitialProjectDeliverySummary('project-1', null, null, scope, false)).toBe(
      true,
    );
    expect(shouldUseInitialProjectDeliverySummary('project-1', null, null, scope, true)).toBe(
      false,
    );
    expect(shouldShowProjectDeliverySummaryLoading(true, true)).toBe(false);
    expect(shouldShowProjectDeliverySummaryLoading(true, false)).toBe(true);
    expect(shouldShowProjectDeliverySummaryLoading(false, false)).toBe(false);
  });
});
