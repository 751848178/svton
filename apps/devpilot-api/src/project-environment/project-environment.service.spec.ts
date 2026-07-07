import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto/crypto.service';
import { createTestCryptoService } from '../common/crypto/crypto.test-helpers';
import { ProjectEnvironmentService } from './project-environment.service';
import { ProjectEnvironmentRepository } from './project-environment.repository';
import { ProjectEnvironmentCopySiteService } from './project-environment-copy-site.service';
import { ProjectEnvironmentSyncService } from './project-environment-sync.service';
import { ProjectEnvironmentSyncApplyService } from './project-environment-sync-apply.service';
import { ProjectEnvironmentResourceCopyService } from './project-environment-resource-copy.service';
import { ProjectEnvironmentCdnCopyService } from './project-environment-cdn-copy.service';
import { ProjectEnvironmentBulkBindService } from './project-environment-bulk-bind.service';
import { ProjectEnvironmentDefaultsService } from './project-environment-defaults.service';
import { ProjectEnvironmentServerBindingService } from './project-environment-server-binding.service';
import { ProjectEnvironmentCrudService } from './project-environment-crud.service';

type PrismaMock = {
  project: { findFirst: jest.Mock };
  projectEnvironment: { findMany: jest.Mock; findFirst: jest.Mock; upsert: jest.Mock };
  projectEnvironmentServer: { findMany: jest.Mock; findFirst: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
  server: { findFirst: jest.Mock };
  teamCredential: { findFirst: jest.Mock };
  applicationService: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  deploymentRun: { findMany: jest.Mock };
  site: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
  managedResource: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
  resourceInstance: { findMany: jest.Mock; updateMany: jest.Mock };
  cDNConfig: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
  secretKey: { findMany: jest.Mock; create: jest.Mock; updateMany: jest.Mock };
};

const environments = [
  {
    id: 'env-test',
    projectId: 'project-1',
    key: 'test',
    name: '测试',
    status: 'active',
    sortOrder: 10,
    serverBindings: [],
  },
  {
    id: 'env-prod',
    projectId: 'project-1',
    key: 'prod',
    name: '生产',
    status: 'active',
    sortOrder: 30,
    serverBindings: [
      {
        id: 'binding-1',
        role: 'runtime',
        server: { id: 'server-1', name: 'prod-app-1', host: '10.0.0.1', status: 'online' },
      },
    ],
  },
];

const secretCrypto = createTestCryptoService('test-encryption-key-32-chars-ok!!!');

function decryptStoredSecret(value: string) {
  return secretCrypto.decryptCbc(value);
}

describe('ProjectEnvironmentService sync suggestions', () => {
  let prisma: PrismaMock;
  let auditEventService: { create: jest.Mock };
  let siteService: { createSyncPlan: jest.Mock };
  let service: ProjectEnvironmentService;

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'project-1', config: {} }) },
      projectEnvironment: {
        findMany: jest.fn(({ where }) => {
          const allowedIds = where?.id?.in as string[] | undefined;
          return Promise.resolve(
            allowedIds ? environments.filter((environment) => allowedIds.includes(environment.id)) : environments,
          );
        }),
        findFirst: jest.fn(({ where }) => {
          const environment = environments.find((item) =>
            item.id === where.id &&
            (!where.projectId || item.projectId === where.projectId) &&
            (!where.status || item.status === where.status),
          );
          return Promise.resolve(environment || null);
        }),
        upsert: jest.fn().mockResolvedValue({ id: 'env-upserted' }),
      },
      projectEnvironmentServer: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue({
          id: 'binding-1',
          role: 'runtime',
          server: { id: 'server-1', name: 'app-1' },
        }),
        upsert: jest.fn().mockResolvedValue({
          id: 'binding-1',
          role: 'runtime',
          server: { id: 'server-1', name: 'app-1', host: '10.0.0.1', status: 'online', services: {} },
          project: { id: 'project-1', name: 'Project' },
          environment: { id: 'env-test', key: 'test', name: '测试', status: 'active' },
        }),
        delete: jest.fn().mockResolvedValue({ id: 'binding-1' }),
      },
      server: {
        findFirst: jest.fn().mockResolvedValue({ id: 'server-1' }),
      },
      teamCredential: {
        findFirst: jest.fn().mockResolvedValue({ id: 'cred-test' }),
      },
      applicationService: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'service-prod',
            name: 'api',
            kind: 'docker-compose',
            runtime: 'node',
            environmentId: 'env-prod',
            serverId: 'server-1',
            siteId: 'site-prod',
            managedResourceId: 'resource-prod',
            deployConfig: {
              deployCommand: 'docker compose up -d',
              healthCheckUrl: 'https://api.example.com/health',
            },
            application: { id: 'app-1', name: 'Web' },
          },
          {
            id: 'service-test',
            name: 'api',
            kind: 'docker-compose',
            runtime: 'node',
            environmentId: 'env-test',
            serverId: null,
            siteId: null,
            managedResourceId: null,
            deployConfig: {},
            application: { id: 'app-1', name: 'Web' },
          },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'service-created' }),
        update: jest.fn().mockResolvedValue({ id: 'service-test' }),
      },
      deploymentRun: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'run-prod', environmentId: 'env-prod', status: 'completed' },
        ]),
      },
      site: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'site-prod',
            environmentId: 'env-prod',
            runtimeType: 'reverse_proxy',
            tls: { enabled: true },
            serverId: 'server-1',
          },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'site-created' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      managedResource: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'resource-prod',
            environmentId: 'env-prod',
            provider: 'docker',
            kind: 'mysql',
          },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'resource-test-copy' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      resourceInstance: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'instance-prod',
            environmentId: 'env-prod',
            resourceType: { id: 'type-redis', key: 'redis', name: 'Redis', category: 'middleware' },
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      cDNConfig: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cdn-prod', environmentId: 'env-prod', provider: 'aliyun', status: 'active' },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'cdn-test-copy' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      secretKey: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'secret-prod', environmentId: 'env-prod', type: 'database_password' },
        ]),
        create: jest.fn().mockResolvedValue({ id: 'secret-test-copy' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    auditEventService = { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) };
    siteService = {
      createSyncPlan: jest.fn().mockResolvedValue({
        status: 'completed',
        syncRun: { id: 'site-sync-copy' },
      }),
    };
    const repository = new ProjectEnvironmentRepository(prisma as unknown as PrismaService);
    const copySiteService = new ProjectEnvironmentCopySiteService(
      repository,
      siteService as never,
      auditEventService as never,
    );
    const syncService = new ProjectEnvironmentSyncService(repository);
    const syncApplyService = new ProjectEnvironmentSyncApplyService(
      repository,
      syncService,
      auditEventService as never,
    );
    const resourceCopyService = new ProjectEnvironmentResourceCopyService(
      repository,
      secretCrypto as unknown as CryptoService,
      auditEventService as never,
    );
    const cdnCopyService = new ProjectEnvironmentCdnCopyService(repository, auditEventService as never);
    const bulkBindService = new ProjectEnvironmentBulkBindService(repository, auditEventService as never);
    const defaultsService = new ProjectEnvironmentDefaultsService(repository);
    const serverBindingService = new ProjectEnvironmentServerBindingService(repository, auditEventService as never);
    const crudService = new ProjectEnvironmentCrudService(repository, defaultsService);
    service = new ProjectEnvironmentService(
      prisma as unknown as PrismaService,
      repository,
      copySiteService,
      syncService,
      syncApplyService,
      resourceCopyService,
      cdnCopyService,
      bulkBindService,
      defaultsService,
      serverBindingService,
      crudService,
      auditEventService as never,
      siteService as never,
    );
  });

  it('creates dev/test/staging/prod defaults when project config has no environments', async () => {
    await service.ensureDefaultsForProject('team-1', 'project-1', {});

    expect(prisma.projectEnvironment.upsert).toHaveBeenCalledTimes(4);
    expect(prisma.projectEnvironment.upsert.mock.calls.map(([call]) => call.where.projectId_key.key)).toEqual([
      'dev',
      'test',
      'staging',
      'prod',
    ]);
    expect(prisma.projectEnvironment.upsert.mock.calls.map(([call]) => call.create.sortOrder)).toEqual([
      0,
      10,
      20,
      30,
    ]);
  });

  it('preserves explicit project environment config while normalizing duplicates', async () => {
    await service.ensureDefaultsForProject('team-1', 'project-1', {
      environments: ['prod', ' Staging ', 'staging', 'qa env'],
    });

    expect(prisma.projectEnvironment.upsert.mock.calls.map(([call]) => call.where.projectId_key.key)).toEqual([
      'prod',
      'staging',
      'qa-env',
    ]);
  });

  it('builds read-only sync suggestions against the production reference environment', async () => {
    const result = await service.listSyncSuggestions('team-1', { projectId: 'project-1' });
    const testProfile = result.profiles.find((profile) => profile.environment.id === 'env-test');

    expect(result.referenceEnvironment?.id).toBe('env-prod');
    expect(result.summary.actionCount).toBeGreaterThan(0);
    expect(testProfile?.differences.missing.serverRoles).toEqual(['runtime']);
    expect(testProfile?.differences.missing.resourceKinds).toEqual(['docker/mysql', 'redis']);
    expect(testProfile?.differences.missing.siteRuntimeTypes).toEqual(['reverse_proxy']);
    expect(testProfile?.differences.missing.secretTypes).toEqual(['database_password']);
    expect(testProfile?.differences.missing.cdnProviders).toEqual(['aliyun']);
    expect(testProfile?.differences.deployConfigGaps).toEqual([
      { field: 'deployCommand', missingCount: 1 },
      { field: 'healthCheckUrl', missingCount: 1 },
    ]);
    expect(testProfile?.actions.map((action) => action.kind)).toEqual(expect.arrayContaining([
      'bind_server_role',
      'complete_deploy_config',
      'bind_service_runtime',
      'bind_resource_kind',
      'create_site_runtime',
      'create_cdn_config',
      'create_secret_type',
      'enable_site_tls',
      'run_deployment',
    ]));
  });

  it('uses only readable environments when selecting the reference', async () => {
    const result = await service.listSyncSuggestions(
      'team-1',
      { projectId: 'project-1' },
      ['env-test'],
    );

    expect(result.referenceEnvironment?.id).toBe('env-test');
    expect(result.profiles).toHaveLength(1);
    expect(result.summary.actionCount).toBe(0);
    expect(prisma.projectEnvironment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: ['env-test'] } }),
    }));
  });

  it('rejects an explicit reference environment that is not readable', async () => {
    await expect(service.listSyncSuggestions(
      'team-1',
      { projectId: 'project-1', referenceEnvironmentId: 'env-prod' },
      ['env-test'],
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires a project id', async () => {
    await expect(service.listSyncSuggestions(
      'team-1',
      { projectId: '' },
    )).rejects.toBeInstanceOf(BadRequestException);
  });

  it('binds a server to an environment and writes an audit event', async () => {
    const result = await service.bindServer('team-1', 'user-1', 'env-test', {
      serverId: 'server-1',
      role: 'runtime',
      metadata: { lane: 'blue' },
    });

    expect(result.id).toBe('binding-1');
    expect(prisma.server.findFirst).toHaveBeenCalledWith({
      where: { id: 'server-1', teamId: 'team-1' },
      select: { id: true },
    });
    expect(prisma.projectEnvironmentServer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        environmentId_serverId: {
          environmentId: 'env-test',
          serverId: 'server-1',
        },
      },
      create: expect.objectContaining({
        teamId: 'team-1',
        projectId: 'project-1',
        environmentId: 'env-test',
        serverId: 'server-1',
        role: 'runtime',
      }),
      update: expect.objectContaining({
        projectId: 'project-1',
        role: 'runtime',
        status: 'active',
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.server.bind',
      projectId: 'project-1',
      environmentId: 'env-test',
      serverId: 'server-1',
      risk: 'medium',
      status: 'completed',
      metadata: expect.objectContaining({ role: 'runtime', serverName: 'app-1' }),
    }));
  });

  it('unbinds a server from an environment and writes an audit event', async () => {
    await expect(service.unbindServer('team-1', 'user-1', 'env-test', 'server-1')).resolves.toEqual({ success: true });

    expect(prisma.projectEnvironmentServer.findFirst).toHaveBeenCalledWith({
      where: { teamId: 'team-1', environmentId: 'env-test', serverId: 'server-1' },
      select: {
        id: true,
        role: true,
        server: { select: { id: true, name: true } },
      },
    });
    expect(prisma.projectEnvironmentServer.delete).toHaveBeenCalledWith({ where: { id: 'binding-1' } });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.server.unbind',
      projectId: 'project-1',
      environmentId: 'env-test',
      serverId: 'server-1',
      risk: 'medium',
      status: 'completed',
      metadata: expect.objectContaining({ role: 'runtime', serverName: 'app-1' }),
    }));
  });

  it('returns a dry-run site copy plan and skips sites without target domains', async () => {
    prisma.site.findMany
      .mockResolvedValueOnce([
        {
          id: 'site-prod',
          name: 'api-site',
          primaryDomain: 'api.example.com',
          aliases: ['www.api.example.com'],
          runtimeType: 'reverse_proxy',
          runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
          tls: { enabled: true, type: 'letsencrypt', email: 'ops@example.com', certificate: { serial: 'secret' } },
          accessPolicy: { allowCidrs: ['10.0.0.0/8'] },
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.copySites('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(result.plannedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.steps[0]).toEqual(expect.objectContaining({
      status: 'skipped',
      sourceSiteId: 'site-prod',
      metadata: expect.objectContaining({ reason: 'missing_target_domain' }),
    }));
    expect(prisma.site.create).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.sites.copy',
      risk: 'low',
      status: 'planned',
    }));
  });

  it('copies selected sites as draft skeletons with sanitized tls and no server binding', async () => {
    prisma.site.findMany
      .mockResolvedValueOnce([
        {
          id: 'site-prod',
          name: 'api-site',
          primaryDomain: 'api.example.com',
          aliases: ['www.api.example.com'],
          runtimeType: 'reverse_proxy',
          runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
          tls: {
            enabled: true,
            type: 'letsencrypt',
            email: 'ops@example.com',
            certificate: { serial: 'secret' },
            renewal: { lastRunId: 'renew-1' },
          },
          accessPolicy: { allowCidrs: ['10.0.0.0/8'] },
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.site.create.mockResolvedValue({ id: 'site-test-copy' });

    const result = await service.copySites('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      siteIds: ['site-prod'],
      targetDomainOverrides: { 'site-prod': 'test-api.example.com' },
      confirmationText: '测试',
    });

    expect(result.status).toBe('completed');
    expect(result.appliedCount).toBe(1);
    expect(prisma.site.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        createdById: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-test',
        name: 'api-site (测试)',
        primaryDomain: 'test-api.example.com',
        runtimeType: 'reverse_proxy',
        runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
        tls: { enabled: true, type: 'letsencrypt', email: 'ops@example.com' },
        accessPolicy: { allowCidrs: ['10.0.0.0/8'] },
        status: 'draft',
      }),
      select: { id: true },
    }));
    const createData = prisma.site.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('serverId');
    expect(createData).not.toHaveProperty('proxyConfigId');
    expect(createData.tls).not.toHaveProperty('certificate');
    expect(createData.tls).not.toHaveProperty('renewal');
    expect(siteService.createSyncPlan).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.sites.copy',
      risk: 'medium',
      status: 'completed',
      environmentId: 'env-test',
    }));
  });

  it('copies selected sites into OpenResty takeover mode and creates a dry-run sync plan', async () => {
    prisma.site.findMany
      .mockResolvedValueOnce([
        {
          id: 'site-prod',
          name: 'api-site',
          primaryDomain: 'api.example.com',
          aliases: ['www.api.example.com'],
          runtimeType: 'reverse_proxy',
          runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000', syncBlocked: true },
          tls: { enabled: true, type: 'letsencrypt', email: 'ops@example.com' },
          accessPolicy: { allowCidrs: ['10.0.0.0/8'] },
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.site.create.mockResolvedValue({ id: 'site-test-copy' });

    const result = await service.copySites('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      siteIds: ['site-prod'],
      targetDomainOverrides: { 'site-prod': 'test-api.example.com' },
      openRestyTakeover: true,
      targetServerIds: { 'site-prod': 'server-1' },
      targetUpstreamUrls: { 'site-prod': 'http://10.1.0.20:3000' },
      confirmationText: '测试',
    });

    expect(result.status).toBe('completed');
    expect(result.appliedCount).toBe(1);
    expect(prisma.server.findFirst).toHaveBeenCalledWith({
      where: { id: 'server-1', teamId: 'team-1' },
      select: { id: true },
    });
    expect(prisma.site.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        serverId: 'server-1',
        status: 'pending',
        syncError: null,
        runtimeConfig: expect.objectContaining({
          upstreamUrl: 'http://10.1.0.20:3000',
          syncBlocked: false,
        }),
      }),
      select: { id: true },
    }));
    expect(siteService.createSyncPlan).toHaveBeenCalledWith('team-1', 'user-1', 'site-test-copy', {
      dryRun: true,
    });
    expect(siteService.createSyncPlan).toHaveBeenCalledTimes(1);
    expect(result.steps[0].description).toContain('OpenResty dry-run 接管计划');
    expect(result.steps[0].metadata).toEqual(expect.objectContaining({
      openRestyTakeover: expect.objectContaining({
        enabled: true,
        targetServerId: 'server-1',
        upstreamUrl: 'http://10.1.0.20:3000',
        syncRunId: 'site-sync-copy',
        syncStatus: 'completed',
      }),
    }));
  });

  it('creates a blocked queued live sync approval when takeover copy requests live sync without approval', async () => {
    prisma.site.findMany
      .mockResolvedValueOnce([
        {
          id: 'site-prod',
          name: 'api-site',
          primaryDomain: 'api.example.com',
          aliases: ['www.api.example.com'],
          runtimeType: 'reverse_proxy',
          runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000', syncBlocked: true },
          tls: { enabled: true, type: 'letsencrypt', email: 'ops@example.com' },
          accessPolicy: { allowCidrs: ['10.0.0.0/8'] },
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.site.create.mockResolvedValue({ id: 'site-test-copy' });
    siteService.createSyncPlan
      .mockResolvedValueOnce({ status: 'completed', syncRun: { id: 'site-sync-dry-run' } })
      .mockResolvedValueOnce({
        status: 'blocked',
        syncRun: {
          id: 'site-sync-live-blocked',
          operationApprovalId: 'approval-1',
          operationApproval: { id: 'approval-1', status: 'pending' },
        },
        approval: { id: 'approval-1', status: 'pending' },
      });

    const result = await service.copySites('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      siteIds: ['site-prod'],
      targetDomainOverrides: { 'site-prod': 'test-api.example.com' },
      openRestyTakeover: true,
      targetServerIds: { 'site-prod': 'server-1' },
      targetUpstreamUrls: { 'site-prod': 'http://10.1.0.20:3000' },
      createQueuedLiveSync: true,
      queuedLiveSyncMaxAttempts: 2,
      confirmationText: '测试',
    });

    expect(result.status).toBe('completed');
    expect(siteService.createSyncPlan).toHaveBeenNthCalledWith(1, 'team-1', 'user-1', 'site-test-copy', {
      dryRun: true,
    });
    expect(siteService.createSyncPlan).toHaveBeenNthCalledWith(2, 'team-1', 'user-1', 'site-test-copy', {
      dryRun: false,
      queue: true,
      maxAttempts: 2,
      confirmationText: undefined,
      approvalId: undefined,
      approvalReason: undefined,
    });
    expect(result.steps[0].description).toContain('queued live sync');
    expect(result.steps[0].metadata).toEqual(expect.objectContaining({
      openRestyTakeover: expect.objectContaining({
        syncRunId: 'site-sync-dry-run',
        queuedLiveSync: expect.objectContaining({
          enabled: true,
          syncRunId: 'site-sync-live-blocked',
          syncStatus: 'blocked',
          approvalId: 'approval-1',
          approvalStatus: 'pending',
          maxAttempts: 2,
          confirmationTextProvided: false,
        }),
      }),
    }));
    expect(result.followUp.queuedLiveSync).toEqual(expect.objectContaining({
      requestedCount: 1,
      statusCounts: { blocked: 1 },
      metrics: expect.objectContaining({
        pendingApprovalCount: 1,
        queuedJobCount: 0,
        blockedCount: 1,
      }),
      items: [
        expect.objectContaining({
          sourceSiteId: 'site-prod',
          targetSiteId: 'site-test-copy',
          syncRunId: 'site-sync-live-blocked',
          syncStatus: 'blocked',
          approvalId: 'approval-1',
          approvalStatus: 'pending',
          action: 'approval_required',
          alertLevel: 'warning',
        }),
      ],
      alerts: [
        expect.objectContaining({
          level: 'warning',
          code: 'queued_live_sync_approval_required',
          sourceSiteId: 'site-prod',
          targetSiteId: 'site-test-copy',
          syncRunId: 'site-sync-live-blocked',
          approvalId: 'approval-1',
        }),
      ],
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        followUp: expect.objectContaining({
          queuedLiveSync: expect.objectContaining({
            metrics: expect.objectContaining({
              pendingApprovalCount: 1,
              blockedCount: 1,
            }),
          }),
        }),
      }),
    }));
    expect(result.warnings[0]).toContain('blocked approval');
  });

  it('queues approved live sync for takeover copy with per-site governance fields', async () => {
    prisma.site.findMany
      .mockResolvedValueOnce([
        {
          id: 'site-prod',
          name: 'api-site',
          primaryDomain: 'api.example.com',
          aliases: [],
          runtimeType: 'reverse_proxy',
          runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
          tls: { enabled: false },
          accessPolicy: {},
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.site.create.mockResolvedValue({ id: 'site-test-copy' });
    siteService.createSyncPlan
      .mockResolvedValueOnce({ status: 'completed', syncRun: { id: 'site-sync-dry-run' } })
      .mockResolvedValueOnce({
        status: 'queued',
        syncRun: {
          id: 'site-sync-live-queued',
          serverExecutionJobId: 'job-1',
          operationApprovalId: 'approval-approved',
          operationApproval: { id: 'approval-approved', status: 'approved' },
        },
      });

    const result = await service.copySites('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      siteIds: ['site-prod'],
      targetDomainOverrides: { 'site-prod': 'test-api.example.com' },
      openRestyTakeover: true,
      targetServerIds: { 'site-prod': 'server-1' },
      targetUpstreamUrls: { 'site-prod': 'http://10.1.0.20:3000' },
      createQueuedLiveSync: true,
      queuedLiveSyncMaxAttempts: 3,
      queuedLiveSyncApprovalIds: { 'site-prod': 'approval-approved' },
      queuedLiveSyncConfirmationTexts: { 'site-prod': 'api-site (测试)' },
      queuedLiveSyncApprovalReasons: { 'site-prod': 'copy takeover approved' },
      confirmationText: '测试',
    });

    expect(siteService.createSyncPlan).toHaveBeenNthCalledWith(2, 'team-1', 'user-1', 'site-test-copy', {
      dryRun: false,
      queue: true,
      maxAttempts: 3,
      confirmationText: 'api-site (测试)',
      approvalId: 'approval-approved',
      approvalReason: 'copy takeover approved',
    });
    expect(result.steps[0].metadata).toEqual(expect.objectContaining({
      openRestyTakeover: expect.objectContaining({
        queuedLiveSync: expect.objectContaining({
          enabled: true,
          syncRunId: 'site-sync-live-queued',
          syncStatus: 'queued',
          serverExecutionJobId: 'job-1',
          approvalId: 'approval-approved',
          approvalStatus: 'approved',
          maxAttempts: 3,
          confirmationTextProvided: true,
        }),
      }),
    }));
    expect(result.followUp.queuedLiveSync).toEqual(expect.objectContaining({
      requestedCount: 1,
      statusCounts: { queued: 1 },
      metrics: expect.objectContaining({
        pendingApprovalCount: 0,
        queuedJobCount: 1,
        blockedCount: 0,
      }),
      items: [
        expect.objectContaining({
          sourceSiteId: 'site-prod',
          targetSiteId: 'site-test-copy',
          syncRunId: 'site-sync-live-queued',
          syncStatus: 'queued',
          approvalId: 'approval-approved',
          approvalStatus: 'approved',
          serverExecutionJobId: 'job-1',
          action: 'monitor_queue',
          alertLevel: 'info',
        }),
      ],
      alerts: [
        expect.objectContaining({
          level: 'info',
          code: 'queued_live_sync_job_queued',
          sourceSiteId: 'site-prod',
          targetSiteId: 'site-test-copy',
          syncRunId: 'site-sync-live-queued',
          approvalId: 'approval-approved',
        }),
      ],
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        followUp: expect.objectContaining({
          queuedLiveSync: expect.objectContaining({
            metrics: expect.objectContaining({
              queuedJobCount: 1,
              pendingApprovalCount: 0,
            }),
          }),
        }),
      }),
    }));
  });

  it('skips OpenResty takeover copy when target server or upstream is missing', async () => {
    prisma.site.findMany
      .mockResolvedValueOnce([
        {
          id: 'site-prod',
          name: 'api-site',
          primaryDomain: 'api.example.com',
          aliases: [],
          runtimeType: 'reverse_proxy',
          runtimeConfig: { upstreamUrl: 'http://127.0.0.1:3000' },
          tls: { enabled: false },
          accessPolicy: {},
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.copySites('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: true,
      targetDomainOverrides: { 'site-prod': 'test-api.example.com' },
      openRestyTakeover: true,
      targetUpstreamUrls: { 'site-prod': 'http://10.1.0.20:3000' },
    });

    expect(result.status).toBe('planned');
    expect(result.skippedCount).toBe(1);
    expect(result.steps[0]).toEqual(expect.objectContaining({
      status: 'skipped',
      metadata: expect.objectContaining({ reason: 'missing_target_server' }),
    }));
    expect(prisma.site.create).not.toHaveBeenCalled();
    expect(siteService.createSyncPlan).not.toHaveBeenCalled();
  });

  it('returns a dry-run CDN copy plan and skips configs without explicit target mapping', async () => {
    prisma.cDNConfig.findMany
      .mockResolvedValueOnce([
        {
          id: 'cdn-prod',
          name: 'api-cdn',
          domain: 'cdn.example.com',
          origin: 'https://api.example.com',
          provider: 'aliyun',
          credentialId: 'cred-prod',
          cacheRules: [{ path: '/api/*', ttl: 60 }],
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.copyCdnConfigs('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(result.plannedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.steps[0]).toEqual(expect.objectContaining({
      status: 'skipped',
      sourceCdnConfigId: 'cdn-prod',
      metadata: expect.objectContaining({ reason: 'missing_target_domain' }),
    }));
    expect(prisma.cDNConfig.create).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.cdn_configs.copy',
      risk: 'low',
      status: 'planned',
    }));
  });

  it('copies selected CDN configs as pending skeletons without provider state or implicit credentials', async () => {
    prisma.cDNConfig.findMany
      .mockResolvedValueOnce([
        {
          id: 'cdn-prod',
          name: 'api-cdn',
          domain: 'cdn.example.com',
          origin: 'https://api.example.com',
          provider: 'aliyun',
          credentialId: 'cred-prod',
          cacheRules: [{ path: '/api/*', ttl: 60 }],
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.cDNConfig.create.mockResolvedValue({ id: 'cdn-test-copy' });

    const result = await service.copyCdnConfigs('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      cdnConfigIds: ['cdn-prod'],
      targetDomainOverrides: { 'cdn-prod': 'test-cdn.example.com' },
      targetOriginOverrides: { 'cdn-prod': 'https://test-api.example.com' },
      targetCredentialIds: { 'cdn-prod': 'cred-test' },
      confirmationText: '测试',
    });

    expect(result.status).toBe('completed');
    expect(result.appliedCount).toBe(1);
    expect(prisma.cDNConfig.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        createdById: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-test',
        credentialId: 'cred-test',
        name: 'api-cdn (测试)',
        domain: 'test-cdn.example.com',
        origin: 'https://test-api.example.com',
        provider: 'aliyun',
        cacheRules: [{ path: '/api/*', ttl: 60 }],
        status: 'pending',
      }),
      select: { id: true },
    }));
    const createData = prisma.cDNConfig.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('providerData');
    expect(createData).not.toHaveProperty('syncError');
    expect(createData.credentialId).toBe('cred-test');
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.cdn_configs.copy',
      risk: 'medium',
      status: 'completed',
      environmentId: 'env-test',
    }));
  });

  it('returns a dry-run resource and secret copy plan while skipping missing explicit mappings', async () => {
    prisma.managedResource.findMany.mockResolvedValueOnce([
      {
        id: 'resource-prod',
        sourceType: 'cloud',
        provider: 'aliyun-rds',
        kind: 'database',
        name: 'prod-rds',
        externalId: 'rds-prod',
        status: 'active',
        endpoint: 'prod.mysql',
        serverId: null,
        credentialId: 'cred-prod',
      },
    ]);
    prisma.secretKey.findMany
      .mockResolvedValueOnce([
        {
          id: 'secret-prod',
          name: 'DB_PASSWORD',
          type: 'database_password',
          description: 'prod db',
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await service.copyResources('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(result.plannedCount).toBe(0);
    expect(result.skippedCount).toBe(2);
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'managed_resource',
        status: 'skipped',
        sourceId: 'resource-prod',
        metadata: expect.objectContaining({ reason: 'missing_target_external_id' }),
      }),
      expect.objectContaining({
        type: 'secret_key',
        status: 'skipped',
        sourceId: 'secret-prod',
        metadata: expect.objectContaining({ reason: 'missing_target_secret_value' }),
      }),
    ]));
    expect(prisma.managedResource.create).not.toHaveBeenCalled();
    expect(prisma.secretKey.create).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.resources.copy',
      risk: 'low',
      status: 'planned',
    }));
  });

  it('copies selected resources and secrets as safe skeletons with explicit target values only', async () => {
    prisma.managedResource.findMany
      .mockResolvedValueOnce([
        {
          id: 'resource-prod',
          sourceType: 'cloud',
          provider: 'aliyun-rds',
          kind: 'database',
          name: 'prod-rds',
          externalId: 'rds-prod',
          status: 'active',
          endpoint: 'prod.mysql',
          serverId: 'server-prod',
          credentialId: 'cred-prod',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.secretKey.findMany
      .mockResolvedValueOnce([
        {
          id: 'secret-prod',
          name: 'DB_PASSWORD',
          type: 'database_password',
          description: 'prod db',
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.managedResource.create.mockResolvedValue({ id: 'resource-test-copy' });
    prisma.secretKey.create.mockResolvedValue({ id: 'secret-test-copy' });

    const result = await service.copyResources('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      managedResourceIds: ['resource-prod'],
      secretKeyIds: ['secret-prod'],
      targetResourceExternalIds: { 'resource-prod': 'rds-test' },
      targetResourceNames: { 'resource-prod': 'test-rds' },
      targetResourceEndpoints: { 'resource-prod': 'test.mysql' },
      targetResourceServerIds: { 'resource-prod': 'server-1' },
      targetResourceCredentialIds: { 'resource-prod': 'cred-test' },
      targetSecretNames: { 'secret-prod': 'DB_PASSWORD_TEST' },
      targetSecretValues: { 'secret-prod': ' new-secret-value ' },
      targetSecretDescriptions: { 'secret-prod': 'test db' },
      confirmationText: '测试',
    });

    expect(result.status).toBe('completed');
    expect(result.appliedCount).toBe(2);
    expect(prisma.server.findFirst).toHaveBeenCalledWith({
      where: { id: 'server-1', teamId: 'team-1' },
      select: { id: true },
    });
    expect(prisma.teamCredential.findFirst).toHaveBeenCalledWith({
      where: { id: 'cred-test', teamId: 'team-1' },
      select: { id: true },
    });
    expect(prisma.managedResource.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        createdById: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-test',
        serverId: 'server-1',
        credentialId: 'cred-test',
        sourceType: 'cloud',
        provider: 'aliyun-rds',
        kind: 'database',
        name: 'test-rds',
        externalId: 'rds-test',
        endpoint: 'test.mysql',
        status: 'unknown',
      }),
      select: { id: true },
    }));
    const resourceCreateData = prisma.managedResource.create.mock.calls[0][0].data;
    expect(resourceCreateData).not.toHaveProperty('metadata');
    expect(resourceCreateData).not.toHaveProperty('config');
    expect(resourceCreateData).not.toHaveProperty('syncError');
    expect(resourceCreateData).not.toHaveProperty('lastSyncAt');
    expect(resourceCreateData).not.toHaveProperty('resourceInstanceId');

    expect(prisma.secretKey.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: 'team-1',
        createdById: 'user-1',
        projectId: 'project-1',
        environmentId: 'env-test',
        name: 'DB_PASSWORD_TEST',
        type: 'database_password',
        description: 'test db',
      }),
      select: { id: true },
    }));
    const secretCreateData = prisma.secretKey.create.mock.calls[0][0].data;
    expect(secretCreateData.value).not.toBe(' new-secret-value ');
    expect(secretCreateData.value).not.toContain('new-secret-value');
    expect(decryptStoredSecret(secretCreateData.value)).toBe(' new-secret-value ');
    const auditMetadata = JSON.stringify(auditEventService.create.mock.calls[0][0].metadata);
    expect(auditMetadata).not.toContain('new-secret-value');
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.resources.copy',
      risk: 'medium',
      status: 'completed',
      environmentId: 'env-test',
    }));
  });

  it('returns a dry-run apply plan without mutating services', async () => {
    const result = await service.applySyncSuggestions('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(result.plannedCount).toBe(1);
    expect(result.skippedCount).toBeGreaterThan(0);
    expect(result.steps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'complete_deploy_config',
        status: 'planned',
        targetId: 'service-test',
        metadata: expect.objectContaining({
          fields: ['deployCommand', 'healthCheckUrl'],
        }),
      }),
      expect.objectContaining({
        kind: 'bind_server_role',
        status: 'skipped',
      }),
    ]));
    expect(prisma.applicationService.create).not.toHaveBeenCalled();
    expect(prisma.applicationService.update).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.sync_suggestions.apply',
      risk: 'low',
      status: 'planned',
    }));
  });

  it('applies missing deployConfig fields without overwriting existing target fields', async () => {
    await expect(service.applySyncSuggestions('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      confirmationText: '测试',
    })).resolves.toEqual(expect.objectContaining({
      status: 'completed',
      appliedCount: 1,
    }));

    expect(prisma.applicationService.update).toHaveBeenCalledWith({
      where: { id: 'service-test' },
      data: {
        deployConfig: {
          deployCommand: 'docker compose up -d',
          healthCheckUrl: 'https://api.example.com/health',
        },
      },
      select: { id: true },
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      risk: 'medium',
      status: 'completed',
      environmentId: 'env-test',
    }));
  });

  it('creates missing service skeletons while skipping sensitive bindings', async () => {
    prisma.applicationService.findMany.mockResolvedValue([
      {
        id: 'service-prod',
        name: 'api',
        kind: 'docker-compose',
        runtime: 'node',
        image: 'registry.example.com/api:latest',
        ports: [{ host: 8080, container: 80 }],
        environmentId: 'env-prod',
        applicationId: 'app-1',
        serverId: 'server-1',
        siteId: 'site-prod',
        managedResourceId: 'resource-prod',
        deployConfig: {
          deployCommand: 'docker compose up -d',
          healthCheckUrl: 'https://api.example.com/health',
        },
        metadata: {},
        application: { id: 'app-1', name: 'Web' },
      },
    ]);

    const result = await service.applySyncSuggestions('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      actionKinds: ['create_missing_service'],
      confirmationText: 'test',
    });

    expect(result.appliedCount).toBe(1);
    expect(prisma.applicationService.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        applicationId: 'app-1',
        environmentId: 'env-test',
        name: 'api',
        kind: 'docker-compose',
        runtime: 'node',
        image: 'registry.example.com/api:latest',
        ports: [{ host: 8080, container: 80 }],
        deployConfig: {
          deployCommand: 'docker compose up -d',
          healthCheckUrl: 'https://api.example.com/health',
        },
      }),
      select: { id: true },
    }));
    const createData = prisma.applicationService.create.mock.calls[0][0].data;
    expect(createData).not.toHaveProperty('serverId');
    expect(createData).not.toHaveProperty('siteId');
    expect(createData).not.toHaveProperty('managedResourceId');
    expect(createData).not.toHaveProperty('secretKeyIds');
    expect(createData).not.toHaveProperty('env');
  });

  it('requires target environment confirmation for non-dry-run apply', async () => {
    await expect(service.applySyncSuggestions('team-1', 'user-1', {
      projectId: 'project-1',
      sourceEnvironmentId: 'env-prod',
      targetEnvironmentId: 'env-test',
      dryRun: false,
      confirmationText: 'prod',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns a dry-run resource binding plan without updating resource ownership', async () => {
    prisma.managedResource.findMany.mockResolvedValue([
      { id: 'mr-1', name: 'mysql-1', provider: 'docker', kind: 'mysql', status: 'running', endpoint: 'mysql:3306' },
    ]);
    prisma.resourceInstance.findMany.mockResolvedValue([
      { id: 'ri-1', name: 'redis-instance', status: 'active', resourceType: { key: 'redis', name: 'Redis' } },
    ]);
    prisma.site.findMany.mockResolvedValue([
      { id: 'site-1', name: 'api-site', primaryDomain: 'api.example.com', runtimeType: 'reverse_proxy', status: 'active' },
    ]);
    prisma.cDNConfig.findMany.mockResolvedValue([
      { id: 'cdn-1', name: 'api-cdn', domain: 'cdn.example.com', provider: 'aliyun', status: 'active' },
    ]);
    prisma.secretKey.findMany.mockResolvedValue([
      { id: 'secret-1', name: 'db-password', type: 'database_password', description: 'db password' },
    ]);

    const result = await service.bulkBindResources('team-1', 'user-1', {
      projectId: 'project-1',
      environmentId: 'env-test',
      dryRun: true,
    });

    expect(result.status).toBe('planned');
    expect(result.plannedCount).toBe(5);
    expect(result.steps.map((step) => step.type)).toEqual([
      'managed_resource',
      'resource_instance',
      'site',
      'cdn_config',
      'secret_key',
    ]);
    expect(prisma.managedResource.updateMany).not.toHaveBeenCalled();
    expect(prisma.secretKey.updateMany).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.resources.bulk_bind',
      risk: 'low',
      status: 'planned',
    }));
  });

  it('binds only explicitly selected resource types and ids', async () => {
    prisma.managedResource.findMany.mockResolvedValue([
      { id: 'mr-selected', name: 'mysql-selected', provider: 'docker', kind: 'mysql', status: 'running', endpoint: 'mysql:3306' },
    ]);
    prisma.resourceInstance.findMany.mockResolvedValue([
      { id: 'ri-selected', name: 'redis-selected', status: 'active', resourceType: { key: 'redis', name: 'Redis' } },
    ]);

    const result = await service.bulkBindResources('team-1', 'user-1', {
      projectId: 'project-1',
      environmentId: 'env-test',
      dryRun: false,
      resourceTypes: ['managed_resource', 'resource_instance'],
      resourceIds: {
        managedResourceIds: ['mr-selected'],
        resourceInstanceIds: ['ri-selected'],
      },
      confirmationText: 'test',
    });

    expect(result.appliedCount).toBe(2);
    expect(result.summary).toEqual({
      managedResources: 1,
      resourceInstances: 1,
      sites: 0,
      cdnConfigs: 0,
      secretKeys: 0,
    });
    expect(prisma.managedResource.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['mr-selected'] },
      }),
    }));
    expect(prisma.resourceInstance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { in: ['ri-selected'] },
      }),
    }));
    expect(prisma.site.findMany).not.toHaveBeenCalled();
    expect(prisma.cDNConfig.findMany).not.toHaveBeenCalled();
    expect(prisma.secretKey.findMany).not.toHaveBeenCalled();
    expect(prisma.managedResource.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['mr-selected'] } },
      data: { environmentId: 'env-test' },
    });
    expect(prisma.resourceInstance.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['ri-selected'] } },
      data: { environmentId: 'env-test' },
    });
    expect(prisma.site.updateMany).not.toHaveBeenCalled();
    expect(prisma.cDNConfig.updateMany).not.toHaveBeenCalled();
    expect(prisma.secretKey.updateMany).not.toHaveBeenCalled();
  });

  it('binds unassigned project resources to the target environment after confirmation', async () => {
    prisma.managedResource.findMany.mockResolvedValue([
      { id: 'mr-1', name: 'mysql-1', provider: 'docker', kind: 'mysql', status: 'running', endpoint: 'mysql:3306' },
    ]);
    prisma.resourceInstance.findMany.mockResolvedValue([
      { id: 'ri-1', name: 'redis-instance', status: 'active', resourceType: { key: 'redis', name: 'Redis' } },
    ]);
    prisma.site.findMany.mockResolvedValue([
      { id: 'site-1', name: 'api-site', primaryDomain: 'api.example.com', runtimeType: 'reverse_proxy', status: 'active' },
    ]);
    prisma.cDNConfig.findMany.mockResolvedValue([
      { id: 'cdn-1', name: 'api-cdn', domain: 'cdn.example.com', provider: 'aliyun', status: 'active' },
    ]);
    prisma.secretKey.findMany.mockResolvedValue([
      { id: 'secret-1', name: 'db-password', type: 'database_password', description: 'db password' },
    ]);

    const result = await service.bulkBindResources('team-1', 'user-1', {
      projectId: 'project-1',
      environmentId: 'env-test',
      dryRun: false,
      confirmationText: '测试',
    });

    expect(result.status).toBe('completed');
    expect(result.appliedCount).toBe(5);
    expect(prisma.managedResource.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['mr-1'] } },
      data: { environmentId: 'env-test' },
    });
    expect(prisma.resourceInstance.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['ri-1'] } },
      data: { environmentId: 'env-test' },
    });
    expect(prisma.site.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['site-1'] } },
      data: { environmentId: 'env-test' },
    });
    expect(prisma.cDNConfig.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['cdn-1'] } },
      data: { environmentId: 'env-test' },
    });
    expect(prisma.secretKey.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', projectId: 'project-1', environmentId: null, id: { in: ['secret-1'] } },
      data: { environmentId: 'env-test' },
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      risk: 'medium',
      status: 'completed',
      environmentId: 'env-test',
      metadata: expect.objectContaining({
        summary: {
          managedResources: 1,
          resourceInstances: 1,
          sites: 1,
          cdnConfigs: 1,
          secretKeys: 1,
        },
      }),
    }));
  });

  it('requires target environment confirmation for non-dry-run resource binding', async () => {
    await expect(service.bulkBindResources('team-1', 'user-1', {
      projectId: 'project-1',
      environmentId: 'env-test',
      dryRun: false,
      confirmationText: 'prod',
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
