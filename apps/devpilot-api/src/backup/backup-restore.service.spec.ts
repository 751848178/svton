import { BadRequestException } from '@nestjs/common';
import { BackupRestoreService } from './backup-restore.service';

describe('BackupRestoreService', () => {
  let prisma: {
    backupRun: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let serverExecutor: {
    resolveTarget: jest.Mock;
    execute: jest.Mock;
  };
  let auditEventService: { create: jest.Mock };
  let service: BackupRestoreService;

  beforeEach(() => {
    prisma = {
      backupRun: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    serverExecutor = {
      resolveTarget: jest.fn(),
      execute: jest.fn(),
    };
    auditEventService = { create: jest.fn() };
    service = new BackupRestoreService(prisma as any, serverExecutor as any, auditEventService as any);
  });

  it('creates a cloud restore dry-run plan from a completed backup run', async () => {
    prisma.backupRun.findFirst.mockResolvedValue(sourceRun({ sourceType: 'cloud', provider: 'aliyun-rds' }));
    prisma.backupRun.create.mockResolvedValue({ id: 'restore-run-1' });
    prisma.backupRun.update.mockResolvedValue({ ...sourceRun({ id: 'restore-run-1', dryRun: true }), status: 'completed' });

    await expect(service.restoreRun('team-1', 'user-1', 'backup-run-1', {
      validationQuery: 'SELECT 1',
      rollbackPlan: { owner: 'dba' },
    })).resolves.toMatchObject({ id: 'restore-run-1', status: 'completed' });

    expect(prisma.backupRun.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        adapterKey: 'cloud-restore-plan',
        destinationType: 'restore-target',
        dryRun: true,
      }),
    }));
    expect(prisma.backupRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'completed',
        commandPlan: expect.objectContaining({
          sourceBackupRunId: 'backup-run-1',
          validationQuery: 'SELECT 1',
        }),
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({
      action: 'backup.restore',
      risk: 'medium',
      metadata: expect.objectContaining({ sourceBackupRunId: 'backup-run-1' }),
    }));
  });

  it('blocks live restore execution until approval and isolation strategy exist', async () => {
    prisma.backupRun.findFirst.mockResolvedValue(sourceRun());
    prisma.backupRun.create.mockResolvedValue({ id: 'restore-run-1' });
    prisma.backupRun.update.mockResolvedValue({ ...sourceRun({ id: 'restore-run-1', dryRun: false }), status: 'blocked' });

    await expect(service.restoreRun('team-1', 'user-1', 'backup-run-1', { dryRun: false })).resolves.toMatchObject({
      id: 'restore-run-1',
      status: 'blocked',
    });
    expect(serverExecutor.execute).not.toHaveBeenCalled();
    expect(prisma.backupRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'blocked',
        result: expect.objectContaining({ mode: 'blocked_restore_live_execution' }),
      }),
    }));
    expect(auditEventService.create).toHaveBeenCalledWith(expect.objectContaining({ risk: 'high' }));
  });

  it('rejects restore plans from unfinished backup runs', async () => {
    prisma.backupRun.findFirst.mockResolvedValue(sourceRun({ status: 'failed' }));

    await expect(service.restoreRun('team-1', 'user-1', 'backup-run-1', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.backupRun.create).not.toHaveBeenCalled();
  });
});

function sourceRun(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id || 'backup-run-1',
    teamId: 'team-1',
    planId: 'plan-1',
    actorId: 'user-1',
    projectId: 'project-1',
    environmentId: 'env-prod',
    resourceId: 'resource-1',
    serverId: 'server-1',
    backupType: 'snapshot',
    dryRun: overrides.dryRun ?? true,
    status: overrides.status || 'completed',
    error: null,
    plan: { id: 'plan-1', name: 'Production backup' },
    resource: {
      id: 'resource-1',
      name: 'production-db',
      sourceType: overrides.sourceType || 'server',
      provider: overrides.provider || 'docker',
      kind: 'database',
      externalId: 'db-1',
      config: { containerName: 'mysql-prod' },
      metadata: {},
    },
  };
}
