import { describe, expect, it } from 'vitest';
import { buildTeamRequiredRedirectPath, toSafeRedirectPath } from './redirect-path.utils';

describe('team prerequisite redirects', () => {
  it('preserves the requested local path and query', () => {
    expect(buildTeamRequiredRedirectPath('/projects', '?view=delivery')).toBe(
      '/teams?required=1&redirect=%2Fprojects%3Fview%3Ddelivery',
    );
  });

  it.each(['https://evil.example/path', '//evil.example/path', 'projects'])(
    'replaces an unsafe destination %s with the dashboard',
    (value) => {
      expect(toSafeRedirectPath(value)).toBe('/dashboard');
    },
  );
});
