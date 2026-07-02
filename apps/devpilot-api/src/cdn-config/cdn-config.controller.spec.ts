import { ControlAccessPolicyService } from '../control-access-policy';
import { CDNConfigController, TeamCredentialController } from './cdn-config.controller';
import { CDNConfigService } from './cdn-config.service';

describe('CDN config controller authorization', () => {
  const req = { user: { id: 'user-1' }, teamId: 'team-1' };

  let service: {
    resolveConfigInputAccessScope: jest.Mock;
    getConfigAccessScope: jest.Mock;
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    purgeCache: jest.Mock;
    createCredential: jest.Mock;
    findAllCredentials: jest.Mock;
    removeCredential: jest.Mock;
  };
  let access: {
    assertCanWrite: jest.Mock;
    assertCanRead: jest.Mock;
    canRead: jest.Mock;
  };
  let cdnController: CDNConfigController;
  let credentialController: TeamCredentialController;

  beforeEach(() => {
    service = {
      resolveConfigInputAccessScope: jest.fn(),
      getConfigAccessScope: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      purgeCache: jest.fn(),
      createCredential: jest.fn(),
      findAllCredentials: jest.fn(),
      removeCredential: jest.fn(),
    };
    access = {
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    const typedService = service as unknown as CDNConfigService;
    const typedAccess = access as unknown as ControlAccessPolicyService;
    cdnController = new CDNConfigController(typedService, typedAccess);
    credentialController = new TeamCredentialController(typedService, typedAccess);
  });

  it('filters CDN config lists through project and environment read policy', async () => {
    service.findAll.mockResolvedValue([
      cdnConfig('cdn-allowed', 'project-1', 'env-prod'),
      cdnConfig('cdn-denied', 'project-2', 'env-staging'),
    ]);
    access.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'cdn-allowed'));

    await expect(cdnController.findAll(req)).resolves.toEqual([
      cdnConfig('cdn-allowed', 'project-1', 'env-prod'),
    ]);
    expect(service.findAll).toHaveBeenCalledWith(req.teamId);
    expect(access.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-2',
      environmentId: 'env-staging',
      category: 'cdn',
      action: 'cdn_config.read',
      targetType: 'cdn_config',
      targetId: 'cdn-denied',
      risk: 'low',
    }));
  });

  it('checks CDN config detail read and create write scopes', async () => {
    const dto = createCdnDto('project-1', 'env-prod');
    service.findOne.mockResolvedValue(cdnConfig('cdn-1', 'project-1', 'env-prod'));
    service.resolveConfigInputAccessScope.mockResolvedValue({ projectId: 'project-1', environmentId: 'env-prod' });
    service.create.mockResolvedValue(cdnConfig('cdn-new', 'project-1', 'env-prod'));

    await expect(cdnController.findOne(req, 'cdn-1')).resolves.toEqual(cdnConfig('cdn-1', 'project-1', 'env-prod'));
    await expect(cdnController.create(req, dto)).resolves.toEqual(cdnConfig('cdn-new', 'project-1', 'env-prod'));
    expect(access.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'cdn_config.read',
      targetId: 'cdn-1',
      risk: 'low',
    }));
    expect(access.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'cdn_config.create',
      targetId: null,
      risk: 'medium',
    }));
    expect(service.create).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks current and target project/environment scopes when updating binding', async () => {
    service.getConfigAccessScope.mockResolvedValue({ projectId: 'project-old', environmentId: 'env-old' });
    service.resolveConfigInputAccessScope.mockResolvedValue({ projectId: 'project-new', environmentId: 'env-new' });
    service.update.mockResolvedValue(cdnConfig('cdn-1', 'project-new', 'env-new'));

    await expect(cdnController.update(req, 'cdn-1', { projectId: 'project-new', environmentId: 'env-new' }))
      .resolves
      .toEqual(cdnConfig('cdn-1', 'project-new', 'env-new'));
    expect(access.assertCanWrite).toHaveBeenNthCalledWith(1, expect.objectContaining({
      projectId: 'project-old',
      environmentId: 'env-old',
      action: 'cdn_config.update',
      targetId: 'cdn-1',
      risk: 'medium',
    }));
    expect(access.assertCanWrite).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectId: 'project-new',
      environmentId: 'env-new',
      action: 'cdn_config.update',
      targetId: 'cdn-1',
      risk: 'medium',
    }));
  });

  it('checks delete and purge CDN config write risks', async () => {
    service.getConfigAccessScope.mockResolvedValue({ projectId: 'project-1', environmentId: 'env-prod' });
    service.remove.mockResolvedValue({ deleted: true });
    service.purgeCache.mockResolvedValue({ success: true });

    await expect(cdnController.remove(req, 'cdn-1')).resolves.toEqual({ deleted: true });
    await expect(cdnController.purgeCache(req, 'cdn-1', { paths: ['/static/*'] }))
      .resolves
      .toEqual({ success: true });
    expect(access.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'cdn_config.delete',
      targetId: 'cdn-1',
      risk: 'high',
    }));
    expect(access.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'cdn_config.purge',
      targetId: 'cdn-1',
      risk: 'medium',
    }));
  });

  it('filters and gates team credential controller operations', async () => {
    service.findAllCredentials.mockResolvedValue([credential('cred-allowed'), credential('cred-denied')]);
    service.createCredential.mockResolvedValue(credential('cred-new'));
    service.removeCredential.mockResolvedValue({ deleted: true });
    access.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'cred-allowed'));

    await expect(credentialController.findAll(req, 'cdn_aliyun')).resolves.toEqual([credential('cred-allowed')]);
    await expect(credentialController.create(req, createCredentialDto())).resolves.toEqual(credential('cred-new'));
    await expect(credentialController.remove(req, 'cred-allowed')).resolves.toEqual({ deleted: true });
    expect(service.findAllCredentials).toHaveBeenCalledWith(req.teamId, 'cdn_aliyun');
    expect(access.canRead).toHaveBeenCalledWith(expect.objectContaining({
      category: 'team_credential',
      action: 'team_credential.read',
      targetId: 'cred-denied',
      risk: 'low',
    }));
    expect(access.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'team_credential.create',
      targetId: null,
      risk: 'high',
    }));
    expect(access.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'team_credential.delete',
      targetId: 'cred-allowed',
      risk: 'high',
    }));
  });

  it('does not delegate CDN or credential writes when access is denied', async () => {
    service.getConfigAccessScope.mockResolvedValue({ projectId: 'project-1', environmentId: 'env-prod' });
    access.assertCanWrite.mockRejectedValue(new Error('cdn denied'));

    await expect(cdnController.purgeCache(req, 'cdn-1', { paths: ['/static/*'] })).rejects.toThrow('cdn denied');
    await expect(credentialController.create(req, createCredentialDto())).rejects.toThrow('cdn denied');
    expect(service.purgeCache).not.toHaveBeenCalled();
    expect(service.createCredential).not.toHaveBeenCalled();
  });
});

function cdnConfig(id: string, projectId: string, environmentId: string) {
  return { id, projectId, environmentId, domain: `${id}.example.com` };
}
function credential(id: string) {
  return { id, type: 'cdn_aliyun', name: id };
}
function createCdnDto(projectId: string, environmentId: string) {
  return { name: 'CDN', domain: 'cdn.example.com', origin: 'origin.example.com', provider: 'aliyun' as const, credentialId: 'cred-1', projectId, environmentId };
}
function createCredentialDto() {
  return { type: 'cdn_aliyun', name: 'Aliyun CDN', config: { accessKeyId: 'ak', accessKeySecret: 'sk' } };
}
