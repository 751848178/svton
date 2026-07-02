import { ControlAccessPolicyService } from '../control-access-policy';
import { ProjectEnvironmentController } from './project-environment.controller';
import { ProjectEnvironmentService } from './project-environment.service';

describe('ProjectEnvironmentController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };
  const projectScope = {
    projectId: 'project-1',
    environmentId: 'env-prod',
  };
  const copyScope = {
    projectId: 'project-1',
    sourceEnvironmentId: 'env-source',
    targetEnvironmentId: 'env-target',
  };

  let environmentService: Record<string, jest.Mock>;
  let accessPolicyService: {
    assertCanRead: jest.Mock;
    assertCanWrite: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: ProjectEnvironmentController;

  beforeEach(() => {
    environmentService = {
      list: jest.fn(),
      create: jest.fn(),
      listSyncSuggestions: jest.fn(),
      getSyncApplyAccessScope: jest.fn(),
      applySyncSuggestions: jest.fn(),
      getResourceBulkBindingAccessScope: jest.fn(),
      bulkBindResources: jest.fn(),
      getSiteCopyAccessScope: jest.fn(),
      copySites: jest.fn(),
      getCdnConfigCopyAccessScope: jest.fn(),
      copyCdnConfigs: jest.fn(),
      getResourceCopyAccessScope: jest.fn(),
      copyResources: jest.fn(),
      getAccessScope: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      listServers: jest.fn(),
      bindServer: jest.fn(),
      unbindServer: jest.fn(),
      syncFromProject: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    controller = new ProjectEnvironmentController(
      environmentService as unknown as ProjectEnvironmentService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters environment lists through project-environment read policy', async () => {
    environmentService.list.mockResolvedValue([
      environment('env-allowed'),
      environment('env-denied'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'env-allowed')
    ));

    await expect(controller.list(req, { projectId: 'project-1' }))
      .resolves
      .toEqual([environment('env-allowed')]);
    expect(environmentService.list).toHaveBeenCalledWith(req.teamId, { projectId: 'project-1' });
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-denied',
      category: 'project_environment',
      action: 'project_environment.read',
      targetType: 'project_environment',
      targetId: 'env-denied',
      risk: 'low',
    }));
  });

  it('passes only readable environments into sync suggestion generation', async () => {
    environmentService.list.mockResolvedValue([
      environment('env-source'),
      environment('env-denied'),
    ]);
    environmentService.listSyncSuggestions.mockResolvedValue([{ kind: 'site' }]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'env-source')
    ));

    await expect(controller.listSyncSuggestions(req, { projectId: 'project-1' }))
      .resolves
      .toEqual([{ kind: 'site' }]);
    expect(environmentService.list).toHaveBeenCalledWith(req.teamId, {
      projectId: 'project-1',
      status: 'active',
    });
    expect(environmentService.listSyncSuggestions).toHaveBeenCalledWith(
      req.teamId,
      { projectId: 'project-1' },
      ['env-source'],
    );
  });

  it('checks project-scoped writes before create and project sync', async () => {
    const createDto = { projectId: 'project-1', key: 'prod', name: 'Production' };
    environmentService.create.mockResolvedValue(environment('env-prod'));
    environmentService.syncFromProject.mockResolvedValue({ created: 1 });

    await expect(controller.create(req, createDto)).resolves.toEqual(environment('env-prod'));
    await expect(controller.syncFromProject(req, { projectId: 'project-1' }))
      .resolves
      .toEqual({ created: 1 });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      action: 'project_environment.create',
      targetType: 'project_environment',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      action: 'project_environment.sync_from_project',
      targetType: 'project',
      targetId: 'project-1',
      risk: 'medium',
    }));
  });

  it('checks source read and target write before applying sync suggestions', async () => {
    const dto = { ...copyScope, dryRun: false };
    environmentService.getSyncApplyAccessScope.mockResolvedValue(copyScope);
    environmentService.applySyncSuggestions.mockResolvedValue({ applied: 2 });

    await expect(controller.applySyncSuggestions(req, dto))
      .resolves
      .toEqual({ applied: 2 });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-source',
      action: 'project_environment.read',
      targetId: 'env-source',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-target',
      action: 'project_environment.sync_suggestions.apply',
      targetId: 'env-target',
      risk: 'medium',
    }));
    expect(environmentService.applySyncSuggestions).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks source read and target write before copy operations', async () => {
    const dto = { ...copyScope, dryRun: false };
    environmentService.getSiteCopyAccessScope.mockResolvedValue(copyScope);
    environmentService.getCdnConfigCopyAccessScope.mockResolvedValue(copyScope);
    environmentService.getResourceCopyAccessScope.mockResolvedValue(copyScope);
    environmentService.copySites.mockResolvedValue({ copied: 1 });
    environmentService.copyCdnConfigs.mockResolvedValue({ copied: 2 });
    environmentService.copyResources.mockResolvedValue({ copied: 3 });

    await expect(controller.copySites(req, dto)).resolves.toEqual({ copied: 1 });
    await expect(controller.copyCdnConfigs(req, dto)).resolves.toEqual({ copied: 2 });
    await expect(controller.copyResources(req, dto)).resolves.toEqual({ copied: 3 });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.sites.copy.read_source',
      environmentId: 'env-source',
      targetId: 'env-source',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.cdn_configs.copy',
      environmentId: 'env-target',
      targetId: 'env-target',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.resources.copy',
      environmentId: 'env-target',
      targetId: 'env-target',
      risk: 'medium',
    }));
  });

  it('checks current environment scope before update, archive, and server reads', async () => {
    environmentService.getAccessScope.mockResolvedValue(projectScope);
    environmentService.update.mockResolvedValue({ id: 'env-prod', name: 'Prod' });
    environmentService.archive.mockResolvedValue({ id: 'env-prod', status: 'archived' });
    environmentService.listServers.mockResolvedValue([{ id: 'server-1' }]);

    await expect(controller.update(req, 'env-prod', { name: 'Prod' }))
      .resolves
      .toEqual({ id: 'env-prod', name: 'Prod' });
    await expect(controller.archive(req, 'env-prod'))
      .resolves
      .toEqual({ id: 'env-prod', status: 'archived' });
    await expect(controller.listServers(req, 'env-prod'))
      .resolves
      .toEqual([{ id: 'server-1' }]);
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.update',
      targetId: 'env-prod',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.archive',
      targetId: 'env-prod',
      risk: 'high',
    }));
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.read',
      targetId: 'env-prod',
      risk: 'low',
    }));
  });

  it('checks environment server binding writes before delegating', async () => {
    const dto = { serverId: 'server-1', role: 'runtime' as const };
    environmentService.getAccessScope.mockResolvedValue(projectScope);
    environmentService.bindServer.mockResolvedValue({ id: 'binding-1' });
    environmentService.unbindServer.mockResolvedValue({ deleted: true });

    await expect(controller.bindServer(req, 'env-prod', dto))
      .resolves
      .toEqual({ id: 'binding-1' });
    await expect(controller.unbindServer(req, 'env-prod', 'server-1'))
      .resolves
      .toEqual({ deleted: true });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.server.bind',
      targetType: 'project_environment_server',
      targetId: 'server-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.server.unbind',
      targetType: 'project_environment_server',
      targetId: 'server-1',
      risk: 'medium',
    }));
  });

  it('does not bulk-bind resources when the write gate rejects', async () => {
    const dto = { projectId: 'project-1', environmentId: 'env-prod', dryRun: true };
    environmentService.getResourceBulkBindingAccessScope.mockResolvedValue(projectScope);
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('environment denied'));

    await expect(controller.bulkBindResources(req, dto)).rejects.toThrow('environment denied');
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'project_environment.resources.bulk_bind',
      targetId: 'env-prod',
      risk: 'low',
    }));
    expect(environmentService.bulkBindResources).not.toHaveBeenCalled();
  });
});

function environment(id: string) {
  return {
    id,
    projectId: 'project-1',
    key: id,
    name: id,
  };
}
