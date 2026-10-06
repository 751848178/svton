import { describe, expect, it } from 'vitest';
import { isProtectedPath, isTeamRequiredPath } from './protected-paths.utils';

describe('protected path classification', () => {
  it.each([
    '/dashboard',
    '/projects',
    '/projects/project-1/releases',
    '/servers',
    '/resource-requests',
    '/monitoring',
    '/git',
  ])('requires a team before entering %s', (path) => {
    expect(isProtectedPath(path)).toBe(true);
    expect(isTeamRequiredPath(path)).toBe(true);
  });

  it.each(['/teams', '/teams/team-1', '/admin/resource-pools'])(
    'keeps %s protected by login without requiring team scope',
    (path) => {
      expect(isProtectedPath(path)).toBe(true);
      expect(isTeamRequiredPath(path)).toBe(false);
    },
  );

  it.each(['/', '/login', '/register', '/docs'])('keeps %s outside team scope', (path) => {
    expect(isTeamRequiredPath(path)).toBe(false);
  });
});
