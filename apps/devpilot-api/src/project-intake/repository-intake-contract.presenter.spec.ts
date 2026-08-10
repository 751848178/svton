import { presentRepositoryIntakeContract } from './repository-intake-contract.presenter';

describe('presentRepositoryIntakeContract immutable snapshot', () => {
  it('renders decisions and values from the snapshot instead of mutable suggestions', () => {
    const run = {
      id: 'run-1', projectId: 'project-1', status: 'succeeded', parserVersion: 'v1',
      branch: 'main', commitSha: 'a'.repeat(40), errorMessage: null, errorCode: null,
      errorAction: null,
      connection: {
        provider: 'generic', repositoryUrl: 'https://git.example/repo.git', visibility: 'public',
        credentialSource: 'none', teamCredentialId: null, gitConnectionId: null,
        defaultBranch: 'main', selectedBranch: 'main', commitSha: 'a'.repeat(40),
        verifiedAt: new Date('2026-08-04T00:00:00.000Z'),
      },
      suggestions: [{
        id: 'repo-1', kind: 'project_repository', reviewDecision: 'edit', warnings: [],
        proposedValue: { intakeContract: { overview: { projectType: 'original' } } },
        reviewedValue: { intakeContract: { overview: { projectType: 'mutable-drift' } } },
      }],
      intakeReviewSnapshot: {
        id: 'snapshot-1', version: 1, snapshotHash: 'b'.repeat(64), inputHash: 'c'.repeat(64),
        runId: 'run-1', branch: 'main', commitSha: 'a'.repeat(40), parserVersion: 'v1',
        actorId: 'actor-1', createdAt: new Date('2026-08-04T00:01:00.000Z'), references: [],
        decisions: [{
          suggestionId: 'repo-1', key: 'project_repository', kind: 'project_repository',
          decision: 'accept', currentValue: null,
          proposedValue: { intakeContract: { overview: { projectType: 'original' } } },
          reviewedValue: { intakeContract: { overview: { projectType: 'frozen' } } },
        }],
      },
    };

    const model = presentRepositoryIntakeContract(run as never);
    expect(model.overview).toMatchObject({
      decision: 'accept', value: { projectType: 'frozen' },
    });
  });
});
