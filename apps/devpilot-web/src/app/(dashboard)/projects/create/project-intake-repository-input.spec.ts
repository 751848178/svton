import { describe, expect, it } from 'vitest';
import { INITIAL_INTAKE_FORM } from './types';
import { projectIntakeCredentialReady, projectIntakeRepositoryInput } from
  './project-intake-repository-input';

describe('project intake repository input', () => {
  it('omits stale credentials for public repositories', () => {
    const form = { ...INITIAL_INTAKE_FORM, repositoryUrl: ' https://example.test/repo ',
      visibility: 'public' as const, managedCredential: {
        id: 'stale-managed', source: 'team_credential' as const },
      credentialSecret: 'stale-secret' };
    expect(projectIntakeRepositoryInput(form)).toEqual({
      repositoryUrl: 'https://example.test/repo', branch: undefined, visibility: 'public',
    });
  });

  it('submits the selected team credential source only', () => {
    const managed = { ...INITIAL_INTAKE_FORM, repositoryUrl: '/repo',
      visibility: 'private' as const, credentialMode: 'managed' as const,
      managedCredential: { id: 'credential-1', source: 'team_credential' as const },
      credentialSecret: 'stale-inline' };
    expect(projectIntakeRepositoryInput(managed)).toEqual(expect.objectContaining({
      visibility: 'private', teamCredentialId: 'credential-1',
    }));
    expect(projectIntakeRepositoryInput(managed)).not.toHaveProperty('credential');
    const incomplete = { ...managed, managedCredential: null };
    expect(projectIntakeCredentialReady(incomplete)).toBe(false);
    expect(() => projectIntakeRepositoryInput(incomplete)).toThrow(
      'PRIVATE_REPOSITORY_CREDENTIAL_REQUIRED',
    );
  });

  it('submits gitProvider for a selected git connection', () => {
    const form = { ...INITIAL_INTAKE_FORM, repositoryUrl: '/repo',
      visibility: 'private' as const, credentialMode: 'managed' as const,
      managedCredential: { id: 'connection-1', source: 'git_connection' as const,
        provider: 'github' } };
    expect(projectIntakeRepositoryInput(form)).toEqual({ repositoryUrl: '/repo',
      branch: undefined, visibility: 'private', gitProvider: 'github' });
  });
});
