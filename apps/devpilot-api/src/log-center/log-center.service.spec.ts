import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor/server-executor.service';
import { AliyunSlsLogQueryAdapter } from './aliyun-sls-log-query.adapter';
import { LogCenterService } from './log-center.service';
import { LogCollectionIngestionService } from './log-collection-ingestion.service';

type PrismaMock = {
  logStream: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  logEntry: {
    create: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    deleteMany: jest.Mock;
  };
  logRetentionRun: {
    create: jest.Mock;
    update: jest.Mock;
  };
};

describe('LogCenterService stats', () => {
  let prisma: PrismaMock;
  let auditEventService: { create: jest.Mock };
  let slsLogQueryAdapter: {
    key: string;
    adapterKey: string;
    isLiveEnabled: jest.Mock;
    query: jest.Mock;
  };
  let service: LogCenterService;

  beforeEach(() => {
    prisma = {
      logStream: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      logEntry: {
        create: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      logRetentionRun: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditEventService = { create: jest.fn() };
    slsLogQueryAdapter = {
      key: 'cloud-sdk',
      adapterKey: 'aliyun-sls-live-query',
      isLiveEnabled: jest.fn().mockReturnValue(false),
      query: jest.fn(),
    };
    service = new LogCenterService(
      prisma as unknown as PrismaService,
      auditEventService as unknown as AuditEventService,
      {} as ServerExecutorService,
      {} as LogCollectionIngestionService,
      slsLogQueryAdapter as unknown as AliyunSlsLogQueryAdapter,
    );
  });

  it('counts recent log entries by level for readable streams only', async () => {
    prisma.logEntry.count.mockResolvedValue(4);
    prisma.logEntry.groupBy.mockResolvedValue([
      { level: 'error', _count: { _all: 2 } },
      { level: 'warn', _count: { _all: 1 } },
      { level: 'fatal', _count: { _all: 1 } },
    ]);
    prisma.logEntry.findFirst.mockResolvedValue({
      id: 'entry-4',
      level: 'fatal',
      message: 'fatal line',
      timestamp: new Date('2026-06-27T00:00:00.000Z'),
      streamId: 'stream-1',
    });

    const stats = await service.getEntryStats('team-1', { windowMinutes: 30 }, ['stream-1', 'stream-2']);

    expect(prisma.logEntry.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        teamId: 'team-1',
        streamId: { in: ['stream-1', 'stream-2'] },
        timestamp: expect.objectContaining({
          gte: expect.any(Date),
          lte: expect.any(Date),
        }),
      }),
    });
    expect(stats).toEqual(expect.objectContaining({
      windowMinutes: 30,
      total: 4,
      warningCount: 1,
      errorCount: 2,
      fatalCount: 1,
      latestEntry: expect.objectContaining({ id: 'entry-4' }),
    }));
    expect(stats.byLevel).toEqual([
      { level: 'error', count: 2 },
      { level: 'fatal', count: 1 },
      { level: 'warn', count: 1 },
    ]);
  });

  it('returns empty stats without touching log entries when no streams are readable', async () => {
    const stats = await service.getEntryStats('team-1', { windowMinutes: 60 }, []);

    expect(prisma.logEntry.count).not.toHaveBeenCalled();
    expect(prisma.logEntry.groupBy).not.toHaveBeenCalled();
    expect(stats).toEqual(expect.objectContaining({
      windowMinutes: 60,
      total: 0,
      byLevel: [],
      warningCount: 0,
      errorCount: 0,
      fatalCount: 0,
      latestEntry: null,
    }));
  });

  it('tails the latest stream entries in chronological order with a cursor', async () => {
    prisma.logStream.findFirst.mockResolvedValue(logStream());
    prisma.logEntry.findMany.mockResolvedValue([
      logEntry({
        id: 'entry-3',
        timestamp: new Date('2026-06-27T00:00:03.000Z'),
        createdAt: new Date('2026-06-27T00:00:03.100Z'),
      }),
      logEntry({
        id: 'entry-2',
        timestamp: new Date('2026-06-27T00:00:02.000Z'),
        createdAt: new Date('2026-06-27T00:00:02.100Z'),
      }),
    ]);

    const result = await service.tailStreamEntries('team-1', 'stream-1', { limit: 2 });

    expect(prisma.logEntry.findMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', streamId: 'stream-1' },
      orderBy: [{ timestamp: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: 2,
      include: expect.any(Object),
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(['entry-2', 'entry-3']);
    expect(result).toEqual(expect.objectContaining({
      streamId: 'stream-1',
      limit: 2,
      hasMore: true,
      pollAfterMs: 3000,
      cursor: '2026-06-27T00:00:03.000Z|2026-06-27T00:00:03.100Z|entry-3',
    }));
  });

  it('uses the tail cursor to fetch only newer log entries', async () => {
    prisma.logStream.findFirst.mockResolvedValue(logStream());
    prisma.logEntry.findMany.mockResolvedValue([
      logEntry({
        id: 'entry-4',
        timestamp: new Date('2026-06-27T00:00:03.000Z'),
        createdAt: new Date('2026-06-27T00:00:03.200Z'),
      }),
    ]);

    const result = await service.tailStreamEntries('team-1', 'stream-1', {
      limit: 50,
      cursor: '2026-06-27T00:00:03.000Z|2026-06-27T00:00:03.100Z|entry-3',
    });

    expect(prisma.logEntry.findMany).toHaveBeenCalledWith({
      where: {
        teamId: 'team-1',
        streamId: 'stream-1',
        OR: [
          { timestamp: { gt: new Date('2026-06-27T00:00:03.000Z') } },
          {
            timestamp: new Date('2026-06-27T00:00:03.000Z'),
            createdAt: { gt: new Date('2026-06-27T00:00:03.100Z') },
          },
          {
            timestamp: new Date('2026-06-27T00:00:03.000Z'),
            createdAt: new Date('2026-06-27T00:00:03.100Z'),
            id: { gt: 'entry-3' },
          },
        ],
      },
      orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      take: 50,
      include: expect.any(Object),
    });
    expect(result.entries.map((entry) => entry.id)).toEqual(['entry-4']);
    expect(result.cursor).toBe('2026-06-27T00:00:03.000Z|2026-06-27T00:00:03.200Z|entry-4');
  });

  it('creates a dry-run retention run without deleting entries', async () => {
    prisma.logStream.findFirst.mockResolvedValue(logStream());
    prisma.logRetentionRun.create.mockResolvedValue(logRetentionRun({ status: 'running' }));
    prisma.logEntry.count.mockResolvedValue(7);
    prisma.logRetentionRun.update.mockImplementation((args) => Promise.resolve(logRetentionRun({
      status: args.data.status,
      matchedEntryCount: args.data.matchedEntryCount,
      deletedEntryCount: args.data.deletedEntryCount,
      finishedAt: args.data.finishedAt,
    })));

    const run = await service.cleanupRetention('team-1', 'user-1', 'stream-1', { dryRun: true });

    expect(run).toEqual(expect.objectContaining({
      status: 'completed',
      matchedEntryCount: 7,
      deletedEntryCount: 0,
      dryRun: true,
    }));
    expect(prisma.logEntry.deleteMany).not.toHaveBeenCalled();
    expect(prisma.logStream.update).not.toHaveBeenCalled();
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'log.retention.cleanup',
      logRetentionRunId: 'retention-run-1',
      risk: 'low',
      status: 'completed',
    }));
  });

  it('deletes expired entries for live retention cleanup and refreshes stream metadata', async () => {
    prisma.logStream.findFirst.mockResolvedValue(logStream());
    prisma.logRetentionRun.create.mockResolvedValue(logRetentionRun({ dryRun: false, status: 'running' }));
    prisma.logEntry.count.mockResolvedValue(3);
    prisma.logEntry.deleteMany.mockResolvedValue({ count: 3 });
    prisma.logEntry.findFirst.mockResolvedValue({
      timestamp: new Date('2026-06-27T00:00:00.000Z'),
      level: 'info',
      message: 'fresh line',
    });
    prisma.logStream.update.mockResolvedValue({});
    prisma.logRetentionRun.update.mockImplementation((args) => Promise.resolve(logRetentionRun({
      dryRun: false,
      status: args.data.status,
      matchedEntryCount: args.data.matchedEntryCount,
      deletedEntryCount: args.data.deletedEntryCount,
      finishedAt: args.data.finishedAt,
    })));

    const run = await service.cleanupRetention('team-1', 'user-1', 'stream-1', { dryRun: false });

    expect(run).toEqual(expect.objectContaining({
      status: 'completed',
      matchedEntryCount: 3,
      deletedEntryCount: 3,
      dryRun: false,
    }));
    expect(prisma.logEntry.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        teamId: 'team-1',
        streamId: 'stream-1',
        timestamp: expect.objectContaining({ lt: expect.any(Date) }),
      }),
    });
    expect(prisma.logStream.update).toHaveBeenCalledWith({
      where: { id: 'stream-1' },
      data: {
        lastEntryAt: new Date('2026-06-27T00:00:00.000Z'),
        lastLevel: 'info',
        lastMessage: 'fresh line',
      },
    });
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'log.retention.cleanup',
      risk: 'high',
      status: 'completed',
    }));
  });

  it('builds an Aliyun SLS GetLogs dry-run collection plan', async () => {
    const result = await collectionPlanHarness(service).buildProviderCollectionPlan(
      slsLogStream(),
      'collection-run-1',
      {
        dryRun: true,
        tail: 200,
        params: {
          query: 'level:error',
          windowMinutes: 30,
          limit: 50,
        },
      },
    );
    const commandPlan = result.commandPlan as Record<string, unknown>;
    const plannedCalls = commandPlan.plannedCalls as Array<{ operation: string; params: Record<string, unknown> }>;
    const runResult = result.result as Record<string, unknown>;

    expect(result).toEqual(expect.objectContaining({
      status: 'completed',
      executorKey: 'cloud-sdk',
      adapterKey: 'aliyun-sls-query-plan',
      error: undefined,
    }));
    expect(commandPlan).toEqual(expect.objectContaining({
      operationKey: 'log.collect.sls.query',
      executable: true,
      dryRun: true,
    }));
    expect(plannedCalls[0]).toEqual(expect.objectContaining({
      provider: 'aliyun-sls',
      operation: 'GetLogs',
      params: expect.objectContaining({
        region: 'cn-hangzhou',
        project: 'prod-sls-project',
        logstore: 'app-log',
        query: 'level:error',
        limit: 50,
      }),
    }));
    expect(runResult).toEqual(expect.objectContaining({
      mode: 'dry_run_query_plan',
      executed: false,
      adapterKey: 'aliyun-sls-query-plan',
      stdoutPreview: expect.stringContaining('SLS dry-run query="level:error"'),
    }));
  });

  it('blocks live SLS collection until live SLS query gates are satisfied', async () => {
    const result = await collectionPlanHarness(service).buildProviderCollectionPlan(
      slsLogStream({
        managedResource: {
          ...slsLogStream().managedResource,
          credentialId: null,
        },
      }),
      'collection-run-2',
      {
        dryRun: false,
        tail: 100,
        params: { query: '*' },
      },
    );
    const commandPlan = result.commandPlan as Record<string, unknown>;
    const livePrerequisites = commandPlan.livePrerequisites as Record<string, unknown>;
    const runResult = result.result as Record<string, unknown>;

    expect(result).toEqual(expect.objectContaining({
      status: 'blocked',
      executorKey: 'cloud-sdk',
      adapterKey: 'aliyun-sls-live-query',
      error: expect.stringContaining('LOG_CENTER_SLS_LIVE_QUERY_ENABLED=true'),
    }));
    expect(livePrerequisites).toEqual(expect.objectContaining({
      credentialReady: false,
      adapterReady: true,
      liveEnabled: false,
      confirmationReady: false,
    }));
    expect(runResult).toEqual(expect.objectContaining({
      mode: 'blocked_live_execution',
      executed: false,
    }));
    expect(slsLogQueryAdapter.query).not.toHaveBeenCalled();
  });

  it('executes confirmed live SLS collection through the provider adapter', async () => {
    slsLogQueryAdapter.isLiveEnabled.mockReturnValue(true);
    slsLogQueryAdapter.query.mockResolvedValue({
      status: 'completed',
      logs: [{ level: 'info', message: 'SLS GetLogs live 查询完成: prod-sls-project/app-log 1 条' }],
      result: {
        mode: 'aliyun_sls_live_query',
        executed: true,
        stdoutPreview: '2026-06-27T00:00:00.000Z ERROR live line',
      },
    });

    const result = await collectionPlanHarness(service).buildProviderCollectionPlan(
      slsLogStream(),
      'collection-run-live',
      {
        dryRun: false,
        tail: 100,
        params: {
          query: 'level:error',
          limit: 25,
          confirmLiveRead: true,
        },
      },
    );
    const commandPlan = result.commandPlan as Record<string, unknown>;
    const livePrerequisites = commandPlan.livePrerequisites as Record<string, unknown>;

    expect(result).toEqual(expect.objectContaining({
      status: 'completed',
      executorKey: 'cloud-sdk',
      adapterKey: 'aliyun-sls-live-query',
      error: undefined,
    }));
    expect(livePrerequisites).toEqual(expect.objectContaining({
      credentialReady: true,
      adapterReady: true,
      liveEnabled: true,
      confirmationReady: true,
    }));
    expect(slsLogQueryAdapter.query).toHaveBeenCalledWith(expect.objectContaining({
      teamId: 'team-1',
      credentialId: 'credential-1',
      project: 'prod-sls-project',
      logstore: 'app-log',
      region: 'cn-hangzhou',
      query: 'level:error',
      limit: 25,
      redactionPolicy: expect.any(Object),
    }));
  });

  it('redacts manually appended log entries with the stream policy', async () => {
    prisma.logStream.findFirst.mockResolvedValue(logStream({
      metadata: {
        redaction: {
          extraKeys: ['session_id'],
          maskEmails: true,
          maskIpAddresses: true,
        },
      },
    }));
    prisma.logEntry.create.mockImplementation((args) => Promise.resolve({
      id: 'entry-1',
      createdAt: new Date('2026-06-27T00:00:00.000Z'),
      updatedAt: new Date('2026-06-27T00:00:00.000Z'),
      ...args.data,
    }));
    prisma.logStream.update.mockImplementation((args) => Promise.resolve(logStream(args.data)));

    await service.appendEntries('team-1', 'user-1', 'stream-1', {
      level: 'info',
      message: 'INFO session_id=abc user=ops@example.test ip=10.0.0.5 token=secret',
      raw: {
        session_id: 'abc',
        nested: {
          ip: '10.0.0.5',
          token: 'secret',
        },
      },
    });

    expect(prisma.logEntry.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        message: 'INFO session_id=[redacted] user=[redacted-email] ip=[redacted-ip] token=[redacted]',
        raw: expect.objectContaining({
          session_id: '[redacted]',
          nested: {
            ip: '[redacted-ip]',
            token: '[redacted]',
          },
        }),
      }),
    }));
    expect(prisma.logStream.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        lastMessage: 'INFO session_id=[redacted] user=[redacted-email] ip=[redacted-ip] token=[redacted]',
      }),
    }));
  });
});

