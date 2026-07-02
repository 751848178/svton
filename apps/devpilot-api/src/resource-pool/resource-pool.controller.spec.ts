import { ControlAccessPolicyService } from '../control-access-policy';
import { ResourcePoolController } from './resource-pool.controller';
import { ResourcePoolService } from './resource-pool.service';

describe('ResourcePoolController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let resourcePoolService: {
    getPools: jest.Mock;
    getAvailablePools: jest.Mock;
    getPool: jest.Mock;
    getUserAllocations: jest.Mock;
    getProjectAllocations: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanRead: jest.Mock;
  };
  let controller: ResourcePoolController;

  beforeEach(() => {
    resourcePoolService = {
      getPools: jest.fn(),
      getAvailablePools: jest.fn(),
      getPool: jest.fn(),
      getUserAllocations: jest.fn(),
      getProjectAllocations: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanRead: jest.fn(),
    };
    controller = new ResourcePoolController(
      resourcePoolService as unknown as ResourcePoolService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters all resource pools through control read policy', async () => {
    resourcePoolService.getPools.mockResolvedValue([
      { id: 'pool-allowed', name: 'MySQL Pool' },
      { id: 'pool-denied', name: 'Redis Pool' },
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'pool-allowed')
    ));

    await expect(controller.getPools(req, 'mysql')).resolves.toEqual([
      { id: 'pool-allowed', name: 'MySQL Pool' },
    ]);
    expect(resourcePoolService.getPools).toHaveBeenCalledWith('mysql');
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_pool',
      action: 'resource_pool.read',
      targetType: 'resource_pool',
      targetId: 'pool-denied',
      risk: 'low',
    }));
  });

  it('filters available resource pools through control read policy', async () => {
    resourcePoolService.getAvailablePools.mockResolvedValue([
      { id: 'pool-allowed', name: 'Active MySQL Pool' },
      { id: 'pool-denied', name: 'Active Redis Pool' },
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'pool-allowed')
    ));

    await expect(controller.getAvailablePools(req, undefined)).resolves.toEqual([
      { id: 'pool-allowed', name: 'Active MySQL Pool' },
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_pool.read',
      targetType: 'resource_pool',
      targetId: 'pool-denied',
    }));
  });

  it('asserts resource pool detail read access before returning the pool', async () => {
    resourcePoolService.getPool.mockResolvedValue({ id: 'pool-1', name: 'MySQL Pool' });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });

    await expect(controller.getPool('pool-1', req)).resolves.toEqual({ id: 'pool-1', name: 'MySQL Pool' });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_pool',
      action: 'resource_pool.read',
      targetType: 'resource_pool',
      targetId: 'pool-1',
      risk: 'low',
    }));
  });

  it('does not return resource pool detail when read access is denied', async () => {
    resourcePoolService.getPool.mockResolvedValue({ id: 'pool-denied', name: 'Hidden Pool' });
    accessPolicyService.assertCanRead.mockRejectedValue(new Error('denied'));

    await expect(controller.getPool('pool-denied', req)).rejects.toThrow('denied');
  });

  it('loads my allocations within the current team scope', async () => {
    resourcePoolService.getUserAllocations.mockResolvedValue([{ id: 'allocation-1' }]);

    await expect(controller.getMyAllocations(req)).resolves.toEqual([{ id: 'allocation-1' }]);
    expect(resourcePoolService.getUserAllocations).toHaveBeenCalledWith(req.teamId, req.user.id);
  });

  it('checks project allocation read access before loading allocations', async () => {
    accessPolicyService.assertCanRead.mockRejectedValue(new Error('denied'));

    await expect(controller.getProjectAllocations('project-1', req)).rejects.toThrow('denied');
    expect(resourcePoolService.getProjectAllocations).not.toHaveBeenCalled();
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      category: 'resource_pool',
      action: 'resource_allocation.read',
      targetType: 'resource_allocation',
      targetId: 'project-1',
      risk: 'low',
    }));
  });
});
