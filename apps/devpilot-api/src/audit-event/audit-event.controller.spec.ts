import { AuditEventController } from './audit-event.controller';

const req = {
  teamId: 'team-1',
  user: { id: 'user-1' },
};

describe('AuditEventController', () => {
  it('filters listed audit events through control_read', async () => {
    const events = [
      { id: 'event-visible', projectId: 'project-1', environmentId: 'env-1' },
      { id: 'event-hidden', projectId: 'project-2', environmentId: 'env-2' },
    ];
    const auditEventService = {
      list: jest.fn().mockResolvedValue(events),
    };
    const accessPolicyService = {
      canRead: jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    const controller = new AuditEventController(
      auditEventService as any,
      accessPolicyService as any,
    );

    await expect(controller.list(req as any, { category: 'execution' } as any)).resolves.toEqual([
      events[0],
    ]);

    expect(auditEventService.list).toHaveBeenCalledWith('team-1', { category: 'execution' });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(1, {
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      category: 'audit',
      action: 'audit_event.read',
      targetType: 'audit_event',
      targetId: 'event-visible',
      risk: 'low',
    });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectId: 'project-2',
      environmentId: 'env-2',
      targetId: 'event-hidden',
    }));
  });
});
