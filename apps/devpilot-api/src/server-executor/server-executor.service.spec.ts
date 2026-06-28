import { ConfigService } from '@nestjs/config';
import { LogCollectionIngestionService } from '../log-center/log-collection-ingestion.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScriptPlanServerExecutorAdapter } from './adapters/script-plan.adapter';
import { SshLiveServerExecutorAdapter } from './adapters/ssh-live.adapter';
import { ServerCommandPolicyService } from './server-command-policy.service';
import { ServerExecutorService } from './server-executor.service';

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
});
