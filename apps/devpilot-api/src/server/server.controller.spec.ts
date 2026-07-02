import { ForbiddenException } from '@nestjs/common';
import { ControlAccessPolicyService } from '../control-access-policy';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';

describe('ServerController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let serverService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    testConnection: jest.Mock;
    detectServices: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanWrite: jest.Mock;
    assertCanSelfServiceWrite: jest.Mock;
  };
  let controller: ServerController;

  beforeEach(() => {
    serverService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      testConnection: jest.fn(),
      detectServices: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanWrite: jest.fn(),
      assertCanSelfServiceWrite: jest.fn(),
    };
    controller = new ServerController(
      serverService as unknown as ServerService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters server list through bound project/environment read scopes', async () => {
    serverService.findAll.mockResolvedValue([
      serverFixture('server-allowed', [{ projectId: 'project-1', environmentId: 'env-dev' }]),
      serverFixture('server-denied', [{ projectId: 'project-1', environmentId: 'env-prod' }]),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'server-allowed'));

    await expect(controller.findAll(req)).resolves.toEqual([
      serverFixture('server-allowed', [{ projectId: 'project-1', environmentId: 'env-dev' }]),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'server',
      action: 'server.read',
      targetType: 'server',
      targetId: 'server-denied',
      risk: 'low',
    }));
  });

  it('rejects server detail when all read scopes are denied', async () => {
    serverService.findOne.mockResolvedValue(serverFixture('server-denied'));
    accessPolicyService.canRead.mockResolvedValue(false);

    await expect(controller.findOne(req, 'server-denied'))
      .rejects
      .toThrow(new ForbiddenException('缺少服务器读取权限'));
  });

  it('checks server updates against every bound project/environment scope', async () => {
    const server = serverFixture('server-1', [
      { projectId: 'project-1', environmentId: 'env-dev' },
      { projectId: 'project-1', environmentId: 'env-prod' },
    ]);
    serverService.findOne.mockResolvedValue(server);
    serverService.update.mockResolvedValue({ id: 'server-1', name: 'updated' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.update(req, 'server-1', { name: 'updated' }))
      .resolves
      .toEqual({ id: 'server-1', name: 'updated' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledTimes(2);
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-dev',
      action: 'server.update',
      targetId: 'server-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'server.update',
    }));
  });

  it('does not update when any bound scope denies the write', async () => {
    const server = serverFixture('server-1', [
      { projectId: 'project-1', environmentId: 'env-dev' },
      { projectId: 'project-1', environmentId: 'env-prod' },
    ]);
    serverService.findOne.mockResolvedValue(server);
    accessPolicyService.assertCanWrite.mockImplementation(({ environmentId }) => (
      environmentId === 'env-prod'
        ? Promise.reject(new Error('prod denied'))
        : Promise.resolve({ allowed: true })
    ));

    await expect(controller.update(req, 'server-1', { name: 'blocked' })).rejects.toThrow('prod denied');
    expect(serverService.update).not.toHaveBeenCalled();
  });

  it('checks server delete and service detection through scoped write gates', async () => {
    const server = serverFixture('server-1');
    serverService.findOne.mockResolvedValue(server);
    serverService.remove.mockResolvedValue({ success: true });
    serverService.detectServices.mockResolvedValue({ services: [] });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.remove(req, 'server-1')).resolves.toEqual({ success: true });
    await expect(controller.detectServices(req, 'server-1')).resolves.toEqual({ services: [] });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'server.delete',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'server.detect_services',
      risk: 'medium',
    }));
  });

  it('checks connection test through scoped self-service write gate', async () => {
    serverService.findOne.mockResolvedValue(serverFixture('server-1'));
    serverService.testConnection.mockResolvedValue({ success: true });
    accessPolicyService.assertCanSelfServiceWrite.mockResolvedValue({ allowed: true });

    await expect(controller.testConnection(req, 'server-1')).resolves.toEqual({ success: true });
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'server',
      action: 'server.connection_test',
      targetType: 'server',
      targetId: 'server-1',
      risk: 'low',
    }));
    expect(serverService.testConnection).toHaveBeenCalledWith(req.teamId, 'server-1');
  });
});

function serverFixture(id: string, environmentBindings = [{ projectId: 'project-1', environmentId: 'env-prod' }]) {
  return {
    id,
    name: id,
    environmentBindings,
  };
}
