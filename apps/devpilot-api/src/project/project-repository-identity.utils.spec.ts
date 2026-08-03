import { normalizeProjectRepositoryIdentity } from './project-repository-identity.utils';

describe('normalizeProjectRepositoryIdentity', () => {
  it('normalizes https and ssh GitHub urls to the same identity', () => {
    expect(normalizeProjectRepositoryIdentity('https://github.com/org/repo.git')).toBe('github.com/org/repo');
    expect(normalizeProjectRepositoryIdentity('git@github.com:Org/Repo.git')).toBe('github.com/org/repo');
  });

  it('returns null for blank repositories', () => {
    expect(normalizeProjectRepositoryIdentity('')).toBeNull();
    expect(normalizeProjectRepositoryIdentity(undefined)).toBeNull();
  });
});
