import { ControlAccessPolicyService } from '../control-access-policy';
import { BackupRestoreService } from './backup-restore.service';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

describe('BackupController authorization', () => {
  const req = {
    user: { id: 'user-1' },
    teamId: 'team-1',
  };

  let backupService: {
    listPlans: jest.Mock;
    listRuns: jest.Mock;
    resolvePlanCreateAccessScope: jest.Mock;
    getPlanAccessScope: jest.Mock;
    createPlan: jest.Mock;
    updatePlan: jest.Mock;
    runPlan: jest.Mock;
  };
  let accessPolicyService: {
    canRead: jest.Mock;
    assertCanWrite: jest.Mock;
  };
  let backupRestoreService: {
    getRestoreAccessScope: jest.Mock;
    restoreRun: jest.Mock;
  };
  let controller: BackupController;

  beforeEach(() => {
    backupService = {
      listPlans: jest.fn(),
      listRuns: jest.fn(),
      resolvePlanCreateAccessScope: jest.fn(),
      getPlanAccessScope: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      runPlan: jest.fn(),
    };
    accessPolicyService = {
      canRead: jest.fn(),
      assertCanWrite: jest.fn(),
    };
    backupRestoreService = {
      getRestoreAccessScope: jest.fn(),
      restoreRun: jest.fn(),
    };
    controller = new BackupController(
      backupService as unknown as BackupService,
      backupRestoreService as unknown as BackupRestoreService,
      accessPolicyService as unknown as ControlAccessPolicyService,
    );
  });

  it('filters backup plans through project/environment read policy', async () => {
    backupService.listPlans.mockResolvedValue([
      backupRecord('plan-allowed', 'env-dev'),
      backupRecord('plan-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'plan-allowed'));

    await expect(controller.listPlans(req, { projectId: 'project-1' })).resolves.toEqual([
      backupRecord('plan-allowed', 'env-dev'),
    ]);
    expect(backupService.listPlans).toHaveBeenCalledWith(req.teamId, { projectId: 'project-1' });
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'backup',
      action: 'backup_plan.read',
      targetType: 'backup_plan',
      targetId: 'plan-denied',
      risk: 'low',
    }));
  });

  it('filters backup runs through project/environment read policy', async () => {
    backupService.listRuns.mockResolvedValue([
      backupRecord('run-allowed', 'env-dev'),
      backupRecord('run-denied', 'env-prod'),
    ]);
    accessPolicyService.canRead.mockImplementation(({ targetId }) => Promise.resolve(targetId === 'run-allowed'));

    await expect(controller.listRuns(req, { planId: 'plan-1' })).resolves.toEqual([
      backupRecord('run-allowed', 'env-dev'),
    ]);
    expect(accessPolicyService.canRead).toHaveBeenCalledWith(expect.objectContaining({
      environmentId: 'env-prod',
      action: 'backup_run.read',
      targetType: 'backup_run',
      targetId: 'run-denied',
    }));
  });

  it('checks backup plan creation against the resolved resource scope', async () => {
    const dto = { resourceId: 'resource-1', name: 'Daily backup' };
    backupService.resolvePlanCreateAccessScope.mockResolvedValue(scope('env-prod'));
    backupService.createPlan.mockResolvedValue({ id: 'plan-1' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.createPlan(req, dto)).resolves.toEqual({ id: 'plan-1' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId: 'project-1',
      environmentId: 'env-prod',
      category: 'backup',
      action: 'backup.plan.create',
      targetType: 'backup_plan',
      targetId: 'resource-1',
      risk: 'medium',
    });
    expect(backupService.createPlan).toHaveBeenCalledWith(req.teamId, req.user.id, dto);
  });

  it('checks backup plan updates against the existing plan scope', async () => {
    backupService.getPlanAccessScope.mockResolvedValue(scope('env-prod'));
    backupService.updatePlan.mockResolvedValue({ id: 'plan-1', name: 'Renamed' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.updatePlan(req, 'plan-1', { name: 'Renamed' })).resolves.toEqual({
      id: 'plan-1',
      name: 'Renamed',
    });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      environmentId: 'env-prod',
      action: 'backup.plan.update',
      targetType: 'backup_plan',
      targetId: 'plan-1',
      risk: 'medium',
    }));
  });

  it('checks dry-run and live backup runs with different risk levels', async () => {
    backupService.getPlanAccessScope.mockResolvedValue(scope('env-prod'));
    backupService.runPlan.mockResolvedValue({ id: 'run-1' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.runPlan(req, 'plan-1', { dryRun: true })).resolves.toEqual({ id: 'run-1' });
    await expect(controller.runPlan(req, 'plan-1', { dryRun: false })).resolves.toEqual({ id: 'run-1' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'backup.run',
      targetType: 'backup_run',
      targetId: 'plan-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'backup.run',
      targetType: 'backup_run',
      targetId: 'plan-1',
      risk: 'high',
    }));
  });

  it('does not run a backup plan when the write gate rejects', async () => {
    backupService.getPlanAccessScope.mockResolvedValue(scope('env-prod'));
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('backup denied'));

    await expect(controller.runPlan(req, 'plan-1', { dryRun: false })).rejects.toThrow('backup denied');
    expect(backupService.runPlan).not.toHaveBeenCalled();
  });

  it('checks restore dry-run and live restore with different risk levels', async () => {
    backupRestoreService.getRestoreAccessScope.mockResolvedValue(scope('env-prod'));
    backupRestoreService.restoreRun.mockResolvedValue({ id: 'restore-run-1' });
    accessPolicyService.assertCanWrite.mockResolvedValue({ allowed: true });

    await expect(controller.restoreRun(req, 'source-run-1', { dryRun: true })).resolves.toEqual({ id: 'restore-run-1' });
    await expect(controller.restoreRun(req, 'source-run-1', { dryRun: false })).resolves.toEqual({ id: 'restore-run-1' });
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'backup.restore',
      targetType: 'backup_run',
      targetId: 'source-run-1',
      risk: 'medium',
    }));
    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(expect.objectContaining({
      action: 'backup.restore',
      targetType: 'backup_run',
      targetId: 'source-run-1',
      risk: 'high',
    }));
  });

  it('does not restore when the write gate rejects', async () => {
    backupRestoreService.getRestoreAccessScope.mockResolvedValue(scope('env-prod'));
    accessPolicyService.assertCanWrite.mockRejectedValue(new Error('restore denied'));

    await expect(controller.restoreRun(req, 'source-run-1', { dryRun: false })).rejects.toThrow('restore denied');
    expect(backupRestoreService.restoreRun).not.toHaveBeenCalled();
  });
});

function backupRecord(id: string, environmentId: string) {
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
