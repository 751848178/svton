import { describe, expect, it } from 'vitest';
import { INITIAL_INTAKE_FORM } from './types';
import { projectIntakeCredentialReady, projectIntakeRepositoryInput } from
  './project-intake-repository-input';

describe('project intake repository input', () => {
  it('omits stale credentials for public repositories', () => {
    const form = { ...INITIAL_INTAKE_FORM, repositoryUrl: ' https://example.test/repo ',
      visibility: 'public' as const, teamCredentialId: 'stale-managed',
      credentialSecret: 'stale-secret' };
    expect(projectIntakeRepositoryInput(form)).toEqual({
      repositoryUrl: 'https://example.test/repo', branch: undefined, visibility: 'public',
    });
  });

  it('submits exactly one private credential variant and rejects incomplete input', () => {
    const managed = { ...INITIAL_INTAKE_FORM, repositoryUrl: '/repo',
      visibility: 'private' as const, credentialMode: 'managed' as const,
      teamCredentialId: ' credential-1 ', credentialSecret: 'stale-inline' };
    expect(projectIntakeRepositoryInput(managed)).toEqual(expect.objectContaining({
      visibility: 'private', teamCredentialId: 'credential-1',
    }));
    expect(projectIntakeRepositoryInput(managed)).not.toHaveProperty('credential');
    const incomplete = { ...managed, teamCredentialId: '' };
    expect(projectIntakeCredentialReady(incomplete)).toBe(false);
    expect(() => projectIntakeRepositoryInput(incomplete)).toThrow(
      'PRIVATE_REPOSITORY_CREDENTIAL_REQUIRED',
    );
  });
});
