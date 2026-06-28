import { ControlAccessPolicyService } from '../control-access-policy';
import { DeploymentController } from './deployment.controller';
import { DeploymentService } from './deployment.service';

describe('DeploymentController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let deploymentService: {
    listRuns: jest.Mock;
    getRunAccessScope: jest.Mock;
    rollbackRun: jest.Mock;
    requestSmokeFailureRollback: jest.Mock;
    retryRun: jest.Mock;
    smokeCheckRun: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanWrite: jest.Mock;
  };
  let controller: DeploymentController;

  beforeEach(() => {
    deploymentService = {
      listRuns: jest.fn(),
      getRunAccessScope: jest.fn(),
      rollbackRun: jest.fn(),
      requestSmokeFailureRollback: jest.fn(),
      retryRun: jest.fn(),
      smokeCheckRun: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanWrite: jest.fn(),
    };
    controller = new DeploymentController(
      deploymentService as unknown as DeploymentService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters deployment runs through project/environment read policy', async () => {
    deploymentService.listRuns.mockResolvedValue([
      { id: 'run-allowed', projectId: 'project-1', environmentId: 'env-prod' },
      { id: 'run-denied', projectId: 'project-2', environmentId: 'env-prod' },
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'run-allowed'));

    await expect(controller.listRuns(req, {})).resolves.toEqual([
      { id: 'run-allowed', projectId: 'project-1', environmentId: 'env-prod' },
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'deployment_run.read',
      targetType: 'deployment_run',
      targetId: 'run-allowed',
      risk: 'low',
    }));
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-2',
      targetId: 'run-denied',
    }));
  });

  it('checks live rollback as a high-risk deployment write', async () => {
    deploymentService.getRunAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });
    deploymentService.rollbackRun.mockResolvedValue({ id: 'rollback-run' });

    await expect(controller.rollbackRun(req, 'run-1', { dryRun: false })).resolves.toEqual({ id: 'rollback-run' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'deployment.rollback',
      targetType: 'deployment_run',
      targetId: 'run-1',
      risk: 'high',
    });
  });

  it('checks live retry as a high-risk deployment write', async () => {
    deploymentService.getRunAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });
    deploymentService.retryRun.mockResolvedValue({ id: 'retry-run' });

    await expect(controller.retryRun(req, 'run-1', { dryRun: false })).resolves.toEqual({ id: 'retry-run' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'deployment.retry',
      targetType: 'deployment_run',
      targetId: 'run-1',
      risk: 'high',
    });
    expect(deploymentService.retryRun).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
      'run-1',
      { dryRun: false },
    );
  });

  it('checks deployment smoke check as a low-risk deployment write', async () => {
    deploymentService.getRunAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });
    deploymentService.smokeCheckRun.mockResolvedValue({ id: 'smoke-run' });

    await expect(controller.smokeCheckRun(req, 'run-1', { dryRun: false })).resolves.toEqual({ id: 'smoke-run' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'deployment.smoke_check',
      targetType: 'deployment_run',
      targetId: 'run-1',
      risk: 'low',
    });
    expect(deploymentService.smokeCheckRun).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
      'run-1',
      { dryRun: false },
    );
  });

  it('checks smoke failure live rollback as a high-risk deployment write', async () => {
    deploymentService.getRunAccessScope.mockResolvedValue({
      projectId: 'project-1',
      environmentId: 'env-prod',
    });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });
    deploymentService.requestSmokeFailureRollback.mockResolvedValue({ id: 'rollback-run' });

    await expect(controller.requestSmokeFailureRollback(req, 'smoke-run-1', { dryRun: false }))
      .resolves
      .toEqual({ id: 'rollback-run' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'deployment',
      action: 'deployment.smoke_failure_rollback',
      targetType: 'deployment_run',
      targetId: 'smoke-run-1',
      risk: 'high',
    });
    expect(deploymentService.requestSmokeFailureRollback).toHaveBeenCalledWith(
      req.teamId,
      req.user.id,
      'smoke-run-1',
      { dryRun: false },
    );
  });
});
