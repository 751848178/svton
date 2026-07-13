import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutorService } from '../server-executor';
import { ServerCommandStep, ServerExecutionInput } from '../server-executor/server-executor.types';
import { RestoreBackupRunDto } from './dto/backup.dto';

type RestoreSourceRun = Prisma.BackupRunGetPayload<{ include: ReturnType<BackupRestoreService['sourceRunInclude']> }>;

@Injectable()
export class BackupRestoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
  ) {}

  async getRestoreAccessScope(teamId: string, runId: string) {
    const source = await this.getSourceRun(teamId, runId);
    return { projectId: source.projectId, environmentId: source.environmentId };
  }

  async restoreRun(teamId: string, userId: string, runId: string, dto: RestoreBackupRunDto) {
    const source = await this.getSourceRun(teamId, runId);
    if (source.status !== 'completed') {
      throw new BadRequestException('只能从已完成的备份运行创建恢复计划');
    }

    const dryRun = dto.dryRun !== false;
    const run = await this.createRestoreRun(teamId, userId, source, dto, dryRun);
    const restored = dryRun
      ? await this.planRestore(teamId, userId, source, run.id, dto)
      : await this.blockLiveRestore(run.id);
    await this.writeRestoreAudit(teamId, userId, source, restored, dto);
    return restored;
  }

  private async createRestoreRun(teamId: string, userId: string, source: RestoreSourceRun, dto: RestoreBackupRunDto, dryRun: boolean) {
    return this.prisma.backupRun.create({
      data: {
        teamId,
        planId: source.planId,
        actorId: userId,
        projectId: source.projectId,
        environmentId: dto.targetEnvironmentId || source.environmentId,
        resourceId: dto.targetResourceId || source.resourceId,
        serverId: dto.targetServerId || source.serverId,
        trigger: dto.trigger || 'manual',
        backupType: source.backupType,
        executorKey: source.resource.sourceType === 'server' ? 'server-executor' : 'cloud-sdk',
        adapterKey: source.resource.sourceType === 'server' ? 'restore-script-plan' : 'cloud-restore-plan',
        dryRun,
        status: 'running',
        destinationType: 'restore-target',
        destination: this.toJsonValue(this.restoreMetadata(source, dto)),
      },
    });
  }

  private async planRestore(teamId: string, userId: string, source: RestoreSourceRun, runId: string, dto: RestoreBackupRunDto) {
    if (source.resource.sourceType !== 'server') {
      return this.completeCloudRestorePlan(source, runId, dto);
    }

    const target = await this.serverExecutor.resolveTarget(teamId, dto.targetServerId || source.serverId);
    const input: ServerExecutionInput = {
      teamId,
      userId,
      operationKey: `restore.${source.resource.provider}.${source.resource.kind}`,
      adapterKey: 'restore-script-plan',
      dryRun: true,
      target,
      steps: this.buildServerRestoreSteps(source, dto),
      metadata: this.restoreMetadata(source, dto, runId),
      blockOnWarnings: true,
      requiredConfirmationText: source.plan?.name || source.resource.name,
      confirmationText: dto.confirmationText,
    };
    const result = await this.serverExecutor.execute(input);
    return this.prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: result.status,
        commandPlan: result.commandPlan,
        logs: result.logs,
        result: result.result,
        error: result.error,
        finishedAt: new Date(),
      },
      include: this.sourceRunInclude(),
    });
  }

  private completeCloudRestorePlan(source: RestoreSourceRun, runId: string, dto: RestoreBackupRunDto) {
    return this.prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        commandPlan: this.toJsonValue({
          adapterKey: 'cloud-restore-plan',
          sourceBackupRunId: source.id,
          provider: source.resource.provider,
          externalId: source.resource.externalId,
          validationQuery: dto.validationQuery || 'provider snapshot restore validation',
        }),
        result: this.toJsonValue({ mode: 'restore_dry_run_plan', executed: false }),
        finishedAt: new Date(),
      },
      include: this.sourceRunInclude(),
    });
  }

  private blockLiveRestore(runId: string) {
    return this.prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: 'blocked',
        error: '真实恢复执行需要先接入恢复审批、目标隔离和回滚验证策略。',
        result: this.toJsonValue({ mode: 'blocked_restore_live_execution', executed: false }),
        finishedAt: new Date(),
      },
      include: this.sourceRunInclude(),
    });
  }

  private buildServerRestoreSteps(source: RestoreSourceRun, dto: RestoreBackupRunDto): ServerCommandStep[] {
    const container = this.resolveContainerName(source.resource);
    const validation = JSON.stringify(dto.validationQuery || (source.resource.kind === 'redis' ? 'redis-cli PING' : 'mysql --execute="SELECT 1"'));
    const folder = source.resource.kind === 'redis' ? 'redis/dump.rdb' : 'mysql/devpilot-backup.sql';
    return [
      { key: 'verify-source-backup', label: '校验源备份文件存在', command: `test -f /var/backups/devpilot/${folder}`, required: true, risk: 'low' },
      { key: 'stage-restore-artifact', label: '暂存恢复候选文件', command: `docker cp /var/backups/devpilot/${folder} ${container}:/tmp/devpilot-restore-candidate`, required: true, risk: 'medium' },
      { key: 'validate-target', label: '验证恢复目标可查询', command: `docker exec ${container} sh -lc ${validation}`, required: true, risk: 'medium' },
    ];
  }

  private async getSourceRun(teamId: string, runId: string) {
    const run = await this.prisma.backupRun.findFirst({
      where: { id: runId, teamId },
      include: this.sourceRunInclude(),
    });
    if (!run) throw new NotFoundException('备份运行不存在');
    return run;
  }

  private async writeRestoreAudit(teamId: string, userId: string, source: RestoreSourceRun, run: RestoreSourceRun, dto: RestoreBackupRunDto) {
    await this.auditEventService.create({
      teamId, actorId: userId, projectId: run.projectId, environmentId: run.environmentId,
      serverId: run.serverId, managedResourceId: run.resourceId, backupRunId: run.id,
      category: 'backup', action: 'backup.restore', targetType: 'backup_run',
      targetId: run.id, risk: run.dryRun ? 'medium' : 'high', status: run.status,
      summary: `备份恢复计划 ${run.status}`,
      metadata: { sourceBackupRunId: source.id, validationQuery: dto.validationQuery, rollbackPlan: dto.rollbackPlan, error: run.error },
    });
  }

  private restoreMetadata(source: RestoreSourceRun, dto: RestoreBackupRunDto, restoreRunId?: string) {
    return { sourceBackupRunId: source.id, restoreRunId, targetEnvironmentId: dto.targetEnvironmentId || source.environmentId,
      targetResourceId: dto.targetResourceId || source.resourceId, validationQuery: dto.validationQuery || null, rollbackPlan: dto.rollbackPlan || null };
  }

  private sourceRunInclude() {
    return { plan: { select: { id: true, name: true } }, resource: true } satisfies Prisma.BackupRunInclude;
  }

  private resolveContainerName(resource: { name: string; config: Prisma.JsonValue | null; metadata: Prisma.JsonValue | null }) {
    const config = this.asRecord(resource.config);
    const metadata = this.asRecord(resource.metadata);
    return this.readString(config.containerName) || this.readString(metadata.containerName) || resource.name;
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
