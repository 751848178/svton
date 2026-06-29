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
