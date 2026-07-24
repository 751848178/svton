import { LogCenterService } from '../log-center/log-center.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  DeploymentLogStreamBootstrapService,
  readContainerName,
} from './deployment-log-stream-bootstrap.service';

describe('readContainerName', () => {
  it('reads containerName from deployConfig', () => {
    expect(readContainerName({ containerName: 'api-svc' })).toBe('api-svc');
  });

  it('falls back to container alias', () => {
    expect(readContainerName({ container: 'web-svc' })).toBe('web-svc');
  });

  it('prefers containerName over container', () => {
    expect(
      readContainerName({ containerName: 'primary', container: 'alias' }),
    ).toBe('primary');
  });

  it('returns undefined when no usable value is present', () => {
    expect(readContainerName({})).toBeUndefined();
    expect(readContainerName(null)).toBeUndefined();
    expect(readContainerName({ containerName: '' })).toBeUndefined();
    expect(readContainerName({ containerName: 'has spaces' })).toBeUndefined();
  });
});

describe('DeploymentLogStreamBootstrapService', () => {
  function buildService(overrides: {
    existing?: unknown;
    created?: unknown;
    createError?: Error;
  }) {
    const findFirst = jest.fn().mockResolvedValue(overrides.existing ?? null);
    const createStream = overrides.createError
      ? jest.fn().mockRejectedValue(overrides.createError)
      : jest.fn().mockResolvedValue(overrides.created ?? { id: 'stream-new' });
    const prisma = { logStream: { findFirst } };
    const logCenterService = { createStream } as unknown as LogCenterService;
    const service = new DeploymentLogStreamBootstrapService(
      prisma as unknown as PrismaService,
      logCenterService,
    );
    return { service, findFirst, createStream, prisma };
  }

  const baseContext = {
    teamId: 'team-1',
    actorId: 'user-1',
    projectId: 'project-1',
    environmentId: 'env-1',
    applicationId: 'app-1',
    applicationServiceId: 'svc-1',
    applicationServiceName: 'api',
    serverId: 'server-1',
    deployConfig: { containerName: 'api-container' },
  };

  it('creates a docker log stream after a successful deployment', async () => {
    const { service, findFirst, createStream } = buildService({});

    await service.ensureDockerLogStream(baseContext);

    // Dedup lookup keys on applicationServiceId + serverId + sourceType.
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        sourceType: 'docker',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
      },
      select: { id: true },
    });
    // Creation reuses the shared log-center path with derived container name.
    expect(createStream).toHaveBeenCalledTimes(1);
    const [teamId, actorId, dto] = createStream.mock.calls[0];
    expect(teamId).toBe('team-1');
    expect(actorId).toBe('user-1');
    expect(dto).toEqual(
      expect.objectContaining({
        name: 'api 容器日志',
        sourceType: 'docker',
        sourceKey: 'api-container',
        projectId: 'project-1',
        environmentId: 'env-1',
        applicationId: 'app-1',
        applicationServiceId: 'svc-1',
        serverId: 'server-1',
        metadata: expect.objectContaining({
          autoCreated: true,
          containerName: 'api-container',
        }),
      }),
    );
  });

  it('does not create a duplicate when a docker stream already exists', async () => {
    const { service, findFirst, createStream } = buildService({
      existing: { id: 'stream-existing' },
    });

    const result = await service.ensureDockerLogStream(baseContext);

    expect(findFirst).toHaveBeenCalled();
    expect(createStream).not.toHaveBeenCalled();
    expect(result).toEqual({ id: 'stream-existing' });
  });

  it('matches a server-less stream when serverId is null', async () => {
    const { service, findFirst } = buildService({
      existing: { id: 'stream-existing' },
    });

    await service.ensureDockerLogStream({ ...baseContext, serverId: null });

    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ serverId: null }),
      select: { id: true },
    });
  });

  it('falls back to the service name only at collection time when deployConfig has no container name', async () => {
    const { service, createStream } = buildService({});

    await service.ensureDockerLogStream({
      ...baseContext,
      deployConfig: {},
    });

    const dto = createStream.mock.calls[0][2];
    expect(dto.sourceKey).toBeUndefined();
    expect(dto.name).toBe('api 容器日志');
  });

  it('rethrows creation errors so the caller can swallow them best-effort', async () => {
    const { service, createStream } = buildService({
      createError: new Error('boom'),
    });

    await expect(service.ensureDockerLogStream(baseContext)).rejects.toThrow(
      'boom',
    );
    expect(createStream).toHaveBeenCalled();
  });
});
