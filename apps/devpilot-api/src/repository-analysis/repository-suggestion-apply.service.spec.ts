import { BadRequestException, ConflictException } from '@nestjs/common';
import { RepositorySuggestionApplyService } from './repository-suggestion-apply.service';

describe('RepositorySuggestionApplyService', () => {
  const suggestions = [
    {
      id: 'suggestion-project',
      kind: 'project_repository',
      proposedValue: { gitRepo: 'https://example.com/repo.git' },
    },
    {
      id: 'suggestion-service',
      kind: 'application_service',
      proposedValue: { applicationName: 'api', serviceName: 'api' },
    },
  ];

  function createHarness(commitSha = 'a'.repeat(40), connectionSha = commitSha) {
    const repository = {
      load: jest.fn().mockResolvedValue({
        id: 'run-1',
        status: 'succeeded',
        commitSha,
        connection: { commitSha: connectionSha },
        suggestions,
      }),
      apply: jest.fn().mockResolvedValue({ complete: true, references: [] }),
    };
    return {
      repository,
      service: new RepositorySuggestionApplyService(repository as never),
    };
  }

  it('requires an explicit decision for every suggestion', async () => {
    const { service } = createHarness();
    await expect(service.apply('team-1', 'user-1', 'project-1', 'run-1', {
      decisions: [{ suggestionId: 'suggestion-project', decision: 'accept' }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stale results when the verified connection moved to another commit', async () => {
    const { service } = createHarness('a'.repeat(40), 'b'.repeat(40));
    await expect(service.apply('team-1', 'user-1', 'project-1', 'run-1', {
      decisions: suggestions.map((item) => ({
        suggestionId: item.id,
        decision: 'accept' as const,
      })),
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('sanitizes accepted values and marks completeness from required decisions', async () => {
    const { service, repository } = createHarness();
    await service.apply('team-1', 'user-1', 'project-1', 'run-1', {
      decisions: [
        { suggestionId: 'suggestion-project', decision: 'accept' },
        {
          suggestionId: 'suggestion-service',
          decision: 'edit',
          value: { applicationName: 'backend', serviceName: 'api' },
        },
      ],
    });
    expect(repository.apply).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      userId: 'user-1',
      projectId: 'project-1',
      runId: 'run-1',
      markConnectionApplied: true,
      decisions: [
        expect.objectContaining({
          status: 'accepted',
          value: { gitRepo: 'https://example.com/repo.git' },
        }),
        expect.objectContaining({
          status: 'edited',
          value: { applicationName: 'backend', serviceName: 'api' },
        }),
      ],
    }));
  });

  it('persists rejected required suggestions but keeps readiness incomplete', async () => {
    const { service, repository } = createHarness();
    await service.apply('team-1', 'user-1', 'project-1', 'run-1', {
      decisions: [
        { suggestionId: 'suggestion-project', decision: 'accept' },
        { suggestionId: 'suggestion-service', decision: 'reject' },
      ],
    });
    expect(repository.apply).toHaveBeenCalledWith(expect.objectContaining({
      markConnectionApplied: false,
      decisions: expect.arrayContaining([
        expect.objectContaining({ status: 'rejected', value: undefined }),
      ]),
    }));
  });

  it('rejects edited values that embed literal credentials in commands', async () => {
    const { service, repository } = createHarness();
    await expect(service.apply('team-1', 'user-1', 'project-1', 'run-1', {
      decisions: [
        { suggestionId: 'suggestion-project', decision: 'accept' },
        {
          suggestionId: 'suggestion-service',
          decision: 'edit',
          value: {
            applicationName: 'backend',
            deployConfig: {
              initializationCommand: 'JWT_SECRET=sentinel-jwt node initialize.js',
            },
          },
        },
      ],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.apply).not.toHaveBeenCalled();
  });
});
