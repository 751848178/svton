import { ConfigService } from '@nestjs/config';
import { AuditEventService } from '../audit-event';
import { LogCollectionIngestionService } from '../log-center/log-collection-ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { ServerAgentServerExecutorAdapter } from './adapters/server-agent.adapter';
import { ScriptPlanServerExecutorAdapter } from './adapters/script-plan.adapter';
import { SshLiveServerExecutorAdapter } from './adapters/ssh-live.adapter';
import { ServerCommandPolicyService } from './server-command-policy.service';
import { ServerExecutorService } from './server-executor.service';
import { ServerExecutionInput } from './server-executor.types';

describe('ServerExecutorService resource action metric snapshots', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('persists Docker stats snapshots from queued resource action completion output', async () => {
    const prisma = {
      resourceActionRun: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'run-1',
          teamId: 'team-1',
          resourceId: 'resource-1',
          action: 'docker.container.stats',
          dryRun: false,
          status: 'completed',
          resource: {
            id: 'resource-1',
            sourceType: 'server',
            provider: 'docker',
            kind: 'docker_container',
            serverId: 'server-1',
            projectId: 'project-1',
            environmentId: 'env-1',
          },
        }),
      },
      resourceMetricSnapshot: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockImplementation(({ data }: { data: unknown[] }) => ({ count: data.length })),
      },
    } as unknown as PrismaService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      {} as ConfigService,
      {} as LogCollectionIngestionService,
    );
    const persist = service as unknown as {
      persistDockerMetricSnapshotsFromActionRun(
        teamId: string,
        resourceActionRunId: string,
        result: unknown,
        logs?: unknown,
      ): Promise<number>;
    };

    const count = await persist.persistDockerMetricSnapshotsFromActionRun(
      'team-1',
      'run-1',
      {},
      [
        {
          stream: 'stdout',
          message: JSON.stringify({
            CPUPerc: '3.50%',
            MemUsage: '20MiB / 200MiB',
            MemPerc: '10%',
            NetIO: '3kB / 4kB',
            BlockIO: '0B / 5kB',
            PIDs: '9',
          }),
        },
      ],
    );

    expect(count).toBe(1);
    expect(prisma.resourceMetricSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          teamId: 'team-1',
          resourceId: 'resource-1',
          resourceActionRunId: 'run-1',
          serverId: 'server-1',
          projectId: 'project-1',
          environmentId: 'env-1',
          cpuPercent: 3.5,
          memoryPercent: 10,
          pids: 9,
        }),
      ],
    });
  });

  it('refreshes Site.tls metadata from queued TLS probe completion output', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));

    const stdout = [
      'subject=CN = api.example.com',
      'issuer=C = US, O = Let Encrypt Test, CN = R3',
      'serial=ABC123',
      'notBefore=Jun  1 00:00:00 2026 GMT',
      'notAfter=Jul  1 00:00:00 2026 GMT',
      'sha256 Fingerprint=AA:BB:CC',
    ].join('\n');
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'site-1',
          primaryDomain: 'api.example.com',
          tls: { enabled: true, type: 'custom' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      {} as ConfigService,
      {} as LogCollectionIngestionService,
    );
    const refresh = service as unknown as {
      refreshSiteTlsMetadataAfterProbe(
        teamId: string,
        siteId: string,
        result: unknown,
        metadata: Record<string, unknown>,
      ): Promise<void>;
    };

    await refresh.refreshSiteTlsMetadataAfterProbe(
      'team-1',
      'site-1',
      {
        result: { stdoutPreview: stdout },
        logs: [{ stream: 'stdout', message: stdout }],
      },
      {
        tlsProbeHost: 'api.example.com',
        tlsProbePort: 443,
      },
    );

    expect(prisma.site.updateMany).toHaveBeenCalledWith({
      where: { id: 'site-1', teamId: 'team-1' },
      data: {
        tls: expect.objectContaining({
          enabled: true,
          type: 'custom',
          expiresAt: '2026-07-01T00:00:00.000Z',
          daysRemaining: 4,
          currentCertificateAssetId: 'sha256:AA:BB:CC',
          certificateAssetCount: 1,
          certificate: expect.objectContaining({
            fingerprintSha256: 'AA:BB:CC',
          }),
          assets: [
            expect.objectContaining({
              id: 'sha256:AA:BB:CC',
              kind: 'observed_tls_certificate',
              active: true,
              observationCount: 1,
              fingerprintSha256: 'AA:BB:CC',
            }),
          ],
        }),
      },
    });
  });

  it('refreshes Site.tls renewal metadata from queued TLS renewal completion output', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));

    const stdout = 'No renewals were attempted. The following certs are not due for renewal yet: api.example.com';
    const prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'site-1',
          tls: { enabled: true, type: 'letsencrypt' },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      {} as ConfigService,
      {} as LogCollectionIngestionService,
    );
    const refresh = service as unknown as {
      refreshSiteTlsMetadataAfterRenew(
        teamId: string,
        siteId: string,
        dryRun: boolean,
        result: unknown,
        metadata: Record<string, unknown>,
      ): Promise<void>;
    };

    await refresh.refreshSiteTlsMetadataAfterRenew(
      'team-1',
      'site-1',
      true,
      {
        status: 'completed',
        result: { stdoutPreview: stdout },
        logs: [{ stream: 'stdout', message: stdout }],
      },
      {
        siteSyncRunId: 'run-renew-1',
      },
    );

    expect(prisma.site.updateMany).toHaveBeenCalledWith({
      where: { id: 'site-1', teamId: 'team-1' },
      data: {
        tls: expect.objectContaining({
          enabled: true,
          type: 'letsencrypt',
          lastRenewalStatus: 'not_due',
          lastRenewalCheckedAt: '2026-06-27T00:00:00.000Z',
          lastRenewalDryRunAt: '2026-06-27T00:00:00.000Z',
          lastRenewalRunId: 'run-renew-1',
          renewal: expect.objectContaining({
            source: 'certbot_renew',
            status: 'not_due',
            dryRun: true,
            attempted: false,
            succeeded: false,
            runId: 'run-renew-1',
          }),
        }),
      },
    });
  });

  it('queues a follow-up TLS probe after queued live TLS renewal completion', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-27T00:00:00.000Z'));

    const stdout = 'Congratulations, all renewals succeeded: api.example.com';
    const prisma = {
      siteSyncRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'run-probe-1' }),
        update: jest.fn().mockResolvedValue({ id: 'run-probe-1' }),
      },
      site: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'site-1',
            tls: { enabled: true, type: 'letsencrypt' },
          })
          .mockResolvedValueOnce({
            id: 'site-1',
            projectId: 'project-1',
            environmentId: 'env-prod',
            serverId: 'server-1',
            primaryDomain: 'api.example.com',
            runtimeType: 'reverse_proxy',
            tls: { enabled: true, type: 'letsencrypt' },
          }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      serverExecutionJob: {
        create: jest.fn().mockResolvedValue({
          id: 'job-probe-1',
          queuedAt: new Date('2026-06-27T00:00:00.000Z'),
          availableAt: new Date('2026-06-27T00:00:00.000Z'),
        }),
      },
    } as unknown as PrismaService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      {} as ConfigService,
      {} as LogCollectionIngestionService,
    );
    const sync = service as unknown as {
      syncSiteRunAfterExecution(
        input: unknown,
        jobId: string,
        result: unknown,
        metadata: Record<string, unknown>,
      ): Promise<void>;
    };

    await sync.syncSiteRunAfterExecution(
      {
        teamId: 'team-1',
        userId: 'user-1',
        operationKey: 'site.tls_renew',
        adapterKey: 'nginx-site-plan',
        dryRun: false,
        target: {
          transport: 'ssh',
          serverId: 'server-1',
          serverName: 'prod-1',
          serverHost: '10.0.0.1',
        },
        steps: [],
        metadata: {
          businessRunSync: 'site_sync',
          siteId: 'site-1',
          siteSyncRunId: 'run-renew-1',
          mode: 'tls_renew',
        },
      },
      'job-renew-1',
      {
        status: 'completed',
        mode: 'executed',
        executorKey: 'server-executor',
        adapterKey: 'nginx-site-plan',
        executable: true,
        warnings: [],
        commandSteps: [],
        commandPlan: {},
        logs: [{ stream: 'stdout', message: stdout }],
        result: { stdoutPreview: stdout },
      },
      {
        businessRunSync: 'site_sync',
        siteId: 'site-1',
        siteSyncRunId: 'run-renew-1',
        mode: 'tls_renew',
      },
    );

    expect(prisma.siteSyncRun.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        teamId: 'team-1',
        actorId: 'user-1',
        siteId: 'site-1',
        sourceRunId: 'run-renew-1',
        mode: 'tls_probe',
        trigger: 'renewal_follow_up_tls_probe',
        dryRun: false,
        status: 'queued',
        targetConfigPath: 'tls://api.example.com:443',
      }),
    });
    expect(prisma.serverExecutionJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        operationKey: 'site.tls_probe',
        adapterKey: 'nginx-site-plan',
        dryRun: false,
        status: 'queued',
      }),
    }));
    expect(prisma.siteSyncRun.update).toHaveBeenCalledWith({
      where: { id: 'run-probe-1' },
      data: expect.objectContaining({
        status: 'queued',
        serverExecutionJobId: 'job-probe-1',
      }),
    });
    expect(prisma.site.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'site-1', teamId: 'team-1' },
      data: {
        tls: expect.objectContaining({
          lastRenewalFollowUpProbeStatus: 'queued',
          lastRenewalFollowUpProbeRunId: 'run-probe-1',
          lastRenewalFollowUpProbeJobId: 'job-probe-1',
          renewal: expect.objectContaining({
            followUpProbe: expect.objectContaining({
              status: 'queued',
              sourceRenewalRunId: 'run-renew-1',
              siteSyncRunId: 'run-probe-1',
              serverExecutionJobId: 'job-probe-1',
            }),
          }),
        }),
      },
    });
  });

  it('persists remote execution session metadata while a job is running', async () => {
    let currentMetadata: Record<string, unknown> = {
      queueMode: 'inline',
      sourceMetadata: { projectId: 'project-1' },
    };
    const prisma = {
      serverExecutionJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-remote-1', attempt: 1 }),
        updateMany: jest.fn().mockImplementation(({ data }: { data: { metadata?: Record<string, unknown> } }) => {
          if (data.metadata) {
            currentMetadata = data.metadata;
          }
          return { count: 1 };
        }),
        findUnique: jest.fn().mockImplementation(({ select }: { select?: Record<string, unknown> }) => {
          if (select?.status) {
            return { status: 'running', cancelRequestedAt: null };
          }
          return { metadata: currentMetadata };
        }),
      },
    } as unknown as PrismaService;
    const sshLiveAdapter = {
      supports: jest.fn().mockReturnValue(true),
      execute: jest.fn(async (input: ServerExecutionInput) => {
        await input.runtimeObserver?.onRemoteProcessStarted?.({
          transport: 'ssh',
          pid: 4321,
          observedAt: '2026-06-27T00:00:01.000Z',
          operationKey: input.operationKey,
          adapterKey: input.adapterKey,
          cleanupStrategy: 'best_effort_ssh',
        });
        await input.runtimeObserver?.onRemoteProcessCleanup?.({
          transport: 'ssh',
          pid: 4321,
          observedAt: '2026-06-27T00:00:02.000Z',
          reason: 'cancel',
          attempted: true,
          succeeded: true,
        });

        return {
          status: 'cancelled',
          mode: 'cancelled',
          executorKey: 'server-executor',
          adapterKey: input.adapterKey,
          executable: false,
          warnings: [],
          commandSteps: input.steps,
          commandPlan: {},
          logs: [],
          result: {},
          error: 'cancelled',
        };
      }),
    } as unknown as SshLiveServerExecutorAdapter;
    const commandPolicy = {
      evaluate: jest.fn().mockResolvedValue({
        status: 'passed',
        policyKey: 'built-in',
        mode: 'built_in_baseline',
        decisions: [],
        warnings: [],
        blockedReasons: [],
      }),
    } as unknown as ServerCommandPolicyService;
    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      sshLiveAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      commandPolicy,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.execute({
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: false,
      target: { transport: 'none' },
      steps: [],
      metadata: { projectId: 'project-1' },
    })).resolves.toEqual(expect.objectContaining({
      status: 'cancelled',
    }));

    const metadataUpdates = (prisma as unknown as {
      serverExecutionJob: { updateMany: jest.Mock };
    }).serverExecutionJob.updateMany.mock.calls
      .map((call) => call[0])
      .filter((call) => call.data.metadata);

    expect(metadataUpdates).toHaveLength(2);
    expect(metadataUpdates[0]).toEqual(expect.objectContaining({
      where: { id: 'job-remote-1', status: 'running' },
      data: {
        metadata: expect.objectContaining({
          queueMode: 'inline',
          remoteExecution: expect.objectContaining({
            session: expect.objectContaining({
              transport: 'ssh',
              pid: 4321,
              operationKey: 'deployment.run',
              adapterKey: 'deployment-script-plan',
            }),
          }),
        }),
      },
    }));
    expect(metadataUpdates[1]).toEqual(expect.objectContaining({
      where: { id: 'job-remote-1', status: 'running' },
      data: {
        metadata: expect.objectContaining({
          remoteExecution: expect.objectContaining({
            session: expect.objectContaining({ pid: 4321 }),
            cleanup: expect.objectContaining({
              transport: 'ssh',
              pid: 4321,
              reason: 'cancel',
              attempted: true,
              succeeded: true,
            }),
          }),
        }),
      },
    }));
  });

  it('does not attempt stale remote cleanup unless explicitly enabled', async () => {
    const staleJob = {
      id: 'job-stale-disabled',
      teamId: 'team-1',
      actorId: 'user-1',
      retryOfId: null,
      attempt: 1,
      maxAttempts: 1,
      inputSnapshot: {
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        dryRun: false,
        target: { transport: 'ssh', serverId: 'server-1' },
        steps: [],
        metadata: { projectId: 'project-1' },
      },
      lockOwner: 'worker-1',
      lockExpiresAt: new Date(Date.now() - 1000),
      metadata: {
        remoteExecution: {
          session: {
            transport: 'ssh',
            pid: 4321,
            observedAt: '2026-06-27T00:00:01.000Z',
            operationKey: 'deployment.run',
            adapterKey: 'deployment-script-plan',
            cleanupStrategy: 'best_effort_ssh',
          },
        },
      },
    };
    const prisma = {
      serverExecutionJob: {
        findMany: jest.fn().mockResolvedValue([staleJob]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as unknown as PrismaService;
    const sshLiveAdapter = {
      cleanupRemoteExecutionSession: jest.fn(),
    } as unknown as SshLiveServerExecutorAdapter;
    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      sshLiveAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.recoverStaleRunningJobs('team-1')).resolves.toEqual({
      recovered: 1,
      retryJobIds: [],
      remoteCleanups: {
        attempted: 0,
        succeeded: 0,
        failed: 0,
      },
    });
    expect(sshLiveAdapter.cleanupRemoteExecutionSession).not.toHaveBeenCalled();
  });

  it('persists default-off stale remote cleanup results when recovering stale running jobs', async () => {
    let currentMetadata: Record<string, unknown> = {
      queueMode: 'queued',
      remoteExecution: {
        session: {
          transport: 'ssh',
          pid: 4321,
          observedAt: '2026-06-27T00:00:01.000Z',
          serverId: 'server-1',
          operationKey: 'deployment.run',
          adapterKey: 'deployment-script-plan',
          cleanupStrategy: 'best_effort_ssh',
        },
      },
    };
    const staleJob = {
      id: 'job-stale-cleanup',
      teamId: 'team-1',
      actorId: 'user-1',
      retryOfId: null,
      attempt: 1,
      maxAttempts: 1,
      inputSnapshot: {
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        dryRun: false,
        target: { transport: 'ssh', serverId: 'server-1' },
        steps: [],
        metadata: { projectId: 'project-1' },
      },
      lockOwner: 'worker-1',
      lockExpiresAt: new Date(Date.now() - 1000),
      metadata: currentMetadata,
    };
    const prisma = {
      serverExecutionJob: {
        findMany: jest.fn().mockResolvedValue([staleJob]),
        updateMany: jest.fn().mockImplementation(({ data }: { data: { metadata?: Record<string, unknown> } }) => {
          if (data.metadata) {
            currentMetadata = data.metadata;
          }
          return { count: 1 };
        }),
        findUnique: jest.fn().mockResolvedValue({ metadata: currentMetadata }),
      },
    } as unknown as PrismaService;
    const sshLiveAdapter = {
      cleanupRemoteExecutionSession: jest.fn().mockResolvedValue({
        transport: 'ssh',
        pid: 4321,
        observedAt: '2026-06-27T00:00:03.000Z',
        reason: 'stale_recovery',
        attempted: true,
        succeeded: true,
      }),
    } as unknown as SshLiveServerExecutorAdapter;
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      sshLiveAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.recoverStaleRunningJobs('team-1')).resolves.toEqual({
      recovered: 1,
      retryJobIds: [],
      remoteCleanups: {
        attempted: 1,
        succeeded: 1,
        failed: 0,
      },
    });

    expect(sshLiveAdapter.cleanupRemoteExecutionSession).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team-1',
        userId: 'user-1',
        target: expect.objectContaining({
          transport: 'ssh',
          serverId: 'server-1',
        }),
      }),
      expect.objectContaining({
        transport: 'ssh',
        pid: 4321,
        cleanupStrategy: 'best_effort_ssh',
      }),
      'stale_recovery',
    );
    const metadataUpdate = (prisma as unknown as {
      serverExecutionJob: { updateMany: jest.Mock };
    }).serverExecutionJob.updateMany.mock.calls
      .map((call) => call[0])
      .find((call) => call.data.metadata);

    expect(metadataUpdate).toEqual(expect.objectContaining({
      where: { id: 'job-stale-cleanup', status: 'failed' },
      data: {
        metadata: expect.objectContaining({
          queueMode: 'queued',
          remoteExecution: expect.objectContaining({
            session: expect.objectContaining({ pid: 4321 }),
            staleCleanup: expect.objectContaining({
              transport: 'ssh',
              pid: 4321,
              reason: 'stale_recovery',
              attempted: true,
              succeeded: true,
            }),
          }),
        }),
      },
    }));
  });

  it('writes audit events for cancellation requests and queued retries', async () => {
    const runningJob = {
      id: 'job-cancel-1',
      teamId: 'team-1',
      actorId: 'user-original',
      serverId: 'server-1',
      retryOfId: null,
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      transport: 'ssh',
      dryRun: false,
      status: 'running',
      queueMode: 'queued',
      attempt: 1,
      maxAttempts: 2,
      inputSnapshot: {
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        dryRun: false,
        target: { transport: 'ssh', serverId: 'server-1' },
        steps: [],
        metadata: { projectId: 'project-1', environmentId: 'env-1' },
      },
      metadata: {
        sourceMetadata: { projectId: 'project-1', environmentId: 'env-1' },
      },
    };
    const failedJob = {
      ...runningJob,
      id: 'job-retry-1',
      status: 'failed',
      attempt: 1,
      maxAttempts: 1,
    };
    const retryJob = {
      ...failedJob,
      id: 'job-retry-2',
      retryOfId: 'job-retry-1',
      status: 'queued',
      attempt: 2,
      maxAttempts: 2,
    };
    const prisma = {
      serverExecutionJob: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(runningJob)
          .mockResolvedValueOnce(failedJob),
        update: jest.fn().mockResolvedValue({
          ...runningJob,
          cancelRequestedAt: new Date('2026-06-27T00:00:00.000Z'),
        }),
        create: jest.fn().mockResolvedValue(retryJob),
      },
    } as unknown as PrismaService;
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    } as unknown as AuditEventService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      {} as ConfigService,
      {} as LogCollectionIngestionService,
      auditEventService,
    );

    await service.cancelJob('team-1', 'user-admin', 'job-cancel-1');
    await service.retryJob('team-1', 'user-admin', 'job-retry-1', {
      queue: true,
      maxAttempts: 2,
    });

    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-admin',
      projectId: 'project-1',
      environmentId: 'env-1',
      serverId: 'server-1',
      category: 'execution',
      action: 'server_execution_job.cancel.request',
      targetType: 'server_execution_job',
      targetId: 'job-cancel-1',
      risk: 'medium',
      metadata: expect.objectContaining({
        serverExecutionJobId: 'job-cancel-1',
        statusBefore: 'running',
        statusAfter: 'running',
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-admin',
      projectId: 'project-1',
      environmentId: 'env-1',
      serverId: 'server-1',
      category: 'execution',
      action: 'server_execution_job.retry.queue',
      targetType: 'server_execution_job',
      targetId: 'job-retry-1',
      risk: 'medium',
      metadata: expect.objectContaining({
        serverExecutionJobId: 'job-retry-1',
        retryJobId: 'job-retry-2',
        retryAttempt: 2,
        maxAttempts: 2,
      }),
    }));
  });

  it('writes an audit event with remote cleanup evidence when recovering stale jobs', async () => {
    const currentMetadata: Record<string, unknown> = {
      queueMode: 'queued',
      sourceMetadata: { projectId: 'project-1', environmentId: 'env-1' },
      remoteExecution: {
        session: {
          transport: 'ssh',
          pid: 4321,
          observedAt: '2026-06-27T00:00:01.000Z',
          serverId: 'server-1',
          operationKey: 'deployment.run',
          adapterKey: 'deployment-script-plan',
          cleanupStrategy: 'best_effort_ssh',
        },
      },
    };
    const staleJob = {
      id: 'job-stale-audit',
      teamId: 'team-1',
      actorId: 'user-original',
      serverId: 'server-1',
      retryOfId: null,
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      transport: 'ssh',
      dryRun: false,
      status: 'running',
      queueMode: 'queued',
      attempt: 1,
      maxAttempts: 1,
      inputSnapshot: {
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        dryRun: false,
        target: { transport: 'ssh', serverId: 'server-1' },
        steps: [],
        metadata: { projectId: 'project-1', environmentId: 'env-1' },
      },
      lockOwner: 'worker-1',
      lockExpiresAt: new Date('2026-06-27T00:00:00.000Z'),
      metadata: currentMetadata,
    };
    const prisma = {
      serverExecutionJob: {
        findMany: jest.fn().mockResolvedValue([staleJob]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ metadata: currentMetadata }),
      },
    } as unknown as PrismaService;
    const sshLiveAdapter = {
      cleanupRemoteExecutionSession: jest.fn().mockResolvedValue({
        transport: 'ssh',
        pid: 4321,
        observedAt: '2026-06-27T00:00:03.000Z',
        reason: 'stale_recovery',
        attempted: true,
        succeeded: true,
      }),
    } as unknown as SshLiveServerExecutorAdapter;
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    } as unknown as AuditEventService;
    const service = new ServerExecutorService(
      prisma,
      sshLiveAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
      auditEventService,
    );

    await service.recoverStaleRunningJobs('team-1', 'user-admin');

    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-admin',
      projectId: 'project-1',
      environmentId: 'env-1',
      serverId: 'server-1',
      category: 'execution',
      action: 'server_execution_job.recover_stale',
      targetType: 'server_execution_job',
      targetId: 'job-stale-audit',
      risk: 'medium',
      metadata: expect.objectContaining({
        serverExecutionJobId: 'job-stale-audit',
        statusBefore: 'running',
        statusAfter: 'failed',
        remoteCleanup: expect.objectContaining({
          transport: 'ssh',
          pid: 4321,
          reason: 'stale_recovery',
          attempted: true,
          succeeded: true,
        }),
      }),
    }));
  });

  it('returns a supervisor snapshot for queue and worker governance', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-29T00:00:00.000Z'));

    const prisma = {
      serverExecutionLease: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn(({ where }: { where: { status: string } }) => {
          const values: Record<string, number> = {
            running: 2,
            expired: 1,
            blocked: 3,
          };
          return Promise.resolve(values[where.status] || 0);
        }),
      },
      serverExecutionJob: {
        count: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          if (where.transport === 'server_agent') {
            if (where.status === 'queued') {
              const availableAt = where.availableAt as Record<string, unknown>;
              return Promise.resolve(availableAt?.lte ? 1 : 2);
            }
            if (where.status === 'running') {
              return Promise.resolve(where.lockExpiresAt ? 1 : 2);
            }
            const agentValues: Record<string, number> = {
              blocked: 3,
              failed: 4,
              cancelled: 0,
            };
            return Promise.resolve(agentValues[String(where.status)] || 0);
          }
          if (where.status === 'queued') {
            const availableAt = where.availableAt as Record<string, unknown>;
            return Promise.resolve(availableAt?.lte ? 4 : 2);
          }
          if (where.status === 'running') {
            return Promise.resolve(where.lockExpiresAt ? 1 : 3);
          }
          const values: Record<string, number> = {
            blocked: 5,
            failed: 6,
            cancelled: 7,
          };
          return Promise.resolve(values[String(where.status)] || 0);
        }),
        findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          if (where.transport === 'server_agent') {
            return Promise.resolve({
              id: 'job-agent-next',
              operationKey: 'deployment.run',
              adapterKey: 'server-agent',
              serverId: 'server-2',
              priority: 9,
              queuedAt: new Date('2026-06-28T23:51:00.000Z'),
              availableAt: new Date('2026-06-28T23:56:00.000Z'),
              server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
            });
          }
          return Promise.resolve({
            id: 'job-next',
            operationKey: 'deployment.run',
            adapterKey: 'deployment-script-plan',
            serverId: 'server-1',
            priority: 10,
            queuedAt: new Date('2026-06-28T23:50:00.000Z'),
            availableAt: new Date('2026-06-28T23:55:00.000Z'),
            server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
          });
        }),
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          if (where.status === 'running' && where.lockExpiresAt) {
            return Promise.resolve([
              {
                id: 'job-b',
                operationKey: 'site.sync',
                adapterKey: 'nginx-site-plan',
                serverId: 'server-1',
                lockOwner: 'worker-a',
                lastHeartbeatAt: new Date('2026-06-28T23:58:00.000Z'),
                lockExpiresAt: new Date('2026-06-28T23:59:00.000Z'),
                metadata: {
                  remoteExecution: {
                    session: {
                      transport: 'ssh',
                      pid: 4321,
                      observedAt: '2026-06-28T23:58:30.000Z',
                      operationKey: 'site.sync',
                      adapterKey: 'nginx-site-plan',
                      serverId: 'server-1',
                      serverHost: '10.0.0.1',
                      cleanupStrategy: 'best_effort_ssh',
                    },
                  },
                },
                server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
              },
            ]);
          }
          if (where.transport === 'server_agent' && where.status === 'blocked') {
            return Promise.resolve([
              {
                id: 'job-agent-blocked-a',
                operationKey: 'deployment.run',
                adapterKey: 'server-agent',
                serverId: 'server-2',
                queuedAt: new Date('2026-06-28T23:40:00.000Z'),
                finishedAt: new Date('2026-06-28T23:41:00.000Z'),
                error: 'Server agent dispatcher 尚未接入，live agent dispatch 暂不执行',
                result: {
                  mode: 'blocked_live_execution',
                  nextExecutorBoundary: 'server_agent_dispatcher',
                  dispatcherConfigured: false,
                  agentExecutorEnabled: true,
                },
                server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
              },
              {
                id: 'job-agent-blocked-b',
                operationKey: 'site.sync',
                adapterKey: 'server-agent',
                serverId: 'server-1',
                queuedAt: new Date('2026-06-28T23:35:00.000Z'),
                finishedAt: new Date('2026-06-28T23:36:00.000Z'),
                error: 'Server executor 命令策略阻断: blocked pattern',
                result: {
                  mode: 'blocked_live_execution',
                  commandPolicy: { status: 'blocked' },
                },
                server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
              },
            ]);
          }
          if (where.transport === 'server_agent') {
            return Promise.resolve([
              {
                id: 'job-agent-queued-server-2',
                operationKey: 'deployment.run',
                adapterKey: 'server-agent',
                serverId: 'server-2',
                status: 'queued',
                queueMode: 'queued',
                priority: 9,
                queuedAt: new Date('2026-06-28T23:51:00.000Z'),
                availableAt: new Date('2026-06-28T23:56:00.000Z'),
                lockExpiresAt: null,
                finishedAt: null,
                error: null,
                result: null,
                server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
              },
              {
                id: 'job-agent-running-server-1',
                operationKey: 'log.collect',
                adapterKey: 'server-agent',
                serverId: 'server-1',
                status: 'running',
                queueMode: 'queued',
                priority: 5,
                queuedAt: new Date('2026-06-28T23:44:00.000Z'),
                availableAt: new Date('2026-06-28T23:44:00.000Z'),
                lockExpiresAt: new Date('2026-06-29T00:02:00.000Z'),
                finishedAt: null,
                error: null,
                result: null,
                server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
              },
              {
                id: 'job-agent-blocked-b',
                operationKey: 'site.sync',
                adapterKey: 'server-agent',
                serverId: 'server-1',
                status: 'blocked',
                queueMode: 'inline',
                priority: 0,
                queuedAt: new Date('2026-06-28T23:35:00.000Z'),
                availableAt: new Date('2026-06-28T23:35:00.000Z'),
                lockExpiresAt: null,
                finishedAt: new Date('2026-06-28T23:36:00.000Z'),
                error: 'Server executor 命令策略阻断: blocked pattern',
                result: {
                  mode: 'blocked_live_execution',
                  commandPolicy: { status: 'blocked' },
                },
                server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
              },
              {
                id: 'job-agent-failed-server-2',
                operationKey: 'backup.run',
                adapterKey: 'server-agent',
                serverId: 'server-2',
                status: 'failed',
                queueMode: 'queued',
                priority: 1,
                queuedAt: new Date('2026-06-28T23:20:00.000Z'),
                availableAt: new Date('2026-06-28T23:20:00.000Z'),
                lockExpiresAt: null,
                finishedAt: new Date('2026-06-28T23:30:00.000Z'),
                error: 'agent run failed',
                result: null,
                server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
              },
            ]);
          }

          return Promise.resolve([
            {
              id: 'job-a',
              operationKey: 'deployment.run',
              adapterKey: 'deployment-script-plan',
              serverId: 'server-1',
              lockOwner: 'worker-a',
              lastHeartbeatAt: new Date('2026-06-28T23:59:59.000Z'),
              lockExpiresAt: new Date('2026-06-29T00:02:00.000Z'),
              server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
            },
            {
              id: 'job-b',
              operationKey: 'site.sync',
              adapterKey: 'nginx-site-plan',
              serverId: 'server-1',
              lockOwner: 'worker-a',
              lastHeartbeatAt: new Date('2026-06-28T23:58:00.000Z'),
              lockExpiresAt: new Date('2026-06-28T23:59:00.000Z'),
              server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
            },
            {
              id: 'job-c',
              operationKey: 'resource.action',
              adapterKey: 'server-resource-plan',
              serverId: 'server-2',
              lockOwner: 'worker-b',
              lastHeartbeatAt: new Date('2026-06-28T23:59:30.000Z'),
              lockExpiresAt: new Date('2026-06-29T00:03:00.000Z'),
              server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
            },
          ]);
        }),
      },
      server: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'server-1',
            name: 'prod-1',
            host: '10.0.0.1',
            status: 'online',
            services: {
              devpilotAgent: {
                source: 'agent_heartbeat',
                status: 'online',
                agentId: 'agent-prod-1',
                runnerId: 'runner-prod-1',
                hostname: 'prod-1.local',
                version: '0.1.0',
                capabilities: ['deploy', 'logs'],
                lastSeenAt: '2026-06-28T23:59:30.000Z',
                expiresAt: '2026-06-29T00:01:30.000Z',
                heartbeatTtlSeconds: 120,
              },
            },
            tags: [],
          },
          {
            id: 'server-2',
            name: 'prod-2',
            host: '10.0.0.2',
            status: 'online',
            services: {},
            tags: ['devpilot-agent'],
          },
          {
            id: 'server-3',
            name: 'legacy-1',
            host: '10.0.0.3',
            status: 'offline',
            services: { nginx: true },
            tags: [],
          },
        ]),
      },
      auditEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-execution-1',
            action: 'server_execution_job.agent_dispatch',
            targetId: 'job-agent-failed-server-2',
            risk: 'high',
            status: 'failed',
            summary: 'Server agent dispatch backup.run failed',
            metadata: {
              serverExecutionJobId: 'job-agent-failed-server-2',
              operationKey: 'backup.run',
              adapterKey: 'server-agent',
              transport: 'server_agent',
              dryRun: false,
              queueMode: 'queued',
              attempt: 2,
              maxAttempts: 3,
              resultStatus: 'failed',
              resultMode: 'live',
              error: 'hidden in supervisor summary',
            },
            occurredAt: new Date('2026-06-28T23:58:30.000Z'),
            actor: { id: 'user-1', name: 'Alice', email: 'alice@example.test' },
            project: { id: 'project-1', name: 'Prod Project' },
            environment: { id: 'env-1', key: 'prod', name: 'Production', status: 'active' },
            server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
          },
          {
            id: 'audit-execution-2',
            action: 'server_execution_job.recover_stale',
            targetId: 'job-b',
            risk: 'medium',
            status: 'blocked',
            summary: 'Server execution job recovery blocked',
            metadata: {
              operationKey: 'site.sync',
              adapterKey: 'nginx-site-plan',
              transport: 'ssh',
              dryRun: false,
              queueMode: 'queued',
              attempt: 1,
              maxAttempts: 3,
            },
            occurredAt: new Date('2026-06-28T23:57:00.000Z'),
            actor: null,
            project: { id: 'project-1', name: 'Prod Project' },
            environment: { id: 'env-1', key: 'prod', name: 'Production', status: 'active' },
            server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
          },
        ]),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        const values: Record<string, string> = {
          SERVER_EXECUTOR_QUEUE_WORKER_ENABLED: 'true',
          SERVER_EXECUTOR_QUEUE_INTERVAL_SECONDS: '7',
          SERVER_EXECUTOR_QUEUE_BATCH_SIZE: '3',
          SERVER_EXECUTOR_QUEUE_RETRY_DELAY_SECONDS: '11',
          SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS: '90',
          SERVER_EXECUTOR_QUEUE_HEARTBEAT_SECONDS: '20',
          SERVER_EXECUTOR_CANCEL_POLL_SECONDS: '4',
          SERVER_EXECUTOR_QUEUE_RECOVERY_BATCH_SIZE: '12',
          SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_TARGET_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_DISPATCHER_URL: 'https://agent.example.test/internal/dispatch?token=secret',
          SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN: 'dispatcher-token',
          SERVER_EXECUTOR_AGENT_DISPATCHER_TIMEOUT_SECONDS: '12',
          SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN: 'heartbeat-token',
          SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED: 'true',
          SERVER_EXECUTOR_AGENT_HEARTBEAT_TTL_SECONDS: '120',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.getSupervisorSnapshot('team-1')).resolves.toEqual({
      generatedAt: '2026-06-29T00:00:00.000Z',
      worker: expect.objectContaining({
        queueWorkerEnabled: true,
        processingQueue: false,
        runningCancellations: 0,
        queueIntervalSeconds: 7,
        queueBatchSize: 3,
        retryDelaySeconds: 11,
        queueLockTtlSeconds: 90,
        queueHeartbeatSeconds: 20,
        cancellationPollSeconds: 4,
        recoveryBatchSize: 12,
        staleRemoteCleanupEnabled: true,
      }),
      workerInventory: {
        current: expect.objectContaining({
          queueWorkerEnabled: true,
          processingQueue: false,
          runningCancellations: 0,
          queueBatchSize: 3,
          queueHeartbeatSeconds: 20,
          recoveryBatchSize: 12,
          staleRemoteCleanupEnabled: true,
        }),
        status: {
          state: 'degraded',
          reason: 'stale_worker_owner',
        },
        queue: {
          ready: 4,
          scheduled: 2,
          running: 3,
          staleRunning: 1,
          blocked: 5,
          unownedRunning: 0,
        },
        owners: {
          total: 2,
          active: 2,
          stale: 1,
          expired: 0,
          ownedRunningJobs: 3,
          ownedStaleJobs: 1,
          samples: [
            expect.objectContaining({
              lockOwner: 'worker-a',
              status: 'degraded',
              runningJobs: 2,
              activeJobs: 1,
              staleJobs: 1,
              lastHeartbeatAgeSeconds: 1,
              lockExpiresInSeconds: 120,
              sampleJob: expect.objectContaining({ id: 'job-a' }),
            }),
            expect.objectContaining({
              lockOwner: 'worker-b',
              status: 'running',
              runningJobs: 1,
              activeJobs: 1,
              staleJobs: 0,
              lastHeartbeatAgeSeconds: 30,
              lockExpiresInSeconds: 180,
              sampleJob: expect.objectContaining({ id: 'job-c' }),
            }),
          ],
        },
      },
      queueCoordinationPreflight: {
        state: 'degraded',
        reason: 'stale_worker_owner',
        gates: {
          worker: {
            ready: true,
            enabled: true,
            processingQueue: false,
            batchSize: 3,
            intervalSeconds: 7,
            reason: 'queue_worker_enabled',
          },
          queue: {
            ready: true,
            readyJobs: 4,
            scheduledJobs: 2,
            runningJobs: 3,
            blockedJobs: 5,
            backlogJobs: 6,
            reason: 'queue_backlog_active',
          },
          owners: {
            ready: false,
            totalOwners: 2,
            activeOwners: 2,
            staleOwners: 1,
            expiredOwners: 0,
            unownedRunningJobs: 0,
            reason: 'stale_worker_owner',
          },
          recovery: {
            ready: false,
            staleRunningJobs: 1,
            recoveryBatchSize: 12,
            staleRemoteCleanupEnabled: true,
            reason: 'stale_running_jobs',
          },
        },
        pressure: {
          backlogJobs: 6,
          readyJobs: 4,
          scheduledJobs: 2,
          runningJobs: 3,
          staleRunningJobs: 1,
          blockedJobs: 5,
          totalOwners: 2,
          activeOwners: 2,
          staleOwners: 1,
          unownedRunningJobs: 0,
        },
        blockers: [
          { reason: 'stale_worker_owner', severity: 'warning', count: 1 },
          { reason: 'stale_running_jobs', severity: 'warning', count: 1 },
          { reason: 'blocked_jobs', severity: 'warning', count: 5 },
        ],
        nextSteps: [
          { action: 'inspect_worker_owners', reason: 'stale_worker_owner' },
          { action: 'recover_stale_jobs', reason: 'stale_running_jobs' },
          { action: 'inspect_blocked_jobs', reason: 'blocked_jobs' },
        ],
      },
      remoteOrphanGovernancePreflight: {
        state: 'degraded',
        reason: 'stale_worker_owner',
        gates: {
          remoteSession: {
            ready: true,
            scannedJobs: 1,
            recoverableRemoteSessions: 1,
            missingRemoteSessions: 0,
            invalidRemoteSessions: 0,
            reason: 'remote_sessions_tracked',
          },
          cleanup: {
            ready: true,
            enabled: true,
            cleanupRecorded: 0,
            cleanupAttempted: 0,
            cleanupSucceeded: 0,
            cleanupFailed: 0,
            reason: 'stale_remote_cleanup_enabled',
          },
          owners: {
            ready: false,
            activeOwners: 2,
            staleOwners: 1,
            expiredOwners: 0,
            unownedStaleJobs: 0,
            reason: 'stale_worker_owner',
          },
          recovery: {
            ready: true,
            staleRunningJobs: 1,
            scannedJobs: 1,
            unscannedStaleJobs: 0,
            recoveryBatchSize: 12,
            reason: 'stale_recovery_batch_ready',
          },
        },
        risk: {
          staleRunningJobs: 1,
          scannedJobs: 1,
          unscannedStaleJobs: 0,
          recoverableRemoteSessions: 1,
          missingRemoteSessions: 0,
          invalidRemoteSessions: 0,
          cleanupRecorded: 0,
          cleanupAttempted: 0,
          cleanupSucceeded: 0,
          cleanupFailed: 0,
          activeOwners: 2,
          staleOwners: 1,
          expiredOwners: 0,
          unownedStaleJobs: 0,
        },
        samples: [
          expect.objectContaining({
            id: 'job-b',
            operationKey: 'site.sync',
            lockOwner: 'worker-a',
            lockExpiresAt: '2026-06-28T23:59:00.000Z',
            remoteSession: expect.objectContaining({
              transport: 'ssh',
              pid: 4321,
              cleanupStrategy: 'best_effort_ssh',
            }),
            cleanup: null,
          }),
        ],
        blockers: [
          { reason: 'stale_worker_owner', severity: 'warning', count: 1 },
        ],
        nextSteps: [
          { action: 'inspect_worker_owners', reason: 'stale_worker_owner' },
        ],
      },
      executionAuditVisibility: {
        totalRecent: 2,
        failedRecent: 1,
        blockedRecent: 1,
        highRiskRecent: 1,
        statuses: [
          { status: 'blocked', count: 1 },
          { status: 'failed', count: 1 },
        ],
        risks: [
          { risk: 'high', count: 1 },
          { risk: 'medium', count: 1 },
        ],
        actions: [
          { action: 'server_execution_job.agent_dispatch', count: 1 },
          { action: 'server_execution_job.recover_stale', count: 1 },
        ],
        samples: [
          expect.objectContaining({
            id: 'audit-execution-1',
            action: 'server_execution_job.agent_dispatch',
            serverExecutionJobId: 'job-agent-failed-server-2',
            status: 'failed',
            risk: 'high',
            occurredAt: '2026-06-28T23:58:30.000Z',
            metadata: {
              serverExecutionJobId: 'job-agent-failed-server-2',
              operationKey: 'backup.run',
              adapterKey: 'server-agent',
              transport: 'server_agent',
              dryRun: false,
              queueMode: 'queued',
              attempt: 2,
              maxAttempts: 3,
              resultStatus: 'failed',
              resultMode: 'live',
            },
          }),
          expect.objectContaining({
            id: 'audit-execution-2',
            serverExecutionJobId: 'job-b',
            status: 'blocked',
            risk: 'medium',
            metadata: expect.objectContaining({
              serverExecutionJobId: 'job-b',
              operationKey: 'site.sync',
              adapterKey: 'nginx-site-plan',
            }),
          }),
        ],
      },
      queue: {
        ready: 4,
        scheduled: 2,
        running: 3,
        staleRunning: 1,
        blocked: 5,
        failed: 6,
        cancelled: 7,
        nextQueuedJob: expect.objectContaining({
          id: 'job-next',
          operationKey: 'deployment.run',
          priority: 10,
          queuedAt: '2026-06-28T23:50:00.000Z',
          availableAt: '2026-06-28T23:55:00.000Z',
        }),
      },
      leases: {
        running: 2,
        expired: 1,
        blocked: 3,
      },
      workers: [
        expect.objectContaining({
          lockOwner: 'worker-a',
          runningJobs: 2,
          staleJobs: 1,
          lastHeartbeatAt: '2026-06-28T23:59:59.000Z',
          lockExpiresAt: '2026-06-29T00:02:00.000Z',
          sampleJob: expect.objectContaining({ id: 'job-a' }),
        }),
        expect.objectContaining({
          lockOwner: 'worker-b',
          runningJobs: 1,
          staleJobs: 0,
          sampleJob: expect.objectContaining({ id: 'job-c' }),
        }),
      ],
      agent: {
        targetSelectionEnabled: true,
        dispatcher: {
          executorEnabled: true,
          dispatcherConfigured: true,
          dispatcherUrl: 'https://agent.example.test/internal/dispatch',
          timeoutSeconds: 12,
          tokenConfigured: true,
        },
        lifecyclePreflight: {
          state: 'degraded',
          reason: 'missing_runtime_heartbeat',
          gates: {
            targetSelection: {
              ready: true,
              enabled: true,
              capableServers: 2,
              onlineCapableServers: 2,
              reason: 'agent_targets_available',
            },
            heartbeat: {
              ready: false,
              enabled: true,
              tokenConfigured: true,
              requiredForTargetSelection: true,
              heartbeatServers: 1,
              readyServers: 1,
              issueServers: 0,
              missingHeartbeatServers: 1,
              reason: 'missing_runtime_heartbeat',
            },
            dispatcher: {
              ready: true,
              executorEnabled: true,
              dispatcherConfigured: true,
              tokenConfigured: true,
              liveDispatchReadyServers: 1,
              reason: 'dispatcher_ready',
            },
            queueWorker: {
              ready: true,
              enabled: true,
              queuedJobs: 3,
              runningJobs: 2,
              staleRunningJobs: 1,
              blockedJobs: 3,
              reason: 'queue_worker_enabled',
            },
          },
          pressure: {
            servers: 2,
            scannedJobs: 4,
            queuedJobs: 3,
            runningJobs: 2,
            blockedJobs: 3,
          },
          blockers: [
            { reason: 'missing_runtime_heartbeat', severity: 'warning', count: 1 },
            { reason: 'stale_agent_running_jobs', severity: 'warning', count: 1 },
            { reason: 'blocked_agent_jobs', severity: 'warning', count: 3 },
          ],
          nextSteps: [
            {
              action: 'roll_out_missing_agent_heartbeats',
              reason: 'missing_runtime_heartbeat',
            },
            {
              action: 'recover_stale_agent_jobs',
              reason: 'stale_agent_running_jobs',
            },
            {
              action: 'inspect_blocked_agent_jobs',
              reason: 'blocked_agent_jobs',
            },
          ],
        },
        taskPullReadiness: {
          state: 'blocked',
          reason: 'task_pull_contract_disabled',
          gates: {
            runtime: {
              ready: false,
              targetSelectionEnabled: true,
              capableServers: 2,
              onlineCapableServers: 2,
              heartbeatEnabled: true,
              heartbeatTokenConfigured: true,
              heartbeatRequiredForTargetSelection: true,
              heartbeatServers: 1,
              readyServers: 1,
              issueServers: 0,
              missingHeartbeatServers: 1,
              reason: 'missing_runtime_heartbeat',
            },
            queue: {
              ready: true,
              queueWorkerEnabled: true,
              readyJobs: 1,
              scheduledJobs: 2,
              runningJobs: 2,
              staleRunningJobs: 1,
              blockedJobs: 3,
              failedJobs: 4,
              cancelledJobs: 0,
              reason: 'agent_queue_backlog_ready',
            },
            pullContract: {
              ready: false,
              endpointImplemented: true,
              contractEndpointEnabled: false,
              pullEndpointImplemented: false,
              taskPullEnabled: false,
              claimSupported: false,
              ackSupported: false,
              lifecycleExecutionSupported: false,
              reason: 'task_pull_contract_disabled',
            },
            audit: {
              ready: true,
              totalRecent: 2,
              failedRecent: 1,
              blockedRecent: 1,
              highRiskRecent: 1,
              reason: 'execution_audit_risk_present',
            },
          },
          pressure: {
            readyJobs: 1,
            scheduledJobs: 2,
            runningJobs: 2,
            staleRunningJobs: 1,
            blockedJobs: 3,
            failedJobs: 4,
            cancelledJobs: 0,
            pressureJobs: 12,
          },
          samples: {
            nextQueuedJob: expect.objectContaining({
              id: 'job-agent-next',
              operationKey: 'deployment.run',
              priority: 9,
            }),
            blockedReasons: expect.arrayContaining([
              expect.objectContaining({
                reason: 'Server agent dispatcher 尚未接入，live agent dispatch 暂不执行',
                count: 1,
                nextExecutorBoundary: 'server_agent_dispatcher',
              }),
            ]),
            blockedReasonSamples: expect.arrayContaining([
              expect.objectContaining({
                id: 'job-agent-blocked-a',
                nextExecutorBoundary: 'server_agent_dispatcher',
              }),
            ]),
          },
          blockers: expect.arrayContaining([
            { reason: 'task_pull_contract_disabled', severity: 'critical', count: 5 },
            { reason: 'missing_runtime_heartbeat', severity: 'warning', count: 1 },
            { reason: 'execution_audit_risk_present', severity: 'warning', count: 3 },
          ]),
          nextSteps: expect.arrayContaining([
            { action: 'enable_agent_task_pull_contract', reason: 'task_pull_contract_disabled' },
            { action: 'inspect_execution_audit_events', reason: 'execution_audit_risk_present' },
          ]),
        },
        totalServers: 3,
        capableServers: 2,
        serviceCapabilityServers: 1,
        tagCapabilityServers: 1,
        onlineCapableServers: 2,
        runtime: {
          heartbeatEnabled: true,
          tokenConfigured: true,
          requiredForTargetSelection: true,
          defaultTtlSeconds: 120,
          heartbeatServers: 1,
          onlineServers: 1,
          staleServers: 0,
          unknownServers: 0,
        },
        runtimeHealth: {
          totalServers: 2,
          readyServers: 1,
          degradedServers: 0,
          staleServers: 0,
          unknownServers: 0,
          missingHeartbeatServers: 1,
          expiringSoonServers: 0,
          statusCounts: [
            { status: 'missing', count: 1 },
            { status: 'online', count: 1 },
          ],
          samples: [
            expect.objectContaining({
              id: 'server-2',
              health: expect.objectContaining({
                state: 'missing',
                reason: 'heartbeat_missing',
                expiringSoon: false,
                capabilities: [],
              }),
            }),
          ],
        },
        statusCounts: [
          { status: 'online', count: 1 },
          { status: 'tagged', count: 1 },
        ],
        samples: [
          {
            id: 'server-1',
            name: 'prod-1',
            host: '10.0.0.1',
            status: 'online',
            agentRef: {
              source: 'server_services',
              referenceId: 'server-1',
              displayName: 'prod-1 agent',
              capabilityKey: 'devpilotAgent',
              status: 'online',
              redacted: true,
            },
            runtime: {
              state: 'online',
              status: 'online',
              agentId: 'agent-prod-1',
              runnerId: 'runner-prod-1',
              hostname: 'prod-1.local',
              version: '0.1.0',
              lastSeenAt: '2026-06-28T23:59:30.000Z',
              expiresAt: '2026-06-29T00:01:30.000Z',
              heartbeatTtlSeconds: 120,
              capabilities: ['deploy', 'logs'],
            },
          },
          {
            id: 'server-2',
            name: 'prod-2',
            host: '10.0.0.2',
            status: 'online',
            agentRef: {
              source: 'server_tags',
              referenceId: 'server-2',
              displayName: 'prod-2 agent',
              capabilityKey: 'devpilot-agent',
              status: 'tagged',
              redacted: true,
            },
          },
        ],
        fleet: {
          totalServers: 2,
          liveDispatchReadyServers: 1,
          pressureServers: 2,
          scannedJobs: 4,
          truncated: false,
          items: [
            expect.objectContaining({
              id: 'server-1',
              runtimeHealth: expect.objectContaining({
                state: 'ready',
                reason: 'runtime_online',
                expiringSoon: false,
                lastSeenAgeSeconds: 30,
                expiresInSeconds: 90,
                heartbeatTtlSeconds: 120,
                capabilities: ['deploy', 'logs'],
              }),
              readiness: {
                targetReady: true,
                liveDispatchReady: true,
                blockingReasons: [],
              },
              jobs: expect.objectContaining({
                ready: 0,
                running: 1,
                blocked: 1,
                failed: 0,
                pressure: 2,
                blockedSample: expect.objectContaining({
                  id: 'job-agent-blocked-b',
                  reason: 'Server executor 命令策略阻断: blocked pattern',
                }),
              }),
            }),
            expect.objectContaining({
              id: 'server-2',
              runtimeHealth: expect.objectContaining({
                state: 'missing',
                reason: 'heartbeat_missing',
                expiringSoon: false,
                capabilities: [],
              }),
              readiness: {
                targetReady: false,
                liveDispatchReady: false,
                blockingReasons: ['missing_heartbeat'],
              },
              jobs: expect.objectContaining({
                ready: 1,
                running: 0,
                blocked: 0,
                failed: 1,
                pressure: 2,
                nextQueuedJob: expect.objectContaining({
                  id: 'job-agent-queued-server-2',
                  priority: 9,
                }),
              }),
            }),
          ],
        },
        jobs: {
          ready: 1,
          scheduled: 2,
          running: 2,
          staleRunning: 1,
          blocked: 3,
          failed: 4,
          cancelled: 0,
          nextQueuedJob: expect.objectContaining({
            id: 'job-agent-next',
            operationKey: 'deployment.run',
            adapterKey: 'server-agent',
            priority: 9,
            queuedAt: '2026-06-28T23:51:00.000Z',
            availableAt: '2026-06-28T23:56:00.000Z',
            server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
          }),
          blockedReasons: {
            scanned: 2,
            dispatcherBoundaryJobs: 1,
            reasonCounts: [
              {
                reason: 'Server agent dispatcher 尚未接入，live agent dispatch 暂不执行',
                count: 1,
                nextExecutorBoundary: 'server_agent_dispatcher',
              },
              {
                reason: 'Server executor 命令策略阻断: blocked pattern',
                count: 1,
              },
            ],
            samples: [
              {
                id: 'job-agent-blocked-a',
                operationKey: 'deployment.run',
                adapterKey: 'server-agent',
                serverId: 'server-2',
                queuedAt: '2026-06-28T23:40:00.000Z',
                finishedAt: '2026-06-28T23:41:00.000Z',
                server: { id: 'server-2', name: 'prod-2', host: '10.0.0.2', status: 'online' },
                reason: 'Server agent dispatcher 尚未接入，live agent dispatch 暂不执行',
                nextExecutorBoundary: 'server_agent_dispatcher',
                dispatcherConfigured: false,
                agentExecutorEnabled: true,
              },
              {
                id: 'job-agent-blocked-b',
                operationKey: 'site.sync',
                adapterKey: 'server-agent',
                serverId: 'server-1',
                queuedAt: '2026-06-28T23:35:00.000Z',
                finishedAt: '2026-06-28T23:36:00.000Z',
                server: { id: 'server-1', name: 'prod-1', host: '10.0.0.1', status: 'online' },
                reason: 'Server executor 命令策略阻断: blocked pattern',
              },
            ],
          },
        },
      },
    });
    expect(prisma.serverExecutionLease.updateMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        status: 'running',
        expiresAt: { lte: new Date('2026-06-29T00:00:00.000Z') },
      },
      data: {
        status: 'expired',
        activeKey: null,
        releasedAt: new Date('2026-06-29T00:00:00.000Z'),
      },
    });
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        teamId: 'team-1',
        category: 'execution',
        targetType: 'server_execution_job',
      },
      orderBy: { occurredAt: 'desc' },
      take: 12,
    }));
    expect(prisma.server.findMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        services: true,
        tags: true,
      },
    });
  });

  it('records token-protected server agent heartbeats into server services', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-29T00:10:00.000Z'));

    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'server-1',
          name: 'prod-1',
          host: '10.0.0.1',
          status: 'online',
          services: { nginx: true, serverAgent: { status: 'ready' } },
          tags: ['deploy'],
        }),
        update: jest.fn().mockImplementation(({ data }: { data: { services: unknown } }) => ({
          id: 'server-1',
          name: 'prod-1',
          host: '10.0.0.1',
          status: 'online',
          services: data.services,
          tags: ['deploy'],
        })),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        const values: Record<string, string> = {
          SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED: 'true',
          SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN: 'heartbeat-token',
          SERVER_EXECUTOR_AGENT_HEARTBEAT_TTL_SECONDS: '120',
        };
        return values[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.recordServerAgentHeartbeat(
      { authorization: 'Bearer wrong-token' },
      {
        teamId: 'team-1',
        serverId: 'server-1',
        agentId: 'agent-prod-1',
      },
    )).rejects.toThrow('Server agent heartbeat token 无效');
    expect(prisma.server.update).not.toHaveBeenCalled();

    await expect(service.recordServerAgentHeartbeat(
      { 'x-devpilot-agent-token': 'heartbeat-token' },
      {
        teamId: 'team-1',
        serverId: 'server-1',
        agentId: 'agent-prod-1',
        runnerId: 'runner-prod-1',
        hostname: 'prod-1.local',
        version: '0.1.0',
        status: 'ready',
        ttlSeconds: 60,
        capabilities: ['deploy', 'logs', ''],
      },
    )).resolves.toEqual({
      accepted: true,
      server: {
        id: 'server-1',
        name: 'prod-1',
        host: '10.0.0.1',
        status: 'online',
      },
      agent: {
        runtime: {
          state: 'online',
          status: 'ready',
          agentId: 'agent-prod-1',
          runnerId: 'runner-prod-1',
          hostname: 'prod-1.local',
          version: '0.1.0',
          lastSeenAt: '2026-06-29T00:10:00.000Z',
          expiresAt: '2026-06-29T00:11:00.000Z',
          heartbeatTtlSeconds: 60,
          capabilities: ['deploy', 'logs'],
        },
      },
    });

    expect(prisma.server.update).toHaveBeenCalledWith({
      where: { id: 'server-1' },
      data: {
        services: expect.objectContaining({
          nginx: true,
          serverAgent: { status: 'ready' },
          devpilotAgent: expect.objectContaining({
            enabled: true,
            source: 'agent_heartbeat',
            status: 'ready',
            agentId: 'agent-prod-1',
            runnerId: 'runner-prod-1',
            hostname: 'prod-1.local',
            version: '0.1.0',
            capabilities: ['deploy', 'logs'],
            lastSeenAt: '2026-06-29T00:10:00.000Z',
            expiresAt: '2026-06-29T00:11:00.000Z',
            heartbeatTtlSeconds: 60,
            redacted: true,
          }),
        }),
      },
      select: {
        id: true,
        name: true,
        host: true,
        status: true,
        services: true,
        tags: true,
      },
    });
  });

  it('keeps server agent task-pull contract disabled by default', async () => {
    const prisma = {
      server: {
        findFirst: jest.fn(),
      },
      serverExecutionJob: {
        count: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.readServerAgentTaskPullContract(
      { 'x-devpilot-agent-token': 'heartbeat-token' },
      {
        teamId: 'team-1',
        serverId: 'server-1',
        agentId: 'agent-prod-1',
      },
    )).rejects.toThrow('Server agent task-pull contract 未启用');
    expect(prisma.server.findFirst).not.toHaveBeenCalled();
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
  });

  it('returns a read-only server agent task-pull contract without claiming jobs', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-29T00:30:00.000Z'));

    const nextQueuedJob = {
      id: 'job-agent-next',
      operationKey: 'deployment.run',
      adapterKey: 'server-agent',
      serverId: 'server-1',
      priority: 9,
      queuedAt: new Date('2026-06-29T00:25:00.000Z'),
      availableAt: new Date('2026-06-29T00:29:00.000Z'),
      server: {
        id: 'server-1',
        name: 'prod-1',
        host: '10.0.0.1',
        status: 'online',
      },
    };
    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'server-1',
          name: 'prod-1',
          host: '10.0.0.1',
          status: 'online',
          services: {
            serverAgent: { status: 'ready' },
            devpilotAgent: {
              source: 'agent_heartbeat',
              status: 'online',
              agentId: 'agent-prod-1',
              runnerId: 'runner-prod-1',
              capabilities: ['deploy', 'logs'],
              lastSeenAt: '2026-06-29T00:29:30.000Z',
              expiresAt: '2026-06-29T00:32:00.000Z',
              heartbeatTtlSeconds: 120,
            },
          },
          tags: [],
        }),
      },
      serverExecutionJob: {
        count: jest.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
        findFirst: jest.fn().mockResolvedValue(nextQueuedJob),
        updateMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const configValues: Record<string, string> = {
      SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED: 'true',
      SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN: 'contract-token',
      SERVER_EXECUTOR_AGENT_TASK_PULL_POLL_INTERVAL_SECONDS: '45',
      SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED: 'true',
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => configValues[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.readServerAgentTaskPullContract(
      { 'x-devpilot-agent-task-pull-token': 'contract-token' },
      {
        teamId: 'team-1',
        serverId: 'server-1',
        agentId: 'agent-prod-1',
        runnerId: 'runner-prod-1',
        capabilities: ['deploy', ''],
      },
    )).resolves.toEqual(expect.objectContaining({
      accepted: true,
      generatedAt: '2026-06-29T00:30:00.000Z',
      contract: expect.objectContaining({
        version: 'server-agent-task-pull.v0',
        mode: 'readiness_only',
        contractEndpointEnabled: true,
        pullEndpointImplemented: false,
        taskPullEnabled: false,
        claimSupported: false,
        ackSupported: false,
        lifecycleExecutionSupported: false,
        longConnectionSupported: false,
        poll: {
          minIntervalSeconds: 30,
          recommendedIntervalSeconds: 45,
        },
        boundaries: expect.arrayContaining(['no_job_claim', 'no_ack', 'no_lifecycle_execution']),
      }),
      agent: expect.objectContaining({
        agentId: 'agent-prod-1',
        runnerId: 'runner-prod-1',
        requestedCapabilities: ['deploy'],
        runtime: expect.objectContaining({
          state: 'online',
          agentId: 'agent-prod-1',
          capabilities: ['deploy', 'logs'],
        }),
      }),
      readiness: expect.objectContaining({
        state: 'blocked',
        reason: 'task_pull_disabled',
        gates: expect.objectContaining({
          runtime: expect.objectContaining({
            ready: true,
            capabilityReady: true,
            heartbeatRequiredForTargetSelection: true,
            heartbeatState: 'online',
          }),
          queue: expect.objectContaining({
            readyJobs: 1,
            scheduledJobs: 2,
            runningJobs: 1,
            staleRunningJobs: 1,
            blockedJobs: 1,
            failedJobs: 1,
            cancelledJobs: 0,
            pressureJobs: 7,
          }),
          contract: expect.objectContaining({
            contractEndpointImplemented: true,
            contractEndpointEnabled: true,
            pullEndpointImplemented: false,
            taskPullEnabled: false,
            claimSupported: false,
            ackSupported: false,
            reason: 'task_pull_disabled',
          }),
        }),
        samples: {
          nextQueuedJob: expect.objectContaining({
            id: 'job-agent-next',
            operationKey: 'deployment.run',
            priority: 9,
          }),
        },
        blockers: expect.arrayContaining([
          { reason: 'task_pull_disabled', severity: 'critical', count: 4 },
          { reason: 'stale_agent_running_jobs', severity: 'warning', count: 1 },
          { reason: 'blocked_agent_jobs', severity: 'warning', count: 1 },
          { reason: 'failed_agent_jobs', severity: 'warning', count: 1 },
        ]),
      }),
    }));
    expect(prisma.serverExecutionJob.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        teamId: 'team-1',
        serverId: 'server-1',
        transport: 'server_agent',
        status: 'queued',
        queueMode: 'queued',
      }),
    }));
    expect(prisma.serverExecutionJob.updateMany).not.toHaveBeenCalled();
  });

  it('can require an online agent heartbeat before selecting server_agent targets', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-29T00:20:00.000Z'));

    const staleAgentServer = {
      id: 'server-1',
      name: 'prod-1',
      host: '10.0.0.1',
      port: 22,
      username: 'deploy',
      authType: 'key',
      services: {
        devpilotAgent: {
          source: 'agent_heartbeat',
          status: 'online',
          agentId: 'agent-prod-1',
          lastSeenAt: '2026-06-29T00:10:00.000Z',
          expiresAt: '2026-06-29T00:19:00.000Z',
        },
      },
      tags: [],
    };
    const onlineAgentServer = {
      ...staleAgentServer,
      services: {
        devpilotAgent: {
          source: 'agent_heartbeat',
          status: 'online',
          agentId: 'agent-prod-1',
          lastSeenAt: '2026-06-29T00:19:30.000Z',
          expiresAt: '2026-06-29T00:21:30.000Z',
        },
      },
    };
    const prisma = {
      server: {
        findFirst: jest.fn()
          .mockResolvedValueOnce(staleAgentServer)
          .mockResolvedValueOnce(staleAgentServer)
          .mockResolvedValueOnce(onlineAgentServer),
      },
    } as unknown as PrismaService;
    const configValues: Record<string, string> = {
      SERVER_EXECUTOR_AGENT_TARGET_ENABLED: 'true',
      SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED: 'false',
    };
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => configValues[key] ?? fallback),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.resolveTarget('team-1', 'server-1')).resolves.toEqual(expect.objectContaining({
      transport: 'server_agent',
      agentRef: expect.objectContaining({
        source: 'server_services',
        capabilityKey: 'devpilotAgent',
      }),
    }));

    configValues.SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED = 'true';

    await expect(service.resolveTarget('team-1', 'server-1')).resolves.toEqual(expect.objectContaining({
      transport: 'ssh',
      serverId: 'server-1',
    }));

    await expect(service.resolveTarget('team-1', 'server-1')).resolves.toEqual(expect.objectContaining({
      transport: 'server_agent',
      agentRef: expect.objectContaining({
        source: 'server_services',
        capabilityKey: 'devpilotAgent',
        status: 'online',
      }),
    }));
  });

  it('routes server_agent targets through the default-off agent adapter boundary', async () => {
    const prisma = {
      serverExecutionJob: {
        create: jest.fn().mockResolvedValue({ id: 'job-agent-1', attempt: 1, maxAttempts: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ status: 'running', cancelRequestedAt: null }),
      },
    } as unknown as PrismaService;
    const commandPolicy = {
      evaluate: jest.fn().mockResolvedValue({
        status: 'passed',
        policyKey: 'built-in',
        mode: 'built_in_baseline',
        decisions: [],
        warnings: [],
        blockedReasons: [],
      }),
    } as unknown as ServerCommandPolicyService;
    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
    } as unknown as ConfigService;
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: 'audit-agent-dispatch-1' }),
    } as unknown as AuditEventService;
    const agentAdapter = new ServerAgentServerExecutorAdapter(configService);
    const service = new ServerExecutorService(
      prisma,
      { supports: jest.fn().mockReturnValue(false) } as unknown as SshLiveServerExecutorAdapter,
      { supports: jest.fn().mockReturnValue(false) } as unknown as ScriptPlanServerExecutorAdapter,
      commandPolicy,
      configService,
      {} as LogCollectionIngestionService,
      auditEventService,
      agentAdapter,
    );

    await expect(service.execute({
      teamId: 'team-1',
      userId: 'user-1',
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun: true,
      target: {
        transport: 'server_agent',
        serverId: 'server-1',
        serverName: 'prod-1',
        serverHost: '10.0.0.1',
      },
      steps: [
        {
          key: 'build',
          label: 'Build',
          command: 'pnpm build',
          required: true,
          risk: 'medium',
        },
      ],
      metadata: { projectId: 'project-1', environmentId: 'env-1' },
    })).resolves.toEqual(expect.objectContaining({
      status: 'completed',
      mode: 'dry_run',
      result: expect.objectContaining({
        executorAdapterKey: 'server-agent',
        transport: 'server_agent',
        agentExecutorEnabled: false,
        dispatchEnvelope: expect.objectContaining({
          operationKey: 'deployment.run',
          adapterKey: 'deployment-script-plan',
          correlation: expect.objectContaining({
            serverExecutionJobId: 'job-agent-1',
            retryAttempt: 1,
            maxAttempts: 1,
            dispatchId: 'job-agent-1:1',
            idempotencyKey: 'server-execution-job:team-1:job-agent-1',
          }),
          stepCount: 1,
        }),
      }),
    }));

    expect(prisma.serverExecutionJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        transport: 'server_agent',
        status: 'running',
        inputSnapshot: expect.objectContaining({
          target: expect.objectContaining({ transport: 'server_agent' }),
        }),
      }),
    }));
    expect(prisma.serverExecutionJob.updateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: 'job-agent-1' },
      data: expect.objectContaining({
        status: 'completed',
        result: expect.objectContaining({
          executorAdapterKey: 'server-agent',
          correlation: expect.objectContaining({
            serverExecutionJobId: 'job-agent-1',
            dispatchId: 'job-agent-1:1',
            idempotencyKey: 'server-execution-job:team-1:job-agent-1',
          }),
          nextExecutorBoundary: 'server_agent_dispatcher',
        }),
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      serverId: 'server-1',
      category: 'execution',
      action: 'server_execution_job.agent_dispatch',
      targetType: 'server_execution_job',
      targetId: 'job-agent-1',
      risk: 'low',
      status: 'completed',
      metadata: expect.objectContaining({
        serverExecutionJobId: 'job-agent-1',
        operationKey: 'deployment.run',
        adapterKey: 'deployment-script-plan',
        transport: 'server_agent',
        dryRun: true,
        resultStatus: 'completed',
        resultMode: 'dry_run',
        correlation: expect.objectContaining({
          serverExecutionJobId: 'job-agent-1',
          dispatchId: 'job-agent-1:1',
          idempotencyKey: 'server-execution-job:team-1:job-agent-1',
        }),
        agentExecutorEnabled: false,
        dispatcherConfigured: false,
        nextExecutorBoundary: 'server_agent_dispatcher',
      }),
    }));
  });

  it('keeps resolveTarget on SSH unless agent target selection is explicitly enabled', async () => {
    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'server-1',
          name: 'prod-1',
          host: '10.0.0.1',
          port: 22,
          username: 'deploy',
          authType: 'key',
          services: { devpilotAgent: { status: 'online' } },
          tags: ['devpilot-agent'],
        }),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((_key: string, fallback?: string | number) => fallback),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    const target = await service.resolveTarget('team-1', 'server-1');
    expect(target).toEqual(expect.objectContaining({
      transport: 'ssh',
      serverId: 'server-1',
      credentialRef: expect.objectContaining({
        source: 'server',
        referenceId: 'server-1',
        redacted: true,
      }),
    }));
    expect(target.agentRef).toBeUndefined();
  });

  it('selects a server_agent target when opt-in and server capability evidence is present', async () => {
    const prisma = {
      server: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'server-1',
          name: 'prod-1',
          host: '10.0.0.1',
          port: 22,
          username: 'deploy',
          authType: 'key',
          services: { serverAgent: { status: 'ready' } },
          tags: [],
        }),
      },
    } as unknown as PrismaService;
    const configService = {
      get: jest.fn((key: string, fallback?: string | number) => {
        if (key === 'SERVER_EXECUTOR_AGENT_TARGET_ENABLED') return 'true';
        return fallback;
      }),
    } as unknown as ConfigService;
    const service = new ServerExecutorService(
      prisma,
      {} as SshLiveServerExecutorAdapter,
      {} as ScriptPlanServerExecutorAdapter,
      {} as ServerCommandPolicyService,
      configService,
      {} as LogCollectionIngestionService,
    );

    await expect(service.resolveTarget('team-1', 'server-1')).resolves.toEqual(expect.objectContaining({
      transport: 'server_agent',
      serverId: 'server-1',
      agentRef: {
        source: 'server_services',
        referenceId: 'server-1',
        displayName: 'prod-1 agent',
        capabilityKey: 'serverAgent',
        status: 'ready',
        redacted: true,
      },
      credentialRef: expect.objectContaining({
        source: 'server',
        referenceId: 'server-1',
        redacted: true,
      }),
    }));
  });
});
