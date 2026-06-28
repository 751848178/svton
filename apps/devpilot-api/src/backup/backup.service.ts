import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { PrismaService } from '../prisma/prisma.service';
import { ServerExecutionInput, ServerExecutorService } from '../server-executor';
import { ServerCommandStep } from '../server-executor/server-executor.types';
import {
  CreateBackupPlanDto,
  ListBackupPlansQueryDto,
  ListBackupRunsQueryDto,
  RunBackupPlanDto,
  UpdateBackupPlanDto,
} from './dto/backup.dto';

type BackupableResource = {
  id: string;
  teamId: string;
  sourceType: string;
  provider: string;
  kind: string;
  name: string;
  externalId: string;
  status: string;
  endpoint: string | null;
  serverId: string | null;
  projectId: string | null;
  environmentId: string | null;
  credentialId: string | null;
  metadata: Prisma.JsonValue | null;
  config: Prisma.JsonValue | null;
};

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutorService: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
  ) {}

  async listPlans(teamId: string, query: ListBackupPlansQueryDto) {
    const where: Prisma.BackupPlanWhereInput = { teamId };

    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.status) where.status = query.status;

    return this.prisma.backupPlan.findMany({
      where,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: this.backupPlanInclude(),
    });
  }

  async listRuns(teamId: string, query: ListBackupRunsQueryDto) {
    const where: Prisma.BackupRunWhereInput = { teamId };

    if (query.planId) where.planId = query.planId;
    if (query.resourceId) where.resourceId = query.resourceId;
    if (query.status) where.status = query.status;

    return this.prisma.backupRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: this.backupRunInclude(),
    });
  }

  async resolvePlanCreateAccessScope(teamId: string, dto: CreateBackupPlanDto) {
    const resource = await this.getBackupableResource(teamId, dto.resourceId);
    return {
      projectId: resource.projectId,
      environmentId: resource.environmentId,
    };
  }

  async getPlanAccessScope(teamId: string, planId: string) {
    const plan = await this.getBackupPlan(teamId, planId);
    return {
      projectId: plan.projectId,
      environmentId: plan.environmentId,
    };
  }

  async createPlan(teamId: string, userId: string, dto: CreateBackupPlanDto) {
    const resource = await this.getBackupableResource(teamId, dto.resourceId);
    const backupType = dto.backupType || this.defaultBackupType(resource);
    const destinationType = dto.destinationType || 'local';
    const destination = dto.destination || this.defaultDestination(resource, destinationType);

    return this.prisma.backupPlan.create({
      data: {
        teamId,
        createdById: userId,
        projectId: resource.projectId,
        environmentId: resource.environmentId,
        resourceId: resource.id,
        serverId: resource.serverId,
        name: dto.name,
        backupType,
        schedule: dto.schedule,
        retentionDays: dto.retentionDays || 7,
        destinationType,
        destination: this.toJsonValue(destination),
        config: dto.config ? this.toJsonValue(dto.config) : undefined,
        status: 'active',
      },
      include: this.backupPlanInclude(),
    });
  }

  async updatePlan(teamId: string, planId: string, dto: UpdateBackupPlanDto) {
    const plan = await this.getBackupPlan(teamId, planId);
    const data: Prisma.BackupPlanUpdateInput = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.backupType !== undefined) data.backupType = dto.backupType;
    if (dto.schedule !== undefined) data.schedule = dto.schedule;
    if (dto.retentionDays !== undefined) data.retentionDays = dto.retentionDays;
    if (dto.destinationType !== undefined) data.destinationType = dto.destinationType;
    if (dto.destination !== undefined) data.destination = this.toJsonValue(dto.destination);
    if (dto.config !== undefined) data.config = this.toJsonValue(dto.config);
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.backupPlan.update({
      where: { id: plan.id },
      data,
      include: this.backupPlanInclude(),
    });
  }

  async runPlan(teamId: string, userId: string, planId: string, dto: RunBackupPlanDto) {
    const plan = await this.getBackupPlan(teamId, planId);

    if (plan.status === 'archived') {
      throw new BadRequestException('归档的备份计划不能运行');
    }

    const resource = plan.resource;
    const dryRun = dto.dryRun !== false;
    const queue = dto.queue === true && resource.sourceType === 'server';
    const destinationType = this.readString(dto.overrides?.destinationType) || plan.destinationType;
    const destination = this.mergeDestination(plan.destination, dto.overrides);
    const executor = this.resolveExecutor(resource);

    const run = await this.prisma.backupRun.create({
      data: {
        teamId,
        planId: plan.id,
        actorId: userId,
        projectId: plan.projectId,
        environmentId: plan.environmentId,
        resourceId: plan.resourceId,
        serverId: plan.serverId,
        trigger: dto.trigger || 'manual',
        backupType: plan.backupType,
        executorKey: executor.executorKey,
        adapterKey: executor.adapterKey,
        dryRun,
        status: queue ? 'queued' : 'running',
        destinationType,
        destination: this.toJsonValue(destination),
      },
    });

    try {
      if (!dryRun) {
        const blocked = await this.blockLiveRun(run.id, '真实备份执行需要先接入备份审批和恢复策略，本阶段只生成 dry-run 计划。');
        await this.updatePlanLastRun(plan.id, blocked.status);
        await this.writeBackupAudit(teamId, userId, resource, blocked);
        return blocked;
      }

      const completed = resource.sourceType === 'server'
        ? await this.runServerBackup(teamId, userId, plan, run.id, destination, {
            queue,
            maxAttempts: dto.maxAttempts,
          })
        : await this.runCloudBackupPlan(plan, run.id, destination);

      await this.updatePlanLastRun(plan.id, completed.status);
      await this.writeBackupAudit(teamId, userId, resource, completed);
      return completed;
    } catch (error) {
      const failed = await this.prisma.backupRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '备份计划运行失败',
          finishedAt: new Date(),
        },
        include: this.backupRunInclude(),
      });
      await this.updatePlanLastRun(plan.id, failed.status);
      await this.writeBackupAudit(teamId, userId, resource, failed);
      return failed;
    }
  }

  private async runServerBackup(
    teamId: string,
    userId: string,
    plan: Prisma.BackupPlanGetPayload<{ include: ReturnType<BackupService['backupPlanInclude']> }>,
    runId: string,
    destination: Record<string, unknown>,
    options: { queue?: boolean; maxAttempts?: number } = {},
  ) {
    const resource = plan.resource;
    const target = await this.serverExecutorService.resolveTarget(teamId, plan.serverId);
    const warnings = this.collectServerWarnings(resource);
    const executionInput: ServerExecutionInput = {
      teamId,
      userId,
      operationKey: `backup.${resource.provider}.${resource.kind}`,
      adapterKey: 'backup-script-plan',
      dryRun: true,
      target,
      steps: this.buildServerBackupSteps(resource, destination),
      warnings,
      metadata: {
        backupPlanId: plan.id,
        backupRunId: runId,
        businessRunSync: options.queue ? 'backup_run' : undefined,
        resourceId: resource.id,
        resourceName: resource.name,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        destinationType: plan.destinationType,
      },
      blockOnWarnings: true,
      requiredConfirmationText: plan.name,
    };

    const result = options.queue
      ? await this.serverExecutorService.queueExecution(executionInput, {
          maxAttempts: options.maxAttempts,
        })
      : await this.serverExecutorService.execute(executionInput);
    const serverExecutionJobId =
      'serverExecutionJobId' in result && typeof result.serverExecutionJobId === 'string'
        ? result.serverExecutionJobId
        : undefined;
    const updateData: Prisma.BackupRunUncheckedUpdateInput = {
      status: result.status,
      commandPlan: result.commandPlan,
      logs: result.logs,
      result: result.result,
      error: result.error,
      ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
      ...(result.status === 'queued' ? {} : { finishedAt: new Date() }),
    };

    return this.prisma.backupRun.update({
      where: { id: runId },
      data: updateData,
      include: this.backupRunInclude(),
    });
  }

  private async runCloudBackupPlan(
    plan: Prisma.BackupPlanGetPayload<{ include: ReturnType<BackupService['backupPlanInclude']> }>,
    runId: string,
    destination: Record<string, unknown>,
  ) {
    const resource = plan.resource;
    const commandPlan = this.buildCloudBackupCommandPlan(plan, destination);

    return this.prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: 'completed',
        commandPlan,
        logs: this.toJsonValue([
          {
            level: 'info',
            message: '云数据库备份 dry-run 计划已生成。',
          },
        ]),
        result: this.toJsonValue({
          mode: 'dry_run',
          executed: false,
          executorKey: 'cloud-sdk',
          adapterKey: 'cloud-snapshot-plan',
          provider: resource.provider,
          resourceId: resource.id,
          nextExecutorBoundary: 'provider_sdk_snapshot_api',
        }),
        finishedAt: new Date(),
      },
      include: this.backupRunInclude(),
    });
  }

  private async blockLiveRun(runId: string, error: string) {
    return this.prisma.backupRun.update({
      where: { id: runId },
      data: {
        status: 'blocked',
        error,
        result: this.toJsonValue({
          mode: 'blocked_operation_approval_required',
          executed: false,
          nextStep: '接入 BackupRun 审批、恢复演练和真实执行器后再开放 live 备份。',
        }),
        finishedAt: new Date(),
      },
      include: this.backupRunInclude(),
    });
  }

  private backupPlanInclude(): Prisma.BackupPlanInclude {
    return {
      resource: {
        select: {
          id: true,
          name: true,
          sourceType: true,
          provider: true,
          kind: true,
          endpoint: true,
          externalId: true,
          status: true,
          serverId: true,
          projectId: true,
          environmentId: true,
          credentialId: true,
          metadata: true,
          config: true,
          server: { select: { id: true, name: true, host: true, status: true } },
          project: { select: { id: true, name: true } },
          environment: { select: { id: true, key: true, name: true, status: true } },
          credential: { select: { id: true, name: true, type: true } },
        },
      },
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      server: { select: { id: true, name: true, host: true, status: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          status: true,
          dryRun: true,
          trigger: true,
          startedAt: true,
          finishedAt: true,
          error: true,
          serverExecutionJob: {
            select: {
              id: true,
              status: true,
              queueMode: true,
              attempt: true,
              maxAttempts: true,
              queuedAt: true,
              startedAt: true,
              finishedAt: true,
            },
          },
        },
      },
    };
  }

  private backupRunInclude(): Prisma.BackupRunInclude {
    return {
      plan: { select: { id: true, name: true, status: true, schedule: true } },
      resource: {
        select: {
          id: true,
          name: true,
          sourceType: true,
          provider: true,
          kind: true,
          endpoint: true,
          server: { select: { id: true, name: true, host: true } },
          project: { select: { id: true, name: true } },
          environment: { select: { id: true, key: true, name: true, status: true } },
        },
      },
      project: { select: { id: true, name: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      server: { select: { id: true, name: true, host: true } },
      actor: { select: { id: true, name: true, email: true } },
      serverExecutionJob: {
        select: {
          id: true,
          status: true,
          queueMode: true,
          attempt: true,
          maxAttempts: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    };
  }

  private async getBackupPlan(teamId: string, planId: string) {
    const plan = await this.prisma.backupPlan.findFirst({
      where: { id: planId, teamId },
      include: this.backupPlanInclude(),
    });

    if (!plan) {
      throw new NotFoundException('备份计划不存在');
    }

    return plan;
  }

  private async getBackupableResource(teamId: string, resourceId: string) {
    const resource = await this.prisma.managedResource.findFirst({
      where: { id: resourceId, teamId },
      select: {
        id: true,
        teamId: true,
        sourceType: true,
        provider: true,
        kind: true,
        name: true,
        externalId: true,
        status: true,
        endpoint: true,
        serverId: true,
        projectId: true,
        environmentId: true,
        credentialId: true,
        metadata: true,
        config: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('托管资源不存在');
    }

    if (!this.isBackupable(resource)) {
      throw new BadRequestException(
        `当前资源不支持备份计划: ${resource.sourceType}/${resource.provider}/${resource.kind}`,
      );
    }

    if (resource.sourceType === 'server' && !resource.serverId) {
      throw new BadRequestException('服务器资源需要绑定服务器后才能创建备份计划');
    }

    return resource;
  }

  private isBackupable(resource: Pick<BackupableResource, 'sourceType' | 'provider' | 'kind'>) {
    if (resource.sourceType === 'server' && resource.provider === 'docker') {
      return ['mysql', 'redis', 'database'].includes(resource.kind);
    }

    return resource.sourceType === 'cloud'
      && resource.provider === 'aliyun-rds'
      && resource.kind === 'database';
  }

  private resolveExecutor(resource: Pick<BackupableResource, 'sourceType'>) {
    if (resource.sourceType === 'server') {
      return {
        executorKey: 'server-executor',
        adapterKey: 'backup-script-plan',
      };
    }

    return {
      executorKey: 'cloud-sdk',
      adapterKey: 'cloud-snapshot-plan',
    };
  }

  private defaultBackupType(resource: Pick<BackupableResource, 'sourceType' | 'kind'>) {
    if (resource.sourceType === 'cloud') {
      return 'snapshot';
    }
    return resource.kind === 'redis' ? 'file' : 'logical';
  }

  private defaultDestination(
    resource: Pick<BackupableResource, 'sourceType' | 'kind'>,
    destinationType: string,
  ) {
    if (destinationType !== 'local') {
      return { type: destinationType, prefix: `devpilot/${resource.kind}` };
    }

    if (resource.sourceType === 'cloud') {
      return { type: 'provider', snapshotPolicy: 'manual_snapshot_plan' };
    }

    const folder = resource.kind === 'redis' ? 'redis' : 'mysql';
    return { type: 'local', path: `/var/backups/devpilot/${folder}` };
  }

  private buildServerBackupSteps(
    resource: Pick<BackupableResource, 'kind' | 'name' | 'config' | 'metadata'>,
    destination: Record<string, unknown>,
  ): ServerCommandStep[] {
    const containerName = this.resolveContainerName(resource);

    if (resource.kind === 'redis') {
      return [
        {
          key: 'prepare-directory',
          label: '创建 Redis 备份目录',
          command: 'mkdir -p /var/backups/devpilot/redis',
          required: true,
          risk: 'low',
        },
        {
          key: 'redis-bgsave',
          label: '触发 Redis BGSAVE',
          command: `docker exec ${containerName} redis-cli BGSAVE`,
          required: true,
          risk: 'medium',
          timeoutSeconds: 60,
        },
        {
          key: 'copy-dump',
          label: '复制 Redis RDB 文件',
          command: `docker cp ${containerName}:/data/dump.rdb /var/backups/devpilot/redis/dump.rdb`,
          required: true,
          risk: 'medium',
          preview: this.readString(destination.path) || '/var/backups/devpilot/redis',
        },
      ];
    }

    return [
      {
        key: 'prepare-directory',
        label: '创建 MySQL 备份目录',
        command: 'mkdir -p /var/backups/devpilot/mysql',
        required: true,
        risk: 'low',
      },
      {
        key: 'mysqldump',
        label: '导出 MySQL 全库逻辑备份',
        command: `docker exec ${containerName} sh -lc 'mysqldump --single-transaction --all-databases > /tmp/devpilot-backup.sql'`,
        required: true,
        risk: 'medium',
        timeoutSeconds: 300,
      },
      {
        key: 'copy-dump',
        label: '复制 MySQL 备份文件',
        command: `docker cp ${containerName}:/tmp/devpilot-backup.sql /var/backups/devpilot/mysql/devpilot-backup.sql`,
        required: true,
        risk: 'medium',
        preview: this.readString(destination.path) || '/var/backups/devpilot/mysql',
      },
    ];
  }

  private buildCloudBackupCommandPlan(
    plan: Prisma.BackupPlanGetPayload<{ include: ReturnType<BackupService['backupPlanInclude']> }>,
    destination: Record<string, unknown>,
  ): Prisma.InputJsonValue {
    const resource = plan.resource;
    const metadata = this.asRecord(resource.metadata);

    return this.toJsonValue({
      executorKey: 'cloud-sdk',
      adapterKey: 'cloud-snapshot-plan',
      operationKey: `backup.${resource.provider}.${resource.kind}`,
      dryRun: true,
      executable: false,
      target: {
        resourceId: resource.id,
        resourceName: resource.name,
        provider: resource.provider,
        externalId: resource.externalId,
        region: metadata.region || 'default',
        credentialRef: resource.credentialId
          ? { source: 'team_credential', referenceId: resource.credentialId, redacted: true }
          : null,
      },
      safety: {
        commandSource: 'cloud_sdk_adapter',
        liveExecutionDefault: 'blocked',
        secretsInOutput: 'must_mask_before_persisting',
      },
      destination,
      steps: [
        {
          key: 'create-rds-snapshot',
          label: '创建 RDS 快照',
          providerAction: 'CreateBackup',
          required: true,
          risk: 'medium',
        },
        {
          key: 'apply-retention',
          label: '设置保留策略',
          retentionDays: plan.retentionDays,
          required: true,
          risk: 'low',
        },
      ],
    });
  }

  private collectServerWarnings(resource: Pick<BackupableResource, 'serverId' | 'name' | 'config' | 'metadata'>) {
    const warnings: string[] = [];

    if (!resource.serverId) {
      warnings.push('资源未绑定服务器，无法生成服务器执行目标。');
    }
    if (!this.resolveContainerName(resource)) {
      warnings.push('资源缺少 Docker containerName 配置。');
    }

    return warnings;
  }

  private resolveContainerName(resource: Pick<BackupableResource, 'name' | 'config' | 'metadata'>) {
    const config = this.asRecord(resource.config);
    const metadata = this.asRecord(resource.metadata);
    return this.readString(config.containerName)
      || this.readString(metadata.containerName)
      || this.safeDockerName(resource.name);
  }

  private safeDockerName(name: string) {
    const lastSegment = name.split('/').pop()?.trim() || name;
    return lastSegment.replace(/[^a-zA-Z0-9_.:/@-]/g, '-');
  }

  private mergeDestination(
    destination: Prisma.JsonValue | null,
    overrides?: Record<string, unknown>,
  ) {
    const base = this.asRecord(destination);
    const overrideDestination = this.asRecord(overrides?.destination);
    return {
      ...base,
      ...overrideDestination,
    };
  }

  private async updatePlanLastRun(planId: string, status: string) {
    await this.prisma.backupPlan.update({
      where: { id: planId },
      data: {
        lastRunAt: new Date(),
        lastStatus: status,
      },
    });
  }

  private async writeBackupAudit(
    teamId: string,
    userId: string,
    resource: {
      id: string;
      name: string;
      sourceType: string;
      provider: string;
      kind: string;
      endpoint: string | null;
      projectId: string | null;
      environmentId: string | null;
      serverId: string | null;
    },
    run: {
      id: string;
      status: string;
      dryRun: boolean;
      backupType: string;
      executorKey: string;
      adapterKey: string;
      error: string | null;
    },
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      serverId: resource.serverId,
      managedResourceId: resource.id,
      backupRunId: run.id,
      category: 'backup',
      action: 'backup.run',
      targetType: 'backup_run',
      targetId: run.id,
      risk: run.dryRun ? 'low' : 'medium',
      status: run.status,
      summary: `备份计划运行 ${run.status}`,
      metadata: {
        dryRun: run.dryRun,
        backupType: run.backupType,
        sourceType: resource.sourceType,
        provider: resource.provider,
        kind: resource.kind,
        endpoint: resource.endpoint,
        resourceName: resource.name,
        executorKey: run.executorKey,
        adapterKey: run.adapterKey,
        error: run.error,
      },
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private readString(value: unknown) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
