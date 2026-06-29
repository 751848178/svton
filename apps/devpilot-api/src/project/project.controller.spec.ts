import { ControlAccessPolicyService } from '../control-access-policy';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

describe('ProjectController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let projectService: {
    findOne: jest.Mock;
  };
  let accessPolicyService: {
    assertCanRead: jest.Mock;
    canRead: jest.Mock;
  };
  let controller: ProjectController;

  beforeEach(() => {
    projectService = {
      findOne: jest.fn(),
    };
    accessPolicyService = {
      assertCanRead: jest.fn(),
      canRead: jest.fn(),
    };
    controller = new ProjectController(
      projectService as unknown as ProjectService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters project detail children by their own resource scopes', async () => {
    projectService.findOne.mockResolvedValue({
      id: 'project-1',
      allocations: [
        {
          id: 'allocation-1',
          resourceName: 'demo-db',
          status: 'active',
          pool: { id: 'pool-1', name: 'MySQL Pool', type: 'mysql' },
        },
      ],
      environments: [
        { id: 'env-allowed', projectId: 'project-1' },
        { id: 'env-denied', projectId: 'project-1' },
      ],
      managedResources: [
        { id: 'resource-allowed', projectId: 'project-1', environmentId: 'env-allowed' },
        { id: 'resource-denied', projectId: 'project-1', environmentId: 'env-denied' },
      ],
      secretKeys: [
        { id: 'key-allowed', projectId: 'project-1', environmentId: 'env-allowed' },
        { id: 'key-denied', projectId: 'project-1', environmentId: 'env-denied' },
      ],
      applications: [
        {
          id: 'app-1',
          projectId: 'project-1',
          services: [
            { id: 'service-allowed', projectId: 'project-1', environmentId: 'env-allowed' },
            { id: 'service-denied', projectId: 'project-1', environmentId: 'env-denied' },
          ],
        },
      ],
    });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });
    accessPolicyService.canRead.mockImplementation(({ targetId }) => (
      Promise.resolve(!String(targetId).endsWith('denied'))
    ));

    await expect(controller.findOne(req, 'project-1')).resolves.toEqual({
      id: 'project-1',
      allocations: [
        {
          id: 'allocation-1',
          resourceName: 'demo-db',
          status: 'active',
          pool: { id: 'pool-1', name: 'MySQL Pool', type: 'mysql' },
        },
      ],
      environments: [{ id: 'env-allowed', projectId: 'project-1' }],
      proxyConfigs: [],
      sites: [],
      applications: [
        {
          id: 'app-1',
          projectId: 'project-1',
          services: [{ id: 'service-allowed', projectId: 'project-1', environmentId: 'env-allowed' }],
        },
      ],
      cdnConfigs: [],
      managedResources: [{ id: 'resource-allowed', projectId: 'project-1', environmentId: 'env-allowed' }],
      resourceInstances: [],
      secretKeys: [{ id: 'key-allowed', projectId: 'project-1', environmentId: 'env-allowed' }],
    });
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      category: 'project',
      action: 'project.read',
      targetType: 'project',
      targetId: 'project-1',
    }));
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-denied',
      category: 'resource',
      action: 'resource.read',
      targetType: 'managed_resource',
      targetId: 'resource-denied',
    }));
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      environmentId: 'env-denied',
      category: 'application_service',
      action: 'application_service.read',
      targetType: 'application_service',
      targetId: 'service-denied',
    }));
  });

  it('does not expose resource allocation credentials on project detail', async () => {
    projectService.findOne.mockResolvedValue({
      id: 'project-1',
      allocations: [
        {
          id: 'allocation-1',
          resourceName: 'demo-db',
          status: 'active',
          pool: { id: 'pool-1', name: 'MySQL Pool', type: 'mysql' },
        },
      ],
    });
    accessPolicyService.assertCanRead.mockResolvedValue({ allowed: true });
    accessPolicyService.canRead.mockResolvedValue(true);

    const result = await controller.findOne(req, 'project-1');

    expect(result.allocations).toEqual([
      {
        id: 'allocation-1',
        resourceName: 'demo-db',
        status: 'active',
        pool: { id: 'pool-1', name: 'MySQL Pool', type: 'mysql' },
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('credentials');
  });
});
