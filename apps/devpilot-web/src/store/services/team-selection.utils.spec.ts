import { describe, expect, it } from 'vitest';
import { reconcileAuthorizedTeam, selectPersistedTeam } from './team-selection.utils';

describe('selectPersistedTeam', () => {
  const teams = [{ id: 'team-a' }, { id: 'team-empty' }];

  it('restores an authorized persisted team instead of the first team', () => {
    expect(selectPersistedTeam(teams, 'team-empty')).toEqual({ id: 'team-empty' });
  });

  it('falls back safely when the persisted team is unavailable', () => {
    expect(selectPersistedTeam(teams, 'team-private')).toEqual({ id: 'team-a' });
    expect(selectPersistedTeam([], 'team-empty')).toBeNull();
  });

  it('reconciles a stale current team against the latest authorized teams', () => {
    expect(reconcileAuthorizedTeam(teams, 'team-private', 'team-empty')).toEqual({
      id: 'team-empty',
    });
    expect(reconcileAuthorizedTeam(teams, 'team-private', 'team-private')).toEqual({
      id: 'team-a',
    });
  });

  it('refreshes the current team object when it remains authorized', () => {
    const refreshed = [{ id: 'team-a', name: 'Updated' }, { id: 'team-empty' }];
    expect(reconcileAuthorizedTeam(refreshed, 'team-a', 'team-empty')).toEqual({
      id: 'team-a',
      name: 'Updated',
    });
  });
});
