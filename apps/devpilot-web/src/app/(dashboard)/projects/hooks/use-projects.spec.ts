import { vi } from 'vitest';

vi.mock('@/store/hooks', () => ({
  useAuthStore: () => ({ user: null }),
  useTeamStore: () => ({ currentTeam: null }),
}));

import {
  buildDirectoryCacheKey,
  buildDirectoryQuery,
  PROJECT_DIRECTORY_BASE_QUERY,
  shouldUseInitialDirectory,
} from './use-projects';

describe('buildDirectoryQuery', () => {
  it('keeps the unfiltered query stable for the server fallback', () => {
    expect(buildDirectoryQuery('', 'all')).toBe(PROJECT_DIRECTORY_BASE_QUERY);
  });

  it('encodes exactly one server-side project status parameter', () => {
    expect(buildDirectoryQuery('pay & ship', 'needs_configuration')).toBe(
      'GET:/project-directory?take=100&query=pay+%26+ship&status=needs_configuration',
    );
  });

  it('never emits the removed runtime or configuration filters', () => {
    const query = buildDirectoryQuery('', 'online');
    expect(query).toContain('status=online');
    expect(query).not.toContain('runtimeStatus');
    expect(query).not.toContain('configurationStatus');
  });

  it('isolates cached directory data by team identity', () => {
    expect(buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, 'user-a', 'team-a')).toEqual([
      'user-a',
      'team-a',
      PROJECT_DIRECTORY_BASE_QUERY,
    ]);
    expect(
      buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, 'user-a', 'team-empty'),
    ).not.toEqual(buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, 'user-a', 'team-a'));
    expect(buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, 'user-a', null)).toBeNull();
  });

  it('isolates cached directory data by actor identity', () => {
    expect(buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, 'user-b', 'team-a')).not.toEqual(
      buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, 'user-a', 'team-a'),
    );
    expect(buildDirectoryCacheKey(PROJECT_DIRECTORY_BASE_QUERY, null, 'team-a')).toBeNull();
  });

  it('only applies server fallback to its authoritative actor and team scope', () => {
    const initialScope = { actorId: 'user-a', teamId: 'team-a' };
    expect(
      shouldUseInitialDirectory(
        PROJECT_DIRECTORY_BASE_QUERY,
        'user-a',
        'team-a',
        initialScope,
        false,
      ),
    ).toBe(true);
    expect(
      shouldUseInitialDirectory(
        PROJECT_DIRECTORY_BASE_QUERY,
        'user-a',
        'team-empty',
        initialScope,
        false,
      ),
    ).toBe(false);
    expect(
      shouldUseInitialDirectory(
        PROJECT_DIRECTORY_BASE_QUERY,
        'user-b',
        'team-a',
        initialScope,
        false,
      ),
    ).toBe(false);
    expect(
      shouldUseInitialDirectory(PROJECT_DIRECTORY_BASE_QUERY, 'user-a', 'team-a', null, false),
    ).toBe(false);
    expect(
      shouldUseInitialDirectory(
        'GET:/project-directory?take=100&status=online',
        'user-a',
        'team-a',
        initialScope,
        false,
      ),
    ).toBe(false);
  });

  it('hydrates authoritative scope once but never revives it after logout', () => {
    const initialScope = { actorId: 'user-a', teamId: 'team-a' };
    expect(
      shouldUseInitialDirectory(PROJECT_DIRECTORY_BASE_QUERY, null, null, initialScope, false),
    ).toBe(true);
    expect(
      shouldUseInitialDirectory(PROJECT_DIRECTORY_BASE_QUERY, null, null, initialScope, true),
    ).toBe(false);
    expect(
      shouldUseInitialDirectory(PROJECT_DIRECTORY_BASE_QUERY, 'user-b', null, initialScope, false),
    ).toBe(false);
  });
});
