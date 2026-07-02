import { ResourceAuditLogsController } from './resource-audit-logs.controller';

describe('ResourceAuditLogsController', () => {
  it('filters listed audit logs before returning them', async () => {
    const logs = [
      { id: 'log-visible', request: { projectId: 'project-1', environmentId: 'env-1' } },
      { id: 'log-hidden', request: { projectId: 'project-2', environmentId: 'env-2' } },
    ];
    const resourceRequestService = {
      listAuditLogs: jest.fn().mockResolvedValue(logs),
    };
    const auditLogAccess = {
      filterReadable: jest.fn().mockResolvedValue([{ id: 'log-visible' }]),
    };
    const controller = new ResourceAuditLogsController(
      auditLogAccess as any,
      resourceRequestService as any,
    );

    await expect(
      controller.findAll({
        teamId: 'team-1',
        user: { id: 'user-1' },
      } as any, { action: 'request.created' } as any),
    ).resolves.toEqual([{ id: 'log-visible' }]);

    expect(resourceRequestService.listAuditLogs).toHaveBeenCalledWith(
      'team-1',
      { action: 'request.created' },
    );
    expect(auditLogAccess.filterReadable).toHaveBeenCalledWith({
      teamId: 'team-1',
      actorId: 'user-1',
      logs,
    });
  });
});
