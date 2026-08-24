import { describe, expect, it } from 'vitest';
import { isCanonicalReleaseVersion, releaseVersionIdentity } from './release-version-display.model';

describe('release version display semantics', () => {
  it('recognizes canonical x.y.z versions', () => {
    expect(isCanonicalReleaseVersion('1.4.0')).toBe(true);
    expect(isCanonicalReleaseVersion('v202608200822')).toBe(false);
    expect(isCanonicalReleaseVersion('01.4.0')).toBe(false);
  });

  it('does not treat a legacy identifier duplicated as a name as human naming', () => {
    expect(releaseVersionIdentity('v202608200822', 'v202608200822')).toEqual({
      version: 'v202608200822',
      name: null,
      canonical: false,
    });
  });
});
