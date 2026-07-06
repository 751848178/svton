import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor';
import { DefaultCredentialResolver } from './credentials/credential-resolver';
import { DirectDbQueryExecutor } from './executors/direct-db-query.executor';
import { ResourceExecutorRouter } from './executors/executor-router';
import { CloudProviderInventoryService } from './inventory/cloud-provider-inventory.service';
import { ResourceControlRepository } from './resource-control.repository';
import { ResourceControlService } from './resource-control.service';
import { ResourceControlListReadService } from './resource-control-list-read.service';
import { ResourceControlBindingService } from './resource-control-binding.service';
import { ResourceControlConnectionSharedService } from './resource-control-connection-shared.service';
import { ResourceControlConnectionProbeService } from './resource-control-connection-probe.service';
import { ResourceControlResourceQueryService } from './resource-control-query.service';
import { ResourceControlCloudProviderHealthService } from './resource-control-cloud-provider-health.service';
import {
  buildMetricSeries,
  summarizeMetricTrends,
} from './resource-control-metric-summary.utils';

describe('ResourceControlService cloud provider health summary', () => {
  const cloudProviderHealthService = new ResourceControlCloudProviderHealthService({} as PrismaService);
  const service = new ResourceControlService(
    {} as PrismaService,
    {} as ResourceControlRepository,
    new ResourceControlListReadService({} as ResourceControlRepository, cloudProviderHealthService),
    {} as ResourceControlBindingService,
    {} as ResourceControlConnectionSharedService,
    {} as ResourceControlConnectionProbeService,
    {} as ResourceControlResourceQueryService,
    {} as DefaultCredentialResolver,
    {} as ResourceExecutorRouter,
    {} as DirectDbQueryExecutor,
    {} as AuditEventService,
    {} as OperationApprovalService,
    {} as ServerExecutorService,
    {} as CloudProviderInventoryService,
    {} as never,
  );

  it('summarizes quota, rate-limit, timeout, and provider failure signals from sync metadata', () => {
    const result = service.summarizeCloudProviderHealth([
      cloudRun('run-1', 'completed', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Aliyun RDS live inventory failed: quota exceeded and rate limit timeout',
        requestPolicy: { timeoutMs: 5000, retryAttempts: 2, attempts: 3, retries: 2 },
        regions: ['cn-hangzhou'],
      }),
      cloudRun('run-2', 'completed', {
        provider: 'aliyun-rds',
        syncMode: 'cloud_sdk_live',
        live: true,
        sdk: '@alicloud/pop-core',
        regions: ['cn-hangzhou'],
      }),
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        provider: 'aliyun-rds',
        status: 'error',
        totalRuns: 2,
        liveRuns: 1,
        fallbackRuns: 1,
        providerFailureCount: 1,
        quotaSignals: 1,
        rateLimitSignals: 1,
        timeoutSignals: 1,
        regions: ['cn-hangzhou'],
        recentIssues: [
          expect.objectContaining({
            runId: 'run-1',
            type: 'provider_failure',
          }),
        ],
      }),
    ]);
  });

  it('marks configuration fallback as degraded without counting provider failure', () => {
    const result = service.summarizeCloudProviderHealth([
      cloudRun('run-1', 'completed', {
        provider: 'tencent-cos',
        syncMode: 'cloud_inventory_stub_fallback',
        live: false,
        fallbackReason: 'Cloud provider live inventory is disabled',
      }),
    ]);

    expect(result).toEqual([
      expect.objectContaining({
        provider: 'tencent-cos',
        status: 'degraded',
        fallbackRuns: 1,
        providerFailureCount: 0,
        configFallbackCount: 1,
      }),
    ]);
  });
});

describe('ResourceControlService Docker metric snapshot persistence', () => {
  it('persists Docker stats snapshots for completed live action runs', async () => {
    const prisma = {
      resourceActionRun: {
        findFirst: jest.fn().mockResolvedValue(dockerStatsActionRun({ dryRun: false, status: 'completed' })),
      },
      resourceMetricSnapshot: {
        count: jest.fn().mockResolvedValue(0),
        createMany: jest.fn().mockImplementation(({ data }: { data: unknown[] }) => ({ count: data.length })),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);
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
      {
        stdoutPreview: JSON.stringify({
          CPUPerc: '1.25%',
          MemUsage: '10MiB / 100MiB',
          MemPerc: '10%',
          NetIO: '1kB / 2kB',
          BlockIO: '0B / 4kB',
          PIDs: '5',
        }),
      },
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
          provider: 'docker',
          kind: 'docker_container',
          metricSource: 'docker_stats',
          status: 'collected',
          cpuPercent: 1.25,
          memoryPercent: 10,
          pids: 5,
        }),
      ],
    });
  });

  it('skips dry-run Docker stats action runs', async () => {
    const prisma = {
      resourceActionRun: {
        findFirst: jest.fn().mockResolvedValue(dockerStatsActionRun({ dryRun: true, status: 'completed' })),
      },
      resourceMetricSnapshot: {
        count: jest.fn(),
        createMany: jest.fn(),
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);
    const persist = service as unknown as {
      persistDockerMetricSnapshotsFromActionRun(
        teamId: string,
        resourceActionRunId: string,
        result: unknown,
        logs?: unknown,
      ): Promise<number>;
    };

    await expect(persist.persistDockerMetricSnapshotsFromActionRun('team-1', 'run-1', {})).resolves.toBe(0);
    expect(prisma.resourceMetricSnapshot.count).not.toHaveBeenCalled();
    expect(prisma.resourceMetricSnapshot.createMany).not.toHaveBeenCalled();
  });
});

