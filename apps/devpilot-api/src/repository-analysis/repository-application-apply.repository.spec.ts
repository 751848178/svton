import { RepositoryApplicationApplyRepository } from './repository-application-apply.repository';

describe('RepositoryApplicationApplyRepository', () => {
  function transaction() {
    return {
      projectEnvironment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'environment-1' }),
        findUniqueOrThrow: jest.fn(),
      },
      application: {
        findFirst: jest.fn().mockResolvedValue({ id: 'application-1' }),
        update: jest.fn().mockResolvedValue({ id: 'application-1' }),
        upsert: jest.fn(),
      },
      applicationService: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'service-1',
          deployConfig: null,
        }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'service-1' }),
        upsert: jest.fn(),
      },
    };
  }

  it('updates reviewed existing IDs instead of creating duplicate applications', async () => {
    const tx = transaction();
    const repository = new RepositoryApplicationApplyRepository();
    const result = await repository.apply(
      tx as never,
      'team-1',
      'project-1',
      'run-1',
      {
        applicationId: 'application-1',
        applicationName: 'Picshare App',
        applicationDescription: '人工复核',
        serviceId: 'service-1',
        serviceName: 'backend',
        environmentId: 'environment-1',
        repositoryUrl: 'https://github.com/751848178/picshare.git',
        repoPath: 'apps/backend',
        defaultBranch: 'master',
        kind: 'docker-compose',
        runtime: 'node',
        ports: [3000],
        deployConfig: { healthCheckPath: '/api/health/readiness' },
      },
    );

    expect(tx.application.findFirst).toHaveBeenCalledWith({
      where: { id: 'application-1', projectId: 'project-1' },
    });
    expect(tx.application.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'application-1' },
      data: expect.objectContaining({
        description: '人工复核',
        repoPath: 'apps/backend',
      }),
    }));
    expect(tx.application.upsert).not.toHaveBeenCalled();
    expect(tx.applicationService.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'service-1' },
      data: expect.objectContaining({ runtime: 'node', ports: [3000] }),
    }));
    expect(tx.applicationService.upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      applicationId: 'application-1',
      applicationServiceId: 'service-1',
    });
  });

  it('preserves release-only config while applying repository-derived fields', async () => {
    const tx = transaction();
    tx.applicationService.findFirst.mockResolvedValue({
      id: 'service-1',
      deployConfig: {
        deployCommand: 'old deploy',
        healthCheckUrl: 'http://backend/healthz',
        releaseDependencies: [{ toServiceId: 'admin' }],
      },
    });
    const repository = new RepositoryApplicationApplyRepository();

    await repository.apply(tx as never, 'team-1', 'project-1', 'run-1', {
      applicationId: 'application-1',
      applicationName: 'Picshare App',
      serviceId: 'service-1',
      serviceName: 'backend',
      environmentId: 'environment-1',
      deployConfig: {
        deployCommand: 'new deploy',
        workingDirectory: 'apps/backend',
      },
    });

    expect(tx.applicationService.update).toHaveBeenCalledWith({
      where: { id: 'service-1' },
      data: expect.objectContaining({
        deployConfig: {
          deployCommand: 'new deploy',
          workingDirectory: 'apps/backend',
          healthCheckUrl: 'http://backend/healthz',
          releaseDependencies: [{ toServiceId: 'admin' }],
        },
      }),
    });
  });

  it('preserves deploy config on the unique-key upsert update path', async () => {
    const tx = transaction();
    tx.applicationService.findUnique.mockResolvedValue({
      id: 'service-1',
      deployConfig: { healthCheckUrl: 'http://admin/healthz' },
    });
    tx.applicationService.upsert.mockResolvedValue({ id: 'service-1' });
    const repository = new RepositoryApplicationApplyRepository();

    await repository.apply(tx as never, 'team-1', 'project-1', 'run-1', {
      applicationId: 'application-1',
      applicationName: 'Picshare App',
      serviceName: 'admin',
      environmentId: 'environment-1',
      deployConfig: { deployCommand: 'next start' },
    });

    expect(tx.applicationService.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        deployConfig: {
          deployCommand: 'next start',
          healthCheckUrl: 'http://admin/healthz',
        },
      }),
    }));
  });

  it('rejects a forged application ID outside the project scope', async () => {
    const tx = transaction();
    tx.application.findFirst.mockResolvedValue(null);
    const repository = new RepositoryApplicationApplyRepository();
    await expect(repository.apply(
      tx as never,
      'team-1',
      'project-1',
      'run-1',
      {
        applicationId: 'forged-application',
        applicationName: 'Picshare App',
        serviceName: 'backend',
        environmentId: 'environment-1',
      },
    )).rejects.toThrow('application scope mismatch');
    expect(tx.application.update).not.toHaveBeenCalled();
    expect(tx.applicationService.update).not.toHaveBeenCalled();
  });
});
