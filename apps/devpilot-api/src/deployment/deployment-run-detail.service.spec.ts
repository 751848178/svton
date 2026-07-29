import { NotFoundException } from '@nestjs/common';
import { DeploymentRunDetailService } from './deployment-run-detail.service';

describe('DeploymentRunDetailService', () => {
  const repository = { findById: jest.fn() };
  const accessPolicy = { canRead: jest.fn() };
  const service = new DeploymentRunDetailService(
    repository as never,
    accessPolicy as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns only the requested readable run', async () => {
    repository.findById.mockResolvedValue({
      id: 'run-1',
      projectId: 'project-1',
      environmentId: 'env-1',
    });
    accessPolicy.canRead.mockResolvedValue(true);

    await expect(service.get({
      teamId: 'team-1',
      actorId: 'actor-1',
      runId: 'run-1',
    })).resolves.toMatchObject({ id: 'run-1' });
    expect(repository.findById).toHaveBeenCalledWith('team-1', 'run-1');
  });

  it('does not disclose whether an unreadable run exists', async () => {
    repository.findById.mockResolvedValue({
      id: 'run-1',
      projectId: 'project-1',
      environmentId: null,
    });
    accessPolicy.canRead.mockResolvedValue(false);

    await expect(service.get({
      teamId: 'team-1',
      actorId: 'actor-1',
      runId: 'run-1',
    })).rejects.toBeInstanceOf(NotFoundException);
  });
});