describe('ResourceControlService metric trend summaries', () => {
  it('summarizes latest, average, max, and delta by resource and metric source', () => {
    const service = buildService({} as PrismaService);

    expect(summarizeMetricTrends([
      metricSnapshot('snapshot-1', 'resource-1', '2026-06-26T12:00:00.000Z', {
        cpuPercent: 20,
        memoryPercent: 50,
        memoryUsageBytes: 1024,
        pids: 8,
      }),
      metricSnapshot('snapshot-2', 'resource-1', '2026-06-26T11:55:00.000Z', {
        cpuPercent: 10,
        memoryPercent: 40,
        memoryUsageBytes: 512,
        pids: 4,
      }),
      metricSnapshot('snapshot-3', 'resource-2', '2026-06-26T11:58:00.000Z', {
        cpuPercent: 5,
        memoryPercent: null,
        pids: null,
      }),
    ], 15)).toEqual([
      expect.objectContaining({
        id: 'resource-1',
        resourceId: 'resource-1',
        windowMinutes: 15,
        sampleCount: 2,
        firstSampledAt: new Date('2026-06-26T11:55:00.000Z'),
        lastSampledAt: new Date('2026-06-26T12:00:00.000Z'),
        cpuPercent: {
          latest: 20,
          average: 15,
          max: 20,
          delta: 10,
        },
        memoryPercent: {
          latest: 50,
          average: 45,
          max: 50,
          delta: 10,
        },
        memoryUsageBytes: {
          latest: 1024,
          average: 768,
          max: 1024,
          delta: 512,
        },
        pids: {
          latest: 8,
          average: 6,
          max: 8,
          delta: 4,
        },
      }),
      expect.objectContaining({
        id: 'resource-2',
        sampleCount: 1,
        cpuPercent: {
          latest: 5,
          average: 5,
          max: 5,
          delta: 0,
        },
        memoryPercent: {
          latest: null,
          average: null,
          max: null,
          delta: null,
        },
      }),
    ]);
  });

  it('queries metric trends within a bounded time window', async () => {
    const findMany = jest.fn().mockResolvedValue([
      metricSnapshot('snapshot-1', 'resource-1', '2026-06-26T12:00:00.000Z', {
        cpuPercent: 20,
      }),
    ]);
    const prisma = {
      resourceMetricSnapshot: { findMany },
    } as unknown as PrismaService;
    const service = buildService(prisma);
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-26T12:00:00.000Z').getTime());

    try {
      await service.listMetricTrends('team-1', {
        provider: 'docker',
        kind: 'docker_container',
        metricSource: 'docker_stats',
        windowMinutes: '15',
      });

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          teamId: 'team-1',
          sampledAt: { gte: new Date('2026-06-26T11:45:00.000Z') },
          provider: 'docker',
          kind: 'docker_container',
          metricSource: 'docker_stats',
        },
        orderBy: { sampledAt: 'desc' },
        take: 500,
        include: expect.any(Object),
      }));
    } finally {
      now.mockRestore();
    }
  });

  it('builds chartable metric series with chronological points and latest summary', () => {
    const service = buildService({} as PrismaService);

    expect(buildMetricSeries([
      metricSnapshot('snapshot-1', 'resource-1', '2026-06-26T12:00:00.000Z', {
        cpuPercent: 30,
      }),
      metricSnapshot('snapshot-2', 'resource-1', '2026-06-26T11:55:00.000Z', {
        cpuPercent: 10,
      }),
      metricSnapshot('snapshot-3', 'resource-1', '2026-06-26T11:58:00.000Z', {
        cpuPercent: 20,
      }),
    ], 'cpuPercent', 30, 120)).toEqual([
      expect.objectContaining({
        id: 'resource-1:docker_stats:cpuPercent',
        resourceId: 'resource-1',
        metric: 'cpuPercent',
        windowMinutes: 30,
        limit: 120,
        sampleCount: 3,
        firstSampledAt: new Date('2026-06-26T11:55:00.000Z'),
        lastSampledAt: new Date('2026-06-26T12:00:00.000Z'),
        summary: {
          latest: 30,
          average: 20,
          max: 30,
          delta: 20,
        },
        points: [
          {
            snapshotId: 'snapshot-2',
            sampledAt: new Date('2026-06-26T11:55:00.000Z'),
            value: 10,
            status: 'collected',
          },
          {
            snapshotId: 'snapshot-3',
            sampledAt: new Date('2026-06-26T11:58:00.000Z'),
            value: 20,
            status: 'collected',
          },
          {
            snapshotId: 'snapshot-1',
            sampledAt: new Date('2026-06-26T12:00:00.000Z'),
            value: 30,
            status: 'collected',
          },
        ],
      }),
    ]);
  });

  it('queries metric series with bounded window, limit, and metric filters', async () => {
    const findMany = jest.fn().mockResolvedValue([
      metricSnapshot('snapshot-1', 'resource-1', '2026-06-26T12:00:00.000Z', {
        memoryPercent: 40,
      }),
    ]);
    const prisma = {
      resourceMetricSnapshot: { findMany },
    } as unknown as PrismaService;
    const service = buildService(prisma);
    const now = jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-06-26T12:00:00.000Z').getTime());

    try {
      await service.listMetricSeries('team-1', {
        resourceId: 'resource-1',
        provider: 'docker',
        kind: 'docker_container',
        metricSource: 'docker_stats',
        metric: 'memoryPercent',
        windowMinutes: '1440',
        limit: '5000',
      });

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          teamId: 'team-1',
          sampledAt: { gte: new Date('2026-06-25T12:00:00.000Z') },
          resourceId: 'resource-1',
          provider: 'docker',
          kind: 'docker_container',
          metricSource: 'docker_stats',
        },
        orderBy: { sampledAt: 'desc' },
        take: 1000,
        include: expect.any(Object),
      }));
    } finally {
      now.mockRestore();
    }
  });
});

