import { OperationApprovalController } from './operation-approval.controller';

const req = {
  teamId: 'team-1',
  user: { id: 'user-1' },
};

describe('OperationApprovalController', () => {
  it('filters listed approvals through control_read using approval risk', async () => {
    const approvals = [
      { id: 'approval-visible', projectId: 'project-1', environmentId: 'env-1', risk: 'high' },
      { id: 'approval-hidden', projectId: 'project-2', environmentId: 'env-2', risk: 'medium' },
    ];
    const approvalService = {
      list: jest.fn().mockResolvedValue(approvals),
      review: jest.fn(),
    };
    const accessPolicyService = {
      canRead: jest.fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    const controller = new OperationApprovalController(
      approvalService as any,
      accessPolicyService as any,
    );

    await expect(controller.list(req as any, { status: 'pending' } as any)).resolves.toEqual([
      approvals[0],
    ]);

    expect(approvalService.list).toHaveBeenCalledWith('team-1', { status: 'pending' });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(1, {
      teamId: 'team-1',
      actorId: 'user-1',
      projectId: 'project-1',
      environmentId: 'env-1',
      category: 'approval',
      action: 'operation_approval.read',
      targetType: 'operation_approval',
      targetId: 'approval-visible',
      risk: 'high',
    });
    expect(accessPolicyService.canRead).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectId: 'project-2',
      environmentId: 'env-2',
      targetId: 'approval-hidden',
      risk: 'medium',
    }));
  });
});