function collectionPlanHarness(service: LogCenterService) {
  return service as unknown as {
    buildProviderCollectionPlan: (
      stream: ReturnType<typeof slsLogStream>,
      runId: string,
      options: { dryRun: boolean; tail: number; params?: Record<string, unknown> },
    ) => Promise<{
      status: string;
      executorKey: string;
      adapterKey: string;
      commandPlan?: unknown;
      result?: unknown;
      error?: string;
    }>;
  };
}

function logStream(overrides: Record<string, unknown> = {}) {
  return {
    id: 'stream-1',
    teamId: 'team-1',
    createdById: 'user-1',
    projectId: 'project-1',
    environmentId: 'env-1',
    applicationId: null,
    applicationServiceId: null,
    serverId: null,
    siteId: null,
    managedResourceId: null,
    deploymentRunId: null,
    backupPlanId: null,
    backupRunId: null,
    alertEventId: null,
    name: '应用日志',
    sourceType: 'docker',
    sourceKey: 'api',
    status: 'active',
    retentionDays: 14,
    labels: null,
    metadata: null,
    lastEntryAt: null,
    lastLevel: null,
    lastMessage: null,
    createdAt: new Date('2026-06-01T00:00:00.000Z'),
    updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  };
}

function logEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    teamId: 'team-1',
    streamId: 'stream-1',
    actorId: null,
    projectId: 'project-1',
    environmentId: 'env-1',
    applicationId: null,
    applicationServiceId: null,
    serverId: null,
    siteId: null,
    managedResourceId: null,
    deploymentRunId: null,
    backupPlanId: null,
    backupRunId: null,
    alertEventId: null,
    timestamp: new Date('2026-06-27T00:00:00.000Z'),
    level: 'info',
    message: 'log line',
    source: 'docker',
    labels: null,
    context: null,
    raw: null,
    createdAt: new Date('2026-06-27T00:00:00.000Z'),
    ...overrides,
  };
}

