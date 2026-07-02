import { ResourceAuditLogAccessService } from './resource-audit-log-access.service';

function createService() {
  const accessPolicyService = {
    canRead: jest.fn(),
  };
  return {
    accessPolicyService,
    service: new ResourceAuditLogAccessService(accessPolicyService as any),
  };
}

describe('ResourceAuditLogAccessService', () => {
  it('filters audit logs through control_read and strips internal scope relations', async () => {
    const { accessPolicyService, service } = createService();
    accessPolicyService.canRead
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const visible = {
      id: 'log-visible',
      action: 'request.created',
      request: { projectId: 'project-1', environmentId: 'env-1' },
      resourceType: { id: 'type-1' },
    };
    const hidden = {
      id: 'log-hidden',
      action: 'request.rejected',
      request: { projectId: 'project-2', environmentId: 'env-2' },
      resourceType: { id: 'type-2' },
    };

    await expect(
      service.filterReadable({
        teamId: 'team-1',
        actorId: 'user-1',
        logs: [visible, hidden],
      }),
    ).resolves.toEqual([
      {
        id: 'log-visible',
        action: 'request.created',
        resourceType: { id: 'type-1' },
      },
    ]);

    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(1, {
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      category: 'resource_request',
      action: 'resource_audit_log.read',
      targetType: 'resource_audit_log',
      targetId: 'log-visible',
      risk: 'low',
    });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectId: 'project-2',
      environmentId: 'env-2',
      targetId: 'log-hidden',
    }));
  });

  it('falls back from request to instance and provisioning run scope', async () => {
    const { accessPolicyService, service } = createService();
    accessPolicyService.canRead
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);

    await service.filterReadable({
      teamId: 'team-1',
      actorId: 'user-1',
      logs: [
        {
          id: 'instance-log',
          instance: { projectId: 'project-instance', environmentId: 'env-instance' },
        },
        {
          id: 'run-log',
          provisioningRun: { projectId: 'project-run', environmentId: 'env-run' },
        },
      ],
    });

    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(1, expect.objectContaining({
      projectId: 'project-instance',
      environmentId: 'env-instance',
      targetId: 'instance-log',
    }));
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectId: 'project-run',
      environmentId: 'env-run',
      targetId: 'run-log',
    }));
  });
});
