import { ControlAccessPolicyService } from '../control-access-policy';
import { ApplicationController } from './application.controller';
import { ApplicationService } from './application.service';

describe('ApplicationController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };
  const serviceScope = {
    projectId: 'project-1',
    environmentId: 'env-prod',
  };

  let applicationService: Record<string, jest.Mock>;
  let accessPolicyService: {
    assertCanRead: jest.Mock;
    assertCanWrite: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: ApplicationController;

  beforeEach(() => {
    applicationService = {
      list: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      getApplicationAccessScope: jest.fn(),
      update: jest.fn(),
      archive: jest.fn(),
      resolveServiceCreateAccessScope: jest.fn(),
      createService: jest.fn(),
      getServiceAccessScope: jest.fn(),
      updateService: jest.fn(),
      archiveService: jest.fn(),
      listServiceOperations: jest.fn(),
      executeServiceOperation: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
      canRead: jest.fn().mockResolvedValue(true),
    };
    controller = new ApplicationController(
      applicationService as unknown as ApplicationService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters application lists and nested service/operation scopes', async () => {
    applicationService.list.mockResolvedValue([
      app('app-allowed', [
        service('svc-allowed', [operation('op-allowed', 'env-prod')]),
        service('svc-denied'),
      ]),
      app('app-denied'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(!String(targetId).endsWith('denied'))
    ));

    await expect(controller.list(req, { projectId: 'project-1' }))
      .resolves
      .toEqual([app('app-allowed', [service('svc-allowed', [operation('op-allowed', 'env-prod')])])]);
    expect(applicationService.list).toHaveBeenCalledWith(req.teamId, { projectId: 'project-1' });
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      category: 'application',
      action: 'application.read',
      targetType: 'application',
      targetId: 'app-denied',
    }));
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      category: 'application_service',
      action: 'application_service.read',
      targetType: 'application_service',
      targetId: 'svc-denied',
    }));
  });

  it('checks application detail read before filtering child services', async () => {
    applicationService.findOne.mockResolvedValue(app('app-1', [
      service('svc-allowed'),
      service('svc-denied'),
    ]));
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId !== 'svc-denied')
    ));

    await expect(controller.findOne(req, 'app-1'))
      .resolves
      .toEqual(app('app-1', [service('svc-allowed')]));
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      category: 'application',
      action: 'application.read',
      targetType: 'application',
      targetId: 'app-1',
      risk: 'low',
    }));
  });

  it('checks application create, update, and archive write gates', async () => {
    const createDto = { projectId: 'project-1', name: 'Console' };
    applicationService.create.mockResolvedValue(app('app-1'));
    applicationService.getApplicationAccessScope.mockResolvedValue({ projectId: 'project-1' });
    applicationService.update.mockResolvedValue({ id: 'app-1', name: 'Console API' });
    applicationService.archive.mockResolvedValue({ id: 'app-1', status: 'archived' });

    await expect(controller.create(req, createDto)).resolves.toEqual(app('app-1'));
    await expect(controller.update(req, 'app-1', { name: 'Console API' }))
      .resolves
      .toEqual({ id: 'app-1', name: 'Console API' });
    await expect(controller.archive(req, 'app-1'))
      .resolves
      .toEqual({ id: 'app-1', status: 'archived' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      category: 'application',
      action: 'application.create',
      targetType: 'application',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application.update',
      targetId: 'app-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application.archive',
      targetId: 'app-1',
      risk: 'high',
    }));
  });

  it('checks service create, update migration, and archive gates', async () => {
    applicationService.resolveServiceCreateAccessScope
      .mockResolvedValueOnce({ projectId: 'project-1', environmentId: 'env-prod' })
      .mockResolvedValueOnce({ projectId: 'project-1', environmentId: 'env-staging' });
    applicationService.getServiceAccessScope.mockResolvedValue(serviceScope);
    applicationService.createService.mockResolvedValue(service('svc-1'));
    applicationService.updateService.mockResolvedValue({ id: 'svc-1', environmentId: 'env-staging' });
    applicationService.archiveService.mockResolvedValue({ id: 'svc-1', status: 'archived' });

    await expect(controller.createService(req, 'app-1', { environmentId: 'env-prod', name: 'web' }))
      .resolves
      .toEqual(service('svc-1'));
    await expect(controller.updateService(req, 'app-1', 'svc-1', { environmentId: 'env-staging' }))
      .resolves
      .toEqual({ id: 'svc-1', environmentId: 'env-staging' });
    await expect(controller.archiveService(req, 'app-1', 'svc-1'))
      .resolves
      .toEqual({ id: 'svc-1', status: 'archived' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application_service.create',
      targetType: 'application',
      targetId: 'app-1',
      environmentId: 'env-prod',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application_service.update',
      targetType: 'application_service',
      targetId: 'svc-1',
      environmentId: 'env-prod',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application_service.update',
      targetType: 'application_service',
      targetId: 'svc-1',
      environmentId: 'env-staging',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application_service.archive',
      targetId: 'svc-1',
      risk: 'high',
    }));
  });

  it('checks service operation reads and filters operation runs', async () => {
    applicationService.getServiceAccessScope.mockResolvedValue(serviceScope);
    applicationService.listServiceOperations.mockResolvedValue([
      operation('op-allowed', 'env-prod'),
      operation('op-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(targetId === 'op-allowed')
    ));

    await expect(controller.listServiceOperations(req, 'app-1', 'svc-1'))
      .resolves
      .toEqual([operation('op-allowed', 'env-prod')]);
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      category: 'application_service',
      action: 'application_service.read',
      targetType: 'application_service',
      targetId: 'svc-1',
      environmentId: 'env-prod',
    }));
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'application_service_operation_run.read',
      targetType: 'application_service_operation_run',
      targetId: 'op-denied',
    }));
  });

  it('checks service operation write risk before execution', async () => {
    const dto = { action: 'restart' as const, dryRun: false, confirmationText: 'restart web' };
    applicationService.getServiceAccessScope.mockResolvedValue(serviceScope);
    applicationService.executeServiceOperation.mockResolvedValue({ id: 'op-1' });

    await expect(controller.executeServiceOperation(req, 'app-1', 'svc-1', dto))
      .resolves
      .toEqual({ id: 'op-1' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      category: 'application_service',
      action: 'application_service.operation.restart',
      targetType: 'application_service',
      targetId: 'svc-1',
      environmentId: 'env-prod',
      risk: 'high',
    }));
    expect(applicationService.executeServiceOperation).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
      'app-1',
      'svc-1',
      dto,
    );
  });

  it('does not execute service operations when the write gate rejects', async () => {
    applicationService.getServiceAccessScope.mockResolvedValue(serviceScope);
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('operation denied'));

    await expect(controller.executeServiceOperation(req, 'app-1', 'svc-1', {
      action: 'rollback',
      dryRun: false,
    })).rejects.toThrow('operation denied');
    expect(applicationService.executeServiceOperation).not.toHaveBeenCalled();
  });
});

function app(id: string, services?: ReturnType<typeof service>[]) {
  return {
    id,
    projectId: 'project-1',
    name: id,
    ...(services ? { services } : {}),
  };
}

function service(id: string, operationRuns?: ReturnType<typeof operation>[]) {
  return {
    id,
    projectId: 'project-1',
    environmentId: id === 'svc-denied' ? 'env-denied' : 'env-prod',
    name: id,
    ...(operationRuns ? { operationRuns } : {}),
  };
}

function operation(id: string, environmentId: string) {
  return {
    id,
    projectId: 'project-1',
    environmentId,
  };
}
