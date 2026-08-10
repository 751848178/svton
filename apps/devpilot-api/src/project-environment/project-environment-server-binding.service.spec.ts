/**
 * F445 focused spec: hardened per-environment deployment target binding.
 *
 * Covers AC-SET-018/019/020/021/023 — frozen bind/unbind rejection,
 * providerKey/root validation, real connectivity-check gating, soft-archive
 * unbind (historical-run traceability), shared-scope declaration scope check,
 * duplicate-binding rejection, and the provider-matched current-target
 * resolution used by the settings page.
 */

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ProjectEnvironmentServerBindingService } from './project-environment-server-binding.service';
import type { PrismaService } from '../prisma/prisma.service';

const CAP_ONLINE = {
  authType: 'password',
  networkReachable: true,
  authenticationVerified: true,
  executorCompatible: true,
  latency: 1,
  message: '连接成功：网络可达、SSH 认证通过、可用于实时发布。',
};

describe('ProjectEnvironmentServerBindingService (F445)', () => {
  let prisma: Record<string, any>;
  let repo: ProjectEnvironmentRepository;
  let audit: { create: jest.Mock };
  let capabilities: { verifyCapability: jest.Mock };
  let service: ProjectEnvironmentServerBindingService;

  beforeEach(() => {
    prisma = {
      projectEnvironment: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'env-staging',
          projectId: 'project-1',
          name: 'Staging',
        }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'env-shared' },
        ]),
      },
      projectEnvironmentServer: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockImplementation(({ create }: { create: any }) => ({
          id: 'binding-1',
          ...create,
          server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', status: 'online', services: {} },
          project: { id: 'project-1', name: 'Project' },
          environment: { id: 'env-staging', key: 'staging', name: 'Staging', status: 'active' },
        })),
        update: jest.fn().mockResolvedValue({ id: 'binding-1', status: 'archived' }),
        delete: jest.fn(),
      },
      server: {
        findFirst: jest.fn().mockResolvedValue({ id: 'server-1' }),
      },
      deploymentRun: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    repo = new ProjectEnvironmentRepository(prisma as unknown as PrismaService);
    audit = { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    capabilities = { verifyCapability: jest.fn().mockResolvedValue({ ...CAP_ONLINE }) };
    service = new ProjectEnvironmentServerBindingService(
      repo,
      audit as never,
      capabilities as never,
    );
  });

  it('binds an ssh-v1 target with a safe root, normalizing the legacy deployment role', async () => {
    await service.bindServer('team-1', 'user-1', 'env-staging', {
      serverId: 'server-1',
      role: 'deployment',
      providerKey: 'ssh-v1',
      root: '/srv/app',
      sharedEnvironmentIds: ['env-shared'],
    });

    expect(prisma.projectEnvironmentServer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { environmentId_serverId: { environmentId: 'env-staging', serverId: 'server-1' } },
        create: expect.objectContaining({
          role: 'deploy',
          metadata: {
            releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/app' },
            sharedEnvironmentIds: ['env-shared'],
          },
        }),
      }),
    );
    expect(capabilities.verifyCapability).toHaveBeenCalledWith('team-1', 'server-1');
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.server.bind',
      metadata: expect.objectContaining({ role: 'deploy' }),
    }));
  });

  it('rejects an unsafe ssh-v1 root before persisting', async () => {
    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        providerKey: 'ssh-v1',
        root: '/srv/../etc',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectEnvironmentServer.upsert).not.toHaveBeenCalled();
  });

  it('rejects an unknown providerKey before persisting', async () => {
    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        providerKey: 'k8s-v9',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.projectEnvironmentServer.upsert).not.toHaveBeenCalled();
  });

  it('fails the bind with an honest error when the server is unreachable', async () => {
    capabilities.verifyCapability.mockResolvedValue({
      ...CAP_ONLINE,
      networkReachable: false,
      message: '无法连接到 10.0.0.1:22（网络不可达）',
      recommendation: '检查服务器主机/端口、安全组与防火墙规则后重试。',
    });

    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        providerKey: 'ssh-v1',
        root: '/srv/app',
      }),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      message: expect.stringContaining('目标服务器不可达，绑定被拒绝：无法连接到 10.0.0.1:22（网络不可达）'),
    });
    expect(prisma.projectEnvironmentServer.upsert).not.toHaveBeenCalled();
  });

  it('fails the bind when the ssh-v1 server authentication is not verified', async () => {
    capabilities.verifyCapability.mockResolvedValue({
      ...CAP_ONLINE,
      authenticationVerified: false,
      message: 'SSH 认证失败',
    });

    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        providerKey: 'ssh-v1',
        root: '/srv/app',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.projectEnvironmentServer.upsert).not.toHaveBeenCalled();
  });

  it('does not require SSH authentication for non-ssh providers when the server is reachable', async () => {
    capabilities.verifyCapability.mockResolvedValue({
      ...CAP_ONLINE,
      authenticationVerified: false,
    });

    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        providerKey: 'local-filesystem-v1',
        targetRef: '/data/releases',
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'binding-1' }));
  });

  it('rejects replacing a binding that a DeploymentRun snapshot references (frozen guard)', async () => {
    prisma.projectEnvironmentServer.findFirst.mockResolvedValue({
      id: 'binding-1',
      metadata: { releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/app' } },
      status: 'active',
    });
    prisma.deploymentRun.findMany.mockResolvedValue([
      { id: 'run-1', params: { deploymentInput: { target: { bindingId: 'binding-1' } } } },
    ]);

    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        providerKey: 'ssh-v1',
        root: '/srv/app',
      }),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      message: expect.stringContaining('目标已冻结'),
    });
    expect(prisma.projectEnvironmentServer.upsert).not.toHaveBeenCalled();
  });

  it('rejects unbinding a frozen binding and never hard-deletes the row', async () => {
    prisma.projectEnvironmentServer.findFirst.mockResolvedValue({
      id: 'binding-1',
      role: 'deploy',
      status: 'active',
      server: { id: 'server-1', name: 'stg-web' },
    });
    prisma.deploymentRun.findMany.mockResolvedValue([
      { id: 'run-1', serverId: 'server-1', params: { deploymentInput: {} } },
    ]);

    await expect(
      service.unbindServer('team-1', 'user-1', 'env-staging', 'server-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.projectEnvironmentServer.update).not.toHaveBeenCalled();
    expect(prisma.projectEnvironmentServer.delete).not.toHaveBeenCalled();
  });

  it('soft-archives the binding on unbind so historical runs stay traceable', async () => {
    prisma.projectEnvironmentServer.findFirst.mockResolvedValue({
      id: 'binding-1',
      role: 'deploy',
      status: 'active',
      server: { id: 'server-1', name: 'stg-web' },
    });

    await expect(
      service.unbindServer('team-1', 'user-1', 'env-staging', 'server-1'),
    ).resolves.toEqual({ success: true });
    expect(prisma.projectEnvironmentServer.update).toHaveBeenCalledWith({
      where: { id: 'binding-1' },
      data: { status: 'archived' },
    });
    expect(prisma.projectEnvironmentServer.delete).not.toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.server.unbind',
    }));
  });

  it('is idempotent for an already-archived binding', async () => {
    prisma.projectEnvironmentServer.findFirst.mockResolvedValue({
      id: 'binding-1',
      role: 'deploy',
      status: 'archived',
      server: { id: 'server-1', name: 'stg-web' },
    });

    await expect(
      service.unbindServer('team-1', 'user-1', 'env-staging', 'server-1'),
    ).resolves.toEqual({ success: true });
    expect(prisma.projectEnvironmentServer.update).not.toHaveBeenCalled();
  });

  it('rejects a shared-scope declaration that references a foreign environment', async () => {
    prisma.projectEnvironment.findMany.mockResolvedValue([{ id: 'env-shared' }]);

    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', {
        serverId: 'server-1',
        sharedEnvironmentIds: ['env-shared', 'foreign-env'],
      }),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: expect.stringContaining('共享范围包含不属于当前项目的环境'),
    });
    expect(prisma.projectEnvironmentServer.upsert).not.toHaveBeenCalled();
  });

  it('resolves the provider-matched current target exactly like the deploy path', async () => {
    prisma.projectEnvironmentServer.findMany.mockResolvedValue([
      {
        id: 'binding-1',
        role: 'deploy',
        status: 'active',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        metadata: {
          releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/app' },
          sharedEnvironmentIds: ['env-shared'],
        },
        server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', port: 22, username: 'deploy', status: 'online' },
      },
    ]);

    const result = await service.listTargets('team-1', 'env-staging');
    expect(result.providerKey).toBe('ssh-v1');
    expect(result.currentTarget).toEqual(expect.objectContaining({
      bindingId: 'binding-1',
      serverId: 'server-1',
      providerKey: 'ssh-v1',
      targetRef: 'ssh://deploy@10.0.0.1:22/srv/app',
      root: '/srv/app',
      sharedEnvironmentIds: ['env-shared'],
    }));
    expect(typeof result.currentTarget?.versionHash).toBe('string');
    expect(result.currentTarget?.versionHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.bindings).toHaveLength(1);
  });

  it('leaves the current target unresolved when multiple providers are bound (duplicate resolution)', async () => {
    prisma.projectEnvironmentServer.findMany.mockResolvedValue([
      {
        id: 'binding-1',
        role: 'deploy',
        status: 'active',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        metadata: { releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/app' } },
        server: { id: 'server-1', name: 'stg-web', host: '10.0.0.1', port: 22, username: 'deploy', status: 'online' },
      },
      {
        id: 'binding-2',
        role: 'deploy',
        status: 'active',
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
        metadata: { releaseDeployment: { providerKey: 'ssh-v1', root: '/srv/other' } },
        server: { id: 'server-2', name: 'stg-other', host: '10.0.0.2', port: 22, username: 'deploy', status: 'online' },
      },
    ]);

    const result = await service.listTargets('team-1', 'env-staging');
    expect(result.providerKey).toBe('ssh-v1');
    expect(result.currentTarget).toBeNull();
  });

  it('keeps listServers returning only active bindings', async () => {
    prisma.projectEnvironmentServer.findMany.mockResolvedValue([
      { id: 'binding-1', role: 'deploy', status: 'active', server: { id: 'server-1', name: 'stg-web' } },
    ]);

    await service.listServers('team-1', 'env-staging');
    expect(prisma.projectEnvironmentServer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  it('throws NotFound when the server does not belong to the team', async () => {
    prisma.server.findFirst.mockResolvedValue(null);

    await expect(
      service.bindServer('team-1', 'user-1', 'env-staging', { serverId: 'server-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
