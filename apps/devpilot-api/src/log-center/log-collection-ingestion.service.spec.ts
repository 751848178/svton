import { PrismaService } from '../prisma/prisma.service';
import { LogCollectionIngestionService } from './log-collection-ingestion.service';

type PrismaMock = {
  logCollectionRun: {
    findFirst: jest.Mock;
    update: jest.Mock;
  };
  logEntry: {
    createMany: jest.Mock;
  };
  logStream: {
    update: jest.Mock;
  };
};

describe('LogCollectionIngestionService', () => {
  let prisma: PrismaMock;
  let service: LogCollectionIngestionService;

  beforeEach(() => {
    prisma = {
      logCollectionRun: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      logEntry: {
        createMany: jest.fn(),
      },
      logStream: {
        update: jest.fn(),
      },
    };
    service = new LogCollectionIngestionService(prisma as unknown as PrismaService);
  });

  it('ingests completed collection output into log entries with parsed levels and redaction', async () => {
    const finishedAt = new Date('2026-06-27T00:00:05.000Z');
    prisma.logCollectionRun.findFirst.mockResolvedValue({
      id: 'run-1',
      teamId: 'team-1',
      streamId: 'stream-1',
      actorId: 'user-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      applicationId: 'app-1',
      applicationServiceId: 'svc-1',
      serverId: 'server-1',
      siteId: null,
      managedResourceId: null,
      deploymentRunId: null,
      backupPlanId: null,
      backupRunId: null,
      alertEventId: null,
      serverExecutionJobId: 'job-1',
      sourceType: 'docker',
      sourceKey: 'api',
      executorKey: 'server-executor',
      adapterKey: 'log-collection-plan',
      dryRun: false,
      status: 'completed',
      result: {
        stdoutPreview: [
          '2026-06-27T00:00:00Z INFO api started',
          '2026-06-27T00:00:01Z ERROR password=secret token=abc failed',
        ].join('\n'),
        stderrPreview: '2026-06-27T00:00:02Z WARN stderr line',
      },
      logs: [],
      finishedAt,
      ingestionStatus: null,
    });

    await service.ingestCompletedRun('team-1', 'run-1');

    expect(prisma.logEntry.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          level: 'info',
          message: '2026-06-27T00:00:00Z INFO api started',
          source: 'docker',
          timestamp: new Date('2026-06-27T00:00:00.000Z'),
        }),
        expect.objectContaining({
          level: 'error',
          message: '2026-06-27T00:00:01Z ERROR password=[redacted] token=[redacted] failed',
          timestamp: new Date('2026-06-27T00:00:01.000Z'),
        }),
        expect.objectContaining({
          level: 'warn',
          message: '2026-06-27T00:00:02Z WARN stderr line',
          timestamp: new Date('2026-06-27T00:00:02.000Z'),
        }),
      ],
    });
    expect(prisma.logStream.update).toHaveBeenCalledWith({
      where: { id: 'stream-1' },
      data: {
        lastEntryAt: new Date('2026-06-27T00:00:02.000Z'),
        lastLevel: 'warn',
        lastMessage: '2026-06-27T00:00:02Z WARN stderr line',
      },
    });
    expect(prisma.logCollectionRun.update).toHaveBeenLastCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        ingestionStatus: 'completed',
        ingestedEntryCount: 3,
        ingestionError: null,
        ingestedAt: expect.any(Date),
      }),
    });
  });

  it('applies stream redaction metadata to collected log output', async () => {
    prisma.logCollectionRun.findFirst.mockResolvedValue({
      id: 'run-redaction',
      teamId: 'team-1',
      streamId: 'stream-1',
      actorId: 'user-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      applicationId: null,
      applicationServiceId: null,
      serverId: 'server-1',
      siteId: null,
      managedResourceId: null,
      deploymentRunId: null,
      backupPlanId: null,
      backupRunId: null,
      alertEventId: null,
      serverExecutionJobId: 'job-1',
      sourceType: 'docker',
      sourceKey: 'api',
      executorKey: 'server-executor',
      adapterKey: 'log-collection-plan',
      dryRun: false,
      status: 'completed',
      result: {
        stdoutPreview: '2026-06-27T00:00:00Z INFO session_id=abc user=ops@example.test ip=10.0.0.5',
      },
      logs: [],
      finishedAt: new Date('2026-06-27T00:00:05.000Z'),
      ingestionStatus: null,
      stream: {
        metadata: {
          redaction: {
            extraKeys: ['session_id'],
            maskEmails: true,
            maskIpAddresses: true,
          },
        },
      },
    });

    await service.ingestCompletedRun('team-1', 'run-redaction');

    expect(prisma.logEntry.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          message: '2026-06-27T00:00:00Z INFO session_id=[redacted] user=[redacted-email] ip=[redacted-ip]',
          raw: expect.objectContaining({
            line: '2026-06-27T00:00:00Z INFO session_id=[redacted] user=[redacted-email] ip=[redacted-ip]',
          }),
        }),
      ],
    });
  });

  it('marks dry-run collection runs as skipped without creating entries', async () => {
    prisma.logCollectionRun.findFirst.mockResolvedValue({
      id: 'run-dry',
      teamId: 'team-1',
      streamId: 'stream-1',
      dryRun: true,
      status: 'completed',
      ingestionStatus: null,
    });

    await service.ingestCompletedRun('team-1', 'run-dry');

    expect(prisma.logEntry.createMany).not.toHaveBeenCalled();
    expect(prisma.logStream.update).not.toHaveBeenCalled();
    expect(prisma.logCollectionRun.update).toHaveBeenCalledWith({
      where: { id: 'run-dry' },
      data: expect.objectContaining({
        ingestionStatus: 'skipped',
        ingestedEntryCount: 0,
        ingestionError: 'dry-run 采集不写入日志条目',
        ingestedAt: expect.any(Date),
      }),
    });
  });
});
