import { PrismaService } from '../prisma/prisma.service';
import { AuditEventService } from './audit-event.service';

describe('AuditEventService', () => {
  it('filters audit evidence by exact deploymentRunId', async () => {
    const prisma = { auditEvent: { findMany: jest.fn().mockResolvedValue([]) } };
    const service = new AuditEventService(prisma as unknown as PrismaService);
    await service.list('team-1', { deploymentRunId: 'run-1' });
    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: 'team-1', deploymentRunId: 'run-1' },
      take: 100,
    }));
  });
});