function slsLogStream(overrides: Record<string, unknown> = {}) {
  return {
    ...logStream(),
    id: 'sls-stream-1',
    managedResourceId: 'sls-resource-1',
    name: 'SLS 应用日志',
    sourceType: 'sls',
    sourceKey: 'app-log',
    managedResource: {
      id: 'sls-resource-1',
      name: 'prod-sls-project',
      sourceType: 'cloud',
      provider: 'aliyun-sls',
      kind: 'log_service',
      status: 'active',
      endpoint: null,
      externalId: 'prod-sls-project',
      credentialId: 'credential-1',
      config: {
        project: 'prod-sls-project',
        logstores: ['app-log', 'audit-log'],
      },
      metadata: {
        region: 'cn-hangzhou',
      },
    },
    ...overrides,
  };
}

function logRetentionRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'retention-run-1',
    teamId: 'team-1',
    streamId: 'stream-1',
    actorId: 'user-1',
    projectId: 'project-1',
    environmentId: 'env-1',
    dryRun: true,
    retentionDays: 14,
    cutoffAt: new Date('2026-06-13T00:00:00.000Z'),
    matchedEntryCount: 0,
    deletedEntryCount: 0,
    status: 'running',
    error: null,
    startedAt: new Date('2026-06-27T00:00:00.000Z'),
    finishedAt: null,
    createdAt: new Date('2026-06-27T00:00:00.000Z'),
    stream: {
      id: 'stream-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      name: '应用日志',
      sourceType: 'docker',
      status: 'active',
      retentionDays: 14,
    },
    actor: { id: 'user-1', name: 'Owner', email: 'owner@example.test' },
    ...overrides,
  };
}
