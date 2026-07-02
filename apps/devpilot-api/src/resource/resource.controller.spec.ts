import { ControlAccessPolicyService } from '../control-access-policy';
import { ResourceController } from './resource.controller';
import { ResourceService } from './resource.service';

describe('ResourceController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let resourceService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findByType: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanRead: jest.Mock;
    assertCanWrite: jest.Mock;
  };
  let controller: ResourceController;

  beforeEach(() => {
    resourceService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByType: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanRead: jest.fn(),
      assertCanWrite: jest.fn(),
    };
    controller = new ResourceController(
      resourceService as unknown as ResourceService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters resource credentials through control read policy', async () => {
    resourceService.findAll.mockResolvedValue([
      credential('resource-allowed'),
      credential('resource-denied'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'resource-allowed')
    ));

    await expect(controller.findAll(req)).resolves.toEqual([credential('resource-allowed')]);
    expect(resourceService.findAll).toHaveBeenCalledWith(req.teamId);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_credential',
      action: 'resource_credential.read',
      targetType: 'resource',
      targetId: 'resource-denied',
      risk: 'low',
    }));
  });

  it('filters typed resource credentials through the same read policy', async () => {
    resourceService.findByType.mockResolvedValue([
      credential('mysql-allowed'),
      credential('mysql-denied'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'mysql-allowed')
    ));

    await expect(controller.findAll(req, 'mysql')).resolves.toEqual([credential('mysql-allowed')]);
    expect(resourceService.findByType).toHaveBeenCalledWith(req.teamId, 'mysql');
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      targetId: 'mysql-denied',
      action: 'resource_credential.read',
    }));
  });

  it('checks resource credential detail read access before returning it', async () => {
    resourceService.findOne.mockResolvedValue({ id: 'resource-1', config: { password: 'sec***ret' } });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });

    await expect(controller.findOne(req, 'resource-1')).resolves.toEqual({
      id: 'resource-1',
      config: { password: 'sec***ret' },
    });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_credential',
      action: 'resource_credential.read',
      targetType: 'resource',
      targetId: 'resource-1',
      risk: 'low',
    });
  });

  it('checks resource credential creation as a high-risk write', async () => {
    const dto = { type: 'mysql', name: 'Primary MySQL', config: { password: 'secret' } };
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });
    resourceService.create.mockResolvedValue({ id: 'resource-1' });

    await expect(controller.create(req, dto)).resolves.toEqual({ id: 'resource-1' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      category: 'resource_credential',
      action: 'resource_credential.create',
      targetType: 'resource',
      targetId: null,
      risk: 'high',
    });
    expect(resourceService.create).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks update and delete as high-risk writes', async () => {
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });
    resourceService.update.mockResolvedValue({ id: 'resource-1', name: 'Renamed' });
    resourceService.remove.mockResolvedValue({ success: true });

    await expect(controller.update(req, 'resource-1', { name: 'Renamed' }))
      .resolves
      .toEqual({ id: 'resource-1', name: 'Renamed' });
    await expect(controller.remove(req, 'resource-1')).resolves.toEqual({ success: true });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_credential.update',
      targetId: 'resource-1',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_credential.delete',
      targetId: 'resource-1',
      risk: 'high',
    }));
  });

  it('does not update when the write gate rejects', async () => {
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('credential denied'));

    await expect(controller.update(req, 'resource-1', { name: 'Blocked' }))
      .rejects
      .toThrow('credential denied');
    expect(resourceService.update).not.toHaveBeenCalled();
  });
});

function credential(id: string) {
  return {
    id,
    type: 'mysql',
    name: id,
  };
}