function cloudRun(id: string, status: string, diagnostic: Record<string, unknown>) {
  const minute = id.endsWith('2') ? '02' : '01';
  return {
    id,
    provider: 'all',
    status,
    discovered: 1,
    error: null,
    startedAt: new Date(`2026-06-26T12:${minute}:00.000Z`),
    finishedAt: new Date(`2026-06-26T12:${minute}:30.000Z`),
    metadata: toJsonValue({
      providers: [diagnostic],
    }),
  };
}

function toJsonValue(value: unknown): Prisma.JsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
}

function buildService(prisma: PrismaService) {
  return new ResourceControlService(
    prisma,
    new ResourceControlRepository(prisma),
    new ResourceControlListReadService(
      new ResourceControlRepository(prisma),
      new ResourceControlCloudProviderHealthService(prisma),
    ),
    new ResourceControlBindingService(new ResourceControlRepository(prisma), {} as AuditEventService),
    new ResourceControlConnectionSharedService(new ResourceControlRepository(prisma), {} as DefaultCredentialResolver),
    new ResourceControlConnectionProbeService(
      new ResourceControlRepository(prisma),
      new ResourceControlBindingService(new ResourceControlRepository(prisma), {} as AuditEventService),
      new ResourceControlConnectionSharedService(new ResourceControlRepository(prisma), {} as DefaultCredentialResolver),
      {} as ServerExecutorService,
      {} as AuditEventService,
    ),
    new ResourceControlResourceQueryService(
      new ResourceControlRepository(prisma),
      new ResourceControlBindingService(new ResourceControlRepository(prisma), {} as AuditEventService),
      new ResourceControlConnectionSharedService(new ResourceControlRepository(prisma), {} as DefaultCredentialResolver),
      {} as DirectDbQueryExecutor,
      {} as AuditEventService,
    ),
    {} as DefaultCredentialResolver,
    {} as ResourceExecutorRouter,
    {} as DirectDbQueryExecutor,
    {} as AuditEventService,
    {} as OperationApprovalService,
    {} as ServerExecutorService,
    {} as CloudProviderInventoryService,
    {} as never,
  );
}

function dockerStatsActionRun({ dryRun, status }: { dryRun: boolean; status: string }) {
  return {
    id: 'run-1',
    teamId: 'team-1',
    resourceId: 'resource-1',
    action: 'docker.container.stats',
    dryRun,
    status,
    resource: {
      id: 'resource-1',
      sourceType: 'server',
      provider: 'docker',
      kind: 'docker_container',
      serverId: 'server-1',
      projectId: 'project-1',
      environmentId: 'env-1',
    },
  };
}

function metricSnapshot(
  id: string,
  resourceId: string,
  sampledAt: string,
  metrics: {
    cpuPercent?: number | null;
    memoryPercent?: number | null;
    memoryUsageBytes?: number | null;
    pids?: number | null;
  },
) {
  return {
    id,
    resourceId,
    projectId: 'project-1',
    environmentId: 'env-1',
    sourceType: 'server',
    provider: 'docker',
    kind: 'docker_container',
    metricSource: 'docker_stats',
    status: 'collected',
    sampledAt: new Date(sampledAt),
    cpuPercent: metrics.cpuPercent ?? null,
    memoryUsageBytes: metrics.memoryUsageBytes ?? null,
    memoryLimitBytes: null,
    memoryPercent: metrics.memoryPercent ?? null,
    networkInputBytes: null,
    networkOutputBytes: null,
    blockInputBytes: null,
    blockOutputBytes: null,
    pids: metrics.pids ?? null,
    resource: {
      id: resourceId,
      projectId: 'project-1',
      environmentId: 'env-1',
      name: resourceId,
      provider: 'docker',
      kind: 'docker_container',
      sourceType: 'server',
      endpoint: null,
    },
  };
}
