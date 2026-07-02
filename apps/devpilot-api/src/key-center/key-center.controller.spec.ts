import { ControlAccessPolicyService } from '../control-access-policy';
import { KeyType } from './dto/key-center.dto';
import { KeyCenterController } from './key-center.controller';
import { KeyCenterService } from './key-center.service';

describe('KeyCenterController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let keyCenterService: {
    resolveKeyInputAccessScope: jest.Mock;
    getKeyAccessScope: jest.Mock;
    getKeys: jest.Mock;
    listKeyScopes: jest.Mock;
    getKeyValue: jest.Mock;
    storeKey: jest.Mock;
    updateKey: jest.Mock;
    deleteKey: jest.Mock;
    generateProjectKeys: jest.Mock;
    exportAsEnv: jest.Mock;
    generateKey: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    canSensitiveRead: jest.Mock;
    assertCanSensitiveRead: jest.Mock;
    assertCanSelfServiceWrite: jest.Mock;
  };
  let controller: KeyCenterController;

  beforeEach(() => {
    keyCenterService = {
      resolveKeyInputAccessScope: jest.fn(),
      getKeyAccessScope: jest.fn(),
      getKeys: jest.fn(),
      listKeyScopes: jest.fn(),
      getKeyValue: jest.fn(),
      storeKey: jest.fn(),
      updateKey: jest.fn(),
      deleteKey: jest.fn(),
      generateProjectKeys: jest.fn(),
      exportAsEnv: jest.fn(),
      generateKey: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      canSensitiveRead: jest.fn(),
      assertCanSensitiveRead: jest.fn(),
      assertCanSelfServiceWrite: jest.fn(),
    };
    controller = new KeyCenterController(
      keyCenterService as unknown as KeyCenterService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters key list through project/environment read policy', async () => {
    keyCenterService.getKeys.mockResolvedValue([
      keyRecord('key-allowed', 'env-dev'),
      keyRecord('key-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'key-allowed'));

    await expect(controller.getKeys(req, 'project-1')).resolves.toEqual([keyRecord('key-allowed', 'env-dev')]);
    expect(keyCenterService.getKeys).toHaveBeenCalledWith(req.teamId, 'project-1', undefined);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'secret_key',
      action: 'secret_key.read',
      targetType: 'secret_key',
      targetId: 'key-denied',
      risk: 'low',
    }));
  });

  it('checks sensitive read before returning a key value', async () => {
    keyCenterService.getKeyAccessScope.mockResolvedValue(scope('env-prod'));
    keyCenterService.getKeyValue.mockResolvedValue('plain-secret');
    accessPolicyService.assertCanSensitiveRead.mockResolvedValue({ allowed: true });

    await expect(controller.getKeyValue('key-1', req)).resolves.toBe('plain-secret');
    expect(accessPolicyService.assertCanSensitiveRead).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'secret_key',
      action: 'secret_key.value.read',
      targetType: 'secret_key',
      targetId: 'key-1',
      risk: 'high',
    });
  });

  it('checks key creation against the resolved input scope', async () => {
    const dto = storeKeyDto('db-password', 'env-prod');
    keyCenterService.resolveKeyInputAccessScope.mockResolvedValue(scope('env-prod'));
    keyCenterService.storeKey.mockResolvedValue({ id: 'key-1' });
    accessPolicyService.assertCanSelfServiceWrite.mockResolvedValue({ allowed: true });

    await expect(controller.storeKey(dto, req)).resolves.toEqual({ id: 'key-1' });
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'secret_key.create',
      targetType: 'secret_key',
      targetId: null,
      risk: 'medium',
    }));
    expect(keyCenterService.storeKey).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks both current and target scopes when moving a key', async () => {
    keyCenterService.getKeyAccessScope.mockResolvedValue(scope('env-prod'));
    keyCenterService.resolveKeyInputAccessScope.mockResolvedValue(scope('env-dev'));
    keyCenterService.updateKey.mockResolvedValue({ id: 'key-1', environmentId: 'env-dev' });
    accessPolicyService.assertCanSelfServiceWrite.mockResolvedValue({ allowed: true });

    await expect(controller.updateKey('key-1', { environmentId: 'env-dev' }, req))
      .resolves
      .toEqual({ id: 'key-1', environmentId: 'env-dev' });
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenNthCalledWith(1, expect.objectContaining({
      environmentId: 'env-prod',
      action: 'secret_key.update',
      targetId: 'key-1',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenNthCalledWith(2, expect.objectContaining({
      environmentId: 'env-dev',
      action: 'secret_key.update',
      targetId: 'key-1',
    }));
  });

  it('checks delete and project key generation through scoped write gates', async () => {
    keyCenterService.getKeyAccessScope.mockResolvedValue(scope('env-prod'));
    keyCenterService.resolveKeyInputAccessScope.mockResolvedValue({ projectId: 'project-1', environmentId: null });
    keyCenterService.deleteKey.mockResolvedValue({ success: true });
    keyCenterService.generateProjectKeys.mockResolvedValue([{ id: 'generated-key' }]);
    accessPolicyService.assertCanSelfServiceWrite.mockResolvedValue({ allowed: true });

    await expect(controller.deleteKey('key-1', req)).resolves.toEqual({ success: true });
    await expect(controller.generateProjectKeys('project-1', { projectName: 'Demo' }, req))
      .resolves
      .toEqual([{ id: 'generated-key' }]);
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'secret_key.delete',
      targetId: 'key-1',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'secret_key.generate_project',
      targetId: 'project-1',
      risk: 'medium',
    }));
  });

  it('exports only keys allowed by sensitive read policy', async () => {
    keyCenterService.resolveKeyInputAccessScope.mockResolvedValue({ projectId: 'project-1', environmentId: null });
    keyCenterService.listKeyScopes.mockResolvedValue([
      keyRecord('key-allowed', 'env-dev'),
      keyRecord('key-denied', 'env-prod'),
    ]);
    keyCenterService.exportAsEnv.mockResolvedValue('DB_PASSWORD=secret');
    accessPolicyService.canSensitiveRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'key-allowed'));

    await expect(controller.exportAsEnv('project-1', req)).resolves.toBe('DB_PASSWORD=secret');
    expect(accessPolicyService.canSensitiveRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'secret_key.export',
      targetId: 'key-denied',
      risk: 'high',
    }));
    expect(keyCenterService.exportAsEnv).toHaveBeenCalledWith(req.teamId, 'project-1', ['key-allowed']);
  });
});

function keyRecord(id: string, environmentId: string) {
  return {
    id,
    projectId: 'project-1',
    environmentId,
  };
}

function scope(environmentId: string) {
  return {
    projectId: 'project-1',
    environmentId,
  };
}

function storeKeyDto(name: string, environmentId: string) {
  return {
    name,
    type: KeyType.DATABASE_PASSWORD,
    value: 'secret-value',
    projectId: 'project-1',
    environmentId,
  };
}
