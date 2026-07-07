import { ControlAccessPolicyService } from '../control-access-policy';
import {
  ResourceControlReadController,
  ResourceControlWriteController,
} from './resource-control.controller';
import { ResourceControlService } from './resource-control.service';
import { ResourceControlAccessPolicyService } from './resource-control-access-policy.service';

describe('ResourceControl controllers authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let resourceControlService: {
    listResources: jest.Mock;
    listSyncRuns: jest.Mock;
    listActionRuns: jest.Mock;
    executeResourceAction: jest.Mock;
    updateResourceBinding: jest.Mock;
    syncServerDocker: jest.Mock;
    syncCloudResources: jest.Mock;
    getResourceAccessScope: jest.Mock;
    resolveResourceBindingTargetAccessScope: jest.Mock;
    resolveEnvironmentAccessScope: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanWrite: jest.Mock;
  };
  let readController: ResourceControlReadController;
  let writeController: ResourceControlWriteController;

  beforeEach(() => {
    resourceControlService = {
      listResources: jest.fn(),
      listSyncRuns: jest.fn(),
      listActionRuns: jest.fn(),
      executeResourceAction: jest.fn(),
      updateResourceBinding: jest.fn(),
      syncServerDocker: jest.fn(),
      syncCloudResources: jest.fn(),
      getResourceAccessScope: jest.fn(),
      resolveResourceBindingTargetAccessScope: jest.fn(),
      resolveEnvironmentAccessScope: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanWrite: jest.fn(),
    };
    const accessPolicy = new ResourceControlAccessPolicyService(
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
    readController = new ResourceControlReadController(
      resourceControlService as unknown as ResourceControlService,
      accessPolicy,
    );
    writeController = new ResourceControlWriteController(
      resourceControlService as unknown as ResourceControlService,
      accessPolicy,
    );
  });

  it('filters managed resources through direct project/environment read scope', async () => {
    resourceControlService.listResources.mockResolvedValue([
      resourceRecord('resource-allowed', 'env-dev'),
      resourceRecord('resource-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'resource-allowed'));

    await expect(readController.listResources(req, { projectId: 'project-1' })).resolves.toEqual([
      resourceRecord('resource-allowed', 'env-dev'),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'resource',
      action: 'resource.read',
      targetType: 'managed_resource',
      targetId: 'resource-denied',
      risk: 'low',
    }));
  });

  it('filters resource action runs through nested resource scope', async () => {
    resourceControlService.listActionRuns.mockResolvedValue([
      runRecord('run-allowed', { resource: scope('env-dev') }),
      runRecord('run-denied', { resource: scope('env-prod') }),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'run-allowed'));

    await expect(readController.listActionRuns(req, {})).resolves.toEqual([
      runRecord('run-allowed', { resource: scope('env-dev') }),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'resource_action_run.read',
      targetType: 'resource_action_run',
      targetId: 'run-denied',
    }));
  });

  it('filters sync runs through metadata scope fallback', async () => {
    resourceControlService.listSyncRuns.mockResolvedValue([
      runRecord('sync-allowed', { metadata: scope('env-dev') }),
      runRecord('sync-denied', { metadata: scope('env-prod') }),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'sync-allowed'));

    await expect(readController.listSyncRuns(req)).resolves.toEqual([
      runRecord('sync-allowed', { metadata: scope('env-dev') }),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      environmentId: 'env-prod',
      action: 'resource_sync_run.read',
      targetType: 'resource_sync_run',
      targetId: 'sync-denied',
    }));
  });

  it('checks live resource actions against resource scope before delegation', async () => {
    resourceControlService.getResourceAccessScope.mockResolvedValue(scope('env-prod'));
    resourceControlService.executeResourceAction.mockResolvedValue({ id: 'run-1' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(writeController.executeResourceAction(req, 'resource-1', {
      action: 'restart',
      dryRun: false,
    })).resolves.toEqual({ id: 'run-1' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'resource.action.restart',
      targetType: 'managed_resource',
      targetId: 'resource-1',
      risk: 'high',
    }));
  });

  it('does not execute resource actions when write policy denies', async () => {
    resourceControlService.getResourceAccessScope.mockResolvedValue(scope('env-prod'));
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('denied'));

    await expect(writeController.executeResourceAction(req, 'resource-1', {
      action: 'restart',
      dryRun: false,
    })).rejects.toThrow('denied');
    expect(resourceControlService.executeResourceAction).not.toHaveBeenCalled();
  });

  it('checks resource binding migrations against current and target scopes', async () => {
    resourceControlService.getResourceAccessScope.mockResolvedValue(scope('env-dev'));
    resourceControlService.resolveResourceBindingTargetAccessScope.mockResolvedValue(scope('env-prod'));
    resourceControlService.updateResourceBinding.mockResolvedValue({ id: 'resource-1', environmentId: 'env-prod' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(writeController.updateResourceBinding(req, 'resource-1', { environmentId: 'env-prod' }))
      .resolves
      .toEqual({ id: 'resource-1', environmentId: 'env-prod' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledTimes(2);
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      environmentId: 'env-dev',
      action: 'resource.binding.update',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      environmentId: 'env-prod',
      action: 'resource.binding.update',
    }));
  });

  it('checks environment scoped Docker and cloud sync writes', async () => {
    resourceControlService.resolveEnvironmentAccessScope.mockResolvedValue(scope('env-prod'));
    resourceControlService.syncServerDocker.mockResolvedValue({ id: 'docker-sync' });
    resourceControlService.syncCloudResources.mockResolvedValue({ id: 'cloud-sync' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(writeController.syncServerDocker(req, 'server-1', { environmentId: 'env-prod' }))
      .resolves
      .toEqual({ id: 'docker-sync' });
    await expect(writeController.syncCloudResources(req, { environmentId: 'env-prod', provider: 'aliyun-rds' }))
      .resolves
      .toEqual({ id: 'cloud-sync' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource.sync_docker',
      targetType: 'server',
      targetId: 'server-1',
      environmentId: 'env-prod',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource.sync_cloud',
      targetType: 'cloud_resources',
      targetId: 'aliyun-rds',
      environmentId: 'env-prod',
      risk: 'medium',
    }));
  });
});

function scope(environmentId: string) {
  return { projectId: 'project-1', environmentId };
}

function resourceRecord(id: string, environmentId: string) {
  return { id, ...scope(environmentId) };
}

function runRecord(id: string, extra: Record<string, unknown>) {
  return { id, ...extra };
}
