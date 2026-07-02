import { ControlAccessPolicyService } from '../control-access-policy';
import {
  ResourceInstancesController,
  ResourceRequestsController,
} from './resource-request.controller';
import { ResourceRequestService } from './resource-request.service';

describe('ResourceRequestsController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let resourceRequestService: ResourceRequestServiceMock;
  let accessPolicyService: AccessPolicyMock;
  let controller: ResourceRequestsController;

  beforeEach(() => {
    resourceRequestService = createResourceRequestServiceMock();
    accessPolicyService = createAccessPolicyMock();
    controller = new ResourceRequestsController(
      resourceRequestService as unknown as ResourceRequestService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters resource requests through project/environment read policy', async () => {
    resourceRequestService.listRequests.mockResolvedValue([
      requestRecord('request-allowed', 'env-dev'),
      requestRecord('request-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'request-allowed'));

    await expect(controller.findAll(req, { projectId: 'project-1' })).resolves.toEqual([
      requestRecord('request-allowed', 'env-dev'),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'resource_request',
      action: 'resource_request.read',
      targetType: 'resource_request',
      targetId: 'request-denied',
      risk: 'low',
    }));
  });

  it('checks request creation against the resolved self-service scope', async () => {
    const dto = { resourceTypeId: 'type-1', environmentId: 'env-prod' } as any;
    resourceRequestService.resolveRequestInputAccessScope.mockResolvedValue(scope('env-prod'));
    resourceRequestService.createRequest.mockResolvedValue({ id: 'request-1' });
    accessPolicyService.assertCanSelfServiceWrite.mockResolvedValue({ allowed: true });

    await expect(controller.create(req, dto)).resolves.toEqual({ id: 'request-1' });
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'resource_request',
      action: 'resource_request.create',
      targetType: 'resource_request',
      targetId: null,
      risk: 'medium',
    }));
  });

  it('checks request details and cancel through request scope gates', async () => {
    resourceRequestService.getRequestAccessScope.mockResolvedValue(scope('env-prod'));
    resourceRequestService.getRequest.mockResolvedValue({ id: 'request-1' });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });
    accessPolicyService.assertCanSelfServiceWrite.mockRejectedValue(new Error('cancel denied'));

    await expect(controller.findOne(req, 'request-1')).resolves.toEqual({ id: 'request-1' });
    await expect(controller.cancel(req, 'request-1')).rejects.toThrow('cancel denied');
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_request.read',
      targetId: 'request-1',
      environmentId: 'env-prod',
    }));
    expect(accessPolicyService.assertCanSelfServiceWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_request.cancel',
      targetId: 'request-1',
      risk: 'medium',
    }));
    expect(resourceRequestService.cancelRequest).not.toHaveBeenCalled();
  });

  it('checks provisioning supervisor and run mutations before service delegation', async () => {
    resourceRequestService.getRequestAccessScope.mockResolvedValue(scope('env-prod'));
    resourceRequestService.getProvisioningRunSupervisor.mockResolvedValue({ queue: [] });
    resourceRequestService.reconcileProviderProvisioningRun.mockResolvedValue({ id: 'run-1' });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.provisioningRunSupervisor(req, {})).resolves.toEqual({ queue: [] });
    await expect(controller.reconcileProviderProvisioningRun(req, 'request-1', 'run-1', {
      providerState: { status: 'available' },
    } as any)).resolves.toEqual({ id: 'run-1' });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_request.provisioning_run.supervisor',
      targetId: null,
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_request.provisioning_run.reconcile_provider_state',
      targetId: 'request-1',
      environmentId: 'env-prod',
      risk: 'high',
    }));
  });

  it('does not complete requests when high-risk write policy denies', async () => {
    resourceRequestService.getRequestAccessScope.mockResolvedValue(scope('env-prod'));
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('complete denied'));

    await expect(controller.complete(req, 'request-1', {} as any)).rejects.toThrow('complete denied');
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_request.complete',
      targetId: 'request-1',
      risk: 'high',
    }));
    expect(resourceRequestService.completeRequest).not.toHaveBeenCalled();
  });
});

describe('ResourceInstancesController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let resourceRequestService: ResourceRequestServiceMock;
  let accessPolicyService: AccessPolicyMock;
  let controller: ResourceInstancesController;

  beforeEach(() => {
    resourceRequestService = createResourceRequestServiceMock();
    accessPolicyService = createAccessPolicyMock();
    controller = new ResourceInstancesController(
      resourceRequestService as unknown as ResourceRequestService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters resource instances through project/environment read policy', async () => {
    resourceRequestService.listInstances.mockResolvedValue([
      instanceRecord('instance-allowed', 'env-dev'),
      instanceRecord('instance-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'instance-allowed'));

    await expect(controller.findAll(req, { projectId: 'project-1' })).resolves.toEqual([
      instanceRecord('instance-allowed', 'env-dev'),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'resource_instance',
      action: 'resource_instance.read',
      targetType: 'resource_instance',
      targetId: 'instance-denied',
      risk: 'low',
    }));
  });

  it('checks instance details and release through instance scope gates', async () => {
    resourceRequestService.getInstanceAccessScope.mockResolvedValue(scope('env-prod'));
    resourceRequestService.getInstance.mockResolvedValue({ id: 'instance-1' });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('release denied'));

    await expect(controller.findOne(req, 'instance-1')).resolves.toEqual({ id: 'instance-1' });
    await expect(controller.release(req, 'instance-1')).rejects.toThrow('release denied');
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_instance.read',
      targetType: 'resource_instance',
      targetId: 'instance-1',
      environmentId: 'env-prod',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'resource_instance.release',
      targetType: 'resource_instance',
      targetId: 'instance-1',
      risk: 'high',
    }));
    expect(resourceRequestService.releaseInstance).not.toHaveBeenCalled();
  });
});

type ResourceRequestServiceMock = ReturnType<typeof createResourceRequestServiceMock>;
type AccessPolicyMock = ReturnType<typeof createAccessPolicyMock>;

function createResourceRequestServiceMock() {
  return {
    resolveRequestInputAccessScope: jest.fn(),
    createRequest: jest.fn(),
    listRequests: jest.fn(),
    getRequestAccessScope: jest.fn(),
    getRequest: jest.fn(),
    cancelRequest: jest.fn(),
    getProvisioningRunSupervisor: jest.fn(),
    reconcileProviderProvisioningRun: jest.fn(),
    completeRequest: jest.fn(),
    listInstances: jest.fn(),
    getInstanceAccessScope: jest.fn(),
    getInstance: jest.fn(),
    releaseInstance: jest.fn(),
  };
}

function createAccessPolicyMock() {
  return {
    canRead: jest.fn(),
    assertCanRead: jest.fn(),
    assertCanWrite: jest.fn(),
    assertCanSelfServiceWrite: jest.fn(),
  };
}

function scope(environmentId: string) {
  return { projectId: 'project-1', environmentId };
}

function requestRecord(id: string, environmentId: string) {
  return { id, ...scope(environmentId) };
}

function instanceRecord(id: string, environmentId: string) {
  return { id, ...scope(environmentId) };
}
