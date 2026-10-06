import { PrismaService } from '../prisma/prisma.service';
import { LogEntryQueryService } from './log-entry-query.service';
import { LogStreamQueryService } from './log-stream-query.service';

describe('deployment log queries', () => {
  it('filters streams by exact deploymentRunId', async () => {
    const prisma = { logStream: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new LogStreamQueryService(prisma as unknown as PrismaService);
    await service.list('team-1', { deploymentRunId: 'run-1' });
    expect(prisma.logStream.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1', deploymentRunId: 'run-1' },
    }));
  });

  it('filters entries by exact deploymentRunId', async () => {
    const prisma = { logEntry: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new LogEntryQueryService(prisma as unknown as PrismaService);
    await service.list('team-1', { deploymentRunId: 'run-1' });
    expect(prisma.logEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1', deploymentRunId: 'run-1' },
      take: 200,
    }));
  });
});
