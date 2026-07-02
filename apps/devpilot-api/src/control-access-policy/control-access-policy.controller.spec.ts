import { ControlAccessPolicyController } from './control-access-policy.controller';
import { ControlAccessPolicyService } from './control-access-policy.service';

describe('ControlAccessPolicyController authorization config boundary', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let accessPolicyService: {
    list: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let controller: ControlAccessPolicyController;

  beforeEach(() => {
    accessPolicyService = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    controller = new ControlAccessPolicyController(
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('lists policies within the request team scope and query filters', async () => {
    const query = {
      projectId: 'project-1',
      environmentId: 'env-prod',
      enabled: 'true',
      category: 'resource',
      action: 'resource.action.restart',
      risk: 'high',
    };
    accessPolicyService.list.mockResolvedValue([{ id: 'policy-1' }]);

    await expect(controller.list(req, query)).resolves.toEqual([{ id: 'policy-1' }]);
    expect(accessPolicyService.list).toHaveBeenCalledWith(req.teamId, query);
  });

  it('creates policies with team scope and the actor id', async () => {
    const dto = {
      name: '生产资源高危操作',
      effect: 'allow' as const,
      principalType: 'team_role' as const,
      principalRole: 'admin' as const,
      projectId: 'project-1',
      environmentId: 'env-prod',
      categories: ['resource'],
      actions: ['resource.action.*'],
      riskLevels: ['high'],
    };
    accessPolicyService.create.mockResolvedValue({ id: 'policy-1' });

    await expect(controller.create(req, dto)).resolves.toEqual({ id: 'policy-1' });
    expect(accessPolicyService.create).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('updates policies with team scope, actor id, route id, and patch body', async () => {
    const dto = {
      enabled: false,
      actions: ['deployment.rollback'],
      priority: 20,
    };
    accessPolicyService.update.mockResolvedValue({ id: 'policy-1', enabled: false });

    await expect(controller.update(req, 'policy-1', dto))
      .resolves
      .toEqual({ id: 'policy-1', enabled: false });
    expect(accessPolicyService.update).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
      'policy-1',
      dto,
    );
  });

  it('deletes policies with team scope, actor id, and route id', async () => {
    accessPolicyService.delete.mockResolvedValue({ deleted: true });

    await expect(controller.remove(req, 'policy-1')).resolves.toEqual({ deleted: true });
    expect(accessPolicyService.delete).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
      'policy-1',
    );
  });
});
