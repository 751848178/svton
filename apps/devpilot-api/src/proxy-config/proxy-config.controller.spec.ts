import { ControlAccessPolicyService } from '../control-access-policy';
import { ProxyConfigController } from './proxy-config.controller';
import { ProxyConfigService } from './proxy-config.service';

describe('ProxyConfigController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let proxyConfigService: {
    resolveConfigInputAccessScope: jest.Mock;
    getConfigAccessScope: jest.Mock;
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    preview: jest.Mock;
    sync: jest.Mock;
  };
  let accessPolicyService: {
    assertCanWrite: jest.Mock;
    assertCanRead: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: ProxyConfigController;

  beforeEach(() => {
    proxyConfigService = {
      resolveConfigInputAccessScope: jest.fn(),
      getConfigAccessScope: jest.fn(),
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      preview: jest.fn(),
      sync: jest.fn(),
    };
    accessPolicyService = {
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    controller = new ProxyConfigController(
      proxyConfigService as unknown as ProxyConfigService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters proxy config lists through project read policy', async () => {
    proxyConfigService.findAll.mockResolvedValue([
      proxyConfig('proxy-allowed', 'project-1'),
      proxyConfig('proxy-denied', 'project-2'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'proxy-allowed')
    ));

    await expect(controller.findAll(req)).resolves.toEqual([
      proxyConfig('proxy-allowed', 'project-1'),
    ]);
    expect(proxyConfigService.findAll).toHaveBeenCalledWith(req.teamId);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-2',
      category: 'site',
      action: 'proxy_config.read',
      targetType: 'proxy_config',
      targetId: 'proxy-denied',
      risk: 'low',
    }));
  });

  it('checks detail and preview read access before delegating', async () => {
    proxyConfigService.findOne.mockResolvedValue(proxyConfig('proxy-1', 'project-1'));
    proxyConfigService.getConfigAccessScope.mockResolvedValue({ projectId: 'project-1' });
    proxyConfigService.preview.mockResolvedValue('server { listen 80; }');

    await expect(controller.findOne(req, 'proxy-1')).resolves.toEqual(proxyConfig('proxy-1', 'project-1'));
    await expect(controller.preview(req, 'proxy-1')).resolves.toBe('server { listen 80; }');
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      action: 'proxy_config.read',
      targetType: 'proxy_config',
      targetId: 'proxy-1',
      risk: 'low',
    }));
    expect(proxyConfigService.preview).toHaveBeenCalledWith(req.teamId, 'proxy-1');
  });

  it('checks create against the resolved project scope', async () => {
    const dto = createDto('project-1');
    proxyConfigService.resolveConfigInputAccessScope.mockResolvedValue({ projectId: 'project-1' });
    proxyConfigService.create.mockResolvedValue(proxyConfig('proxy-1', 'project-1'));

    await expect(controller.create(req, dto)).resolves.toEqual(proxyConfig('proxy-1', 'project-1'));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      category: 'site',
      action: 'proxy_config.create',
      targetType: 'proxy_config',
      targetId: null,
      risk: 'medium',
    }));
    expect(proxyConfigService.create).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks current and target project scopes when updating project binding', async () => {
    proxyConfigService.getConfigAccessScope.mockResolvedValue({ projectId: 'project-old' });
    proxyConfigService.resolveConfigInputAccessScope.mockResolvedValue({ projectId: 'project-new' });
    proxyConfigService.update.mockResolvedValue(proxyConfig('proxy-1', 'project-new'));

    await expect(controller.update(req, 'proxy-1', { projectId: 'project-new' }))
      .resolves
      .toEqual(proxyConfig('proxy-1', 'project-new'));
    expect(accessPolicyService.assertCanWrite).toHaveBeenNthCalledWith(1, expect.objectContaining({
      projectId: 'project-old',
      action: 'proxy_config.update',
      targetId: 'proxy-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenNthCalledWith(2, expect.objectContaining({
      projectId: 'project-new',
      action: 'proxy_config.update',
      targetId: 'proxy-1',
      risk: 'medium',
    }));
    expect(proxyConfigService.update).toHaveBeenCalledWith(req.teamId, 'proxy-1', { projectId: 'project-new' });
  });

  it('checks delete and sync as high-risk writes', async () => {
    proxyConfigService.getConfigAccessScope.mockResolvedValue({ projectId: 'project-1' });
    proxyConfigService.remove.mockResolvedValue({ deleted: true });
    proxyConfigService.sync.mockResolvedValue({ success: true });

    await expect(controller.remove(req, 'proxy-1')).resolves.toEqual({ deleted: true });
    await expect(controller.sync(req, 'proxy-1')).resolves.toEqual({ success: true });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'proxy_config.delete',
      targetId: 'proxy-1',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'proxy_config.sync',
      targetId: 'proxy-1',
      risk: 'high',
    }));
  });

  it('does not sync proxy config when the write gate rejects', async () => {
    proxyConfigService.getConfigAccessScope.mockResolvedValue({ projectId: 'project-1' });
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('proxy denied'));

    await expect(controller.sync(req, 'proxy-1')).rejects.toThrow('proxy denied');
    expect(proxyConfigService.sync).not.toHaveBeenCalled();
  });
});

function proxyConfig(id: string, projectId: string | null) {
  return {
    id,
    projectId,
    domain: `${id}.example.com`,
  };
}

function createDto(projectId: string) {
  return {
    name: 'Proxy',
    domain: 'proxy.example.com',
    upstreams: [{ host: '127.0.0.1', port: 3000 }],
    ssl: { enabled: false },
    projectId,
  };
}
