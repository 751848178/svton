import { describe, expect, it } from 'vitest';
import { projectIdentityFromProject } from './project-workbench-identity.model';

describe('projectIdentityFromProject', () => {
  it('uses the project repository and canonical branch analysis for the header contract', () => {
    const identity = projectIdentityFromProject(
      {
        id: 'project-1',
        name: 'Devpilot',
        gitRepo: 'https://fallback.example/devpilot.git',
        applications: [{ defaultBranch: 'application-main' }],
      } as never,
      {
        state: {
          canonicalIdentity: {
            canonicalUrl: 'https://github.com/svton/devpilot',
            effectiveRevision: { defaultBranch: 'main' },
          },
          connection: {
            repositoryUrl: 'https://connection.example/devpilot.git',
            selectedBranch: 'connection-main',
            commitSha: 'connection-sha',
          },
        } as never,
        selectedRun: { branch: 'feature/release', commitSha: 'run-sha' } as never,
      },
    );

    expect(identity).toEqual({
      projectId: 'project-1',
      name: 'Devpilot',
      repository: 'https://fallback.example/devpilot.git',
      branch: 'main',
      commitSha: 'run-sha',
    });
  });

  it('keeps missing evidence empty instead of inventing header values', () => {
    const identity = projectIdentityFromProject(
      { id: 'project-1', name: 'Devpilot', gitRepo: null, applications: [] } as never,
      { state: {} as never, selectedRun: null },
    );
    expect(identity.repository).toBeNull();
    expect(identity.branch).toBeNull();
    expect(identity.commitSha).toBeNull();
  });
});
