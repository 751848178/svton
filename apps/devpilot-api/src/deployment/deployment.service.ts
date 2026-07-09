import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { CreateOperationApprovalInput, OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { DeploymentRunStatus, assertDeploymentRunTransition } from './deployment-run-status';
import { ServerCommandStep, ServerExecutorService } from '../server-executor';
import {
  CreateDeploymentRunDto,
  ListDeploymentRunsQueryDto,
  RollbackDeploymentRunDto,
  RetryDeploymentRunDto,
  SmokeDeploymentRunDto,
} from './dto/deployment.dto';
import {
  buildCommandSteps,
  buildRollbackCommandSteps,
  buildSmokeCheckCommandSteps,
  collectWarnings,
  collectRollbackWarnings,
  safeGitCommitSha,
  safePositiveInt,
  type DeploymentConfig,
} from './deployment-command-builders.utils';

type ProjectConfigRecord = Record<string, unknown>;

type SmokeFailureAutoRollbackPolicy = {
  enabled: boolean;
  dryRun: boolean;
  queue: boolean;
  maxAttempts?: number;
  approvalId?: string;
  confirmationText?: string;
};

type SmokeFailureAutoRollbackCandidate = {
  id: string;
  teamId: string;
  actorId?: string | null;
  projectId: string;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  params?: Prisma.JsonValue | null;
};

type SmokeFailureAutoRollbackResult = {
  status: 'created' | 'skipped' | 'failed';
  smokeRunId: string;
  rollbackRunId?: string;
  reason?: string;
};

type PostRollbackSmokeCheckPolicy = {
  enabled: boolean;
  dryRun: boolean;
  queue: boolean;
  maxAttempts?: number;
  healthCheckUrl?: string;
};

type PostRollbackSmokeCheckCandidate = {
  id: string;
  teamId: string;
  actorId?: string | null;
  projectId: string;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  healthCheckUrl?: string | null;
  params?: Prisma.JsonValue | null;
};

type PostRollbackSmokeCheckResult = {
  status: 'created' | 'skipped' | 'failed';
  rollbackRunId: string;
  smokeRunId?: string;
  reason?: string;
};

type ApplicationRef = {
  id: string;
  name: string;
};

type ApplicationServiceRef = {
  id: string;
  name: string;
  applicationId: string;
  environmentId: string;
  serverId: string | null;
  deployConfig: Prisma.JsonValue | null;
  application: ApplicationRef;
};

function isRecord(value: unknown): value is ProjectConfigRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

@Injectable()
export class DeploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
    private readonly operationApprovalService: OperationApprovalService,
  ) {}

  async listRuns(teamId: string, query: ListDeploymentRunsQueryDto) {
    const where: Prisma.DeploymentRunWhereInput = { teamId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.applicationId) {
      where.applicationId = query.applicationId;
    }
    if (query.applicationServiceId) {
      where.applicationServiceId = query.applicationServiceId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.source) {
      where.source = query.source;
    }

    return this.prisma.deploymentRun.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: this.runInclude(),
    });
  }

  async resolveRunCreateAccessScope(
    teamId: string,
    projectId: string,
    dto: CreateDeploymentRunDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    let environmentId: string | null = null;
    if (dto.applicationServiceId) {
      const service = await this.prisma.applicationService.findFirst({
        where: { id: dto.applicationServiceId, teamId, projectId },
        select: { id: true, environmentId: true },
      });

      if (!service) {
        throw new BadRequestException('应用服务不存在或不属于当前项目');
      }

      environmentId = service.environmentId;
    }

    if (dto.environmentId?.trim()) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: {
          id: dto.environmentId,
          teamId,
          projectId,
          status: 'active',
        },
        select: { id: true },
      });

      if (!environment) {
        throw new BadRequestException('部署环境不存在或不属于当前项目');
      }

      environmentId = environment.id;
    }

    return {
      projectId: project.id,
      environmentId,
    };
  }

  async getRunAccessScope(teamId: string, runId: string) {
    const run = await this.prisma.deploymentRun.findFirst({
      where: { id: runId, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!run) {
      throw new NotFoundException('部署运行不存在');
    }

    return {
      projectId: run.projectId,
      environmentId: run.environmentId,
    };
  }

  async createRun(
    teamId: string,
    userId: string | undefined,
    projectId: string,
    dto: CreateDeploymentRunDto,
  ) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: {
        id: true,
        teamId: true,
        name: true,
        gitRepo: true,
        config: true,
      },
    });

    if (!project) {
      throw new NotFoundException('项目不存在');
    }

    const config = isRecord(project.config) ? project.config : {};
    const managementScope = this.readManagementScope(config);
    if (managementScope === 'resources') {
      throw new BadRequestException('当前项目未启用构建部署能力');
    }

    const applicationRef = await this.resolveApplication(teamId, project.id, dto.applicationId);
    const applicationServiceRef = await this.resolveApplicationService(
      teamId,
      project.id,
      dto.applicationServiceId,
      applicationRef?.id,
    );
    const deployment = this.resolveDeploymentConfig(
      config,
      applicationServiceRef?.deployConfig,
      dto.overrides,
    );
    const gitRepo = this.readRepository(config, project.gitRepo);
    const branch = dto.branch || this.readBranch(config);
    const environmentRef = await this.resolveProjectEnvironment(
      teamId,
      project.id,
      dto.environmentId || applicationServiceRef?.environmentId,
    );
    const environment = dto.environment || environmentRef?.key || this.readDefaultEnvironment(config);
    const dryRun = dto.dryRun !== false;
    const warnings = collectWarnings(deployment, gitRepo, branch);
    const serverId = dto.serverId || applicationServiceRef?.serverId || undefined;
    const target = await this.serverExecutor.resolveTarget(teamId, serverId);
    const applicationId = applicationServiceRef?.applicationId || applicationRef?.id;
    const queue = dto.queue === true;
    const steps = buildCommandSteps(deployment, gitRepo, branch);
    const requiresApproval = this.requiresDeploymentOperationApproval(dryRun);
    const approvalContext = this.buildDeploymentApprovalContext({
      teamId,
      userId,
      project,
      environmentId: environmentRef?.id,
      environment,
      applicationId,
      applicationName: applicationServiceRef?.application.name || applicationRef?.name,
      applicationServiceId: applicationServiceRef?.id,
      applicationServiceName: applicationServiceRef?.name,
      serverId,
      action: 'deployment.run',
      mode: 'deploy',
      dryRun,
      queue,
      maxAttempts: dto.maxAttempts,
      gitRepo,
      branch,
      commitSha: dto.commitSha,
      targetType: deployment.targetType,
      approvalReason: dto.approvalReason,
      deployment,
      warnings,
    });
    const approvedApproval = requiresApproval
      ? await this.operationApprovalService.resolveApproved({
          ...approvalContext,
          approvalId: dto.approvalId,
        })
      : null;

    const run = await this.prisma.deploymentRun.create({
      data: {
        teamId,
        actorId: userId,
        projectId: project.id,
        serverId,
        environmentId: environmentRef?.id,
        applicationId,
        applicationServiceId: applicationServiceRef?.id,
        operationApprovalId: approvedApproval?.id,
        environment,
        mode: 'deploy',
        source: dto.source || 'manual',
        trigger: dto.trigger || 'manual',
        targetType: deployment.targetType,
        executorKey: 'server-executor',
        adapterKey: 'script-plan',
        dryRun,
        status: queue ? 'queued' : 'running',
        gitRepo,
        branch,
        commitSha: dto.commitSha,
        workingDirectory: deployment.workingDirectory,
        buildCommand: deployment.buildCommand,
        deployCommand: deployment.deployCommand,
        healthCheckUrl: deployment.healthCheckUrl,
        params: this.toJsonValue(dto.overrides || {}),
      },
    });

    if (requiresApproval && !approvedApproval) {
      const approval = await this.operationApprovalService.createPending({
        ...approvalContext,
        reusePending: false,
        metadata: {
          ...(approvalContext.metadata as Record<string, unknown>),
          deploymentRunId: run.id,
        },
      });
      assertDeploymentRunTransition(run.status, DeploymentRunStatus.BLOCKED);
      const blockedRun = await this.prisma.deploymentRun.update({
        where: { id: run.id },
        data: {
          status: DeploymentRunStatus.BLOCKED,
          operationApprovalId: approval.id,
          commandPlan: this.toJsonValue(steps),
          logs: this.toJsonValue([
            {
              level: 'info',
              message: '非 dry-run 的部署执行需要审批，已创建操作审批单',
            },
          ]),
          result: this.toJsonValue({
            mode: 'blocked_operation_approval',
            approvalId: approval.id,
            approvalStatus: approval.status,
          }),
          error: '非 dry-run 的部署执行需要审批',
          finishedAt: new Date(),
        },
        include: this.runInclude(),
      });

      await this.auditEventService.create({
        teamId,
        actorId: userId,
        projectId: project.id,
        environmentId: environmentRef?.id,
        applicationId,
        applicationServiceId: applicationServiceRef?.id,
        serverId,
        deploymentRunId: blockedRun.id,
        operationApprovalId: approval.id,
        category: 'deployment',
        action: 'deployment.run',
        targetType: 'deployment_run',
        targetId: blockedRun.id,
        risk: 'medium',
        status: DeploymentRunStatus.BLOCKED,
        summary: '部署 live 执行等待审批',
        metadata: {
          dryRun,
          source: blockedRun.source,
          trigger: blockedRun.trigger,
          branch: blockedRun.branch,
          commitSha: blockedRun.commitSha,
          targetType: blockedRun.targetType,
          approvalId: approval.id,
        },
      });

      return blockedRun;
    }

    const executionInput = {
      teamId,
      userId,
      operationKey: 'deployment.run',
      adapterKey: 'deployment-script-plan',
      dryRun,
      target,
      steps,
      warnings,
      metadata: {
        deploymentRunId: run.id,
        projectId: project.id,
        projectName: project.name,
        applicationId,
        applicationName: applicationServiceRef?.application.name || applicationRef?.name,
        applicationServiceId: applicationServiceRef?.id,
        applicationServiceName: applicationServiceRef?.name,
        gitRepo,
        branch,
        environment,
        environmentId: environmentRef?.id,
        targetType: deployment.targetType,
        operationApprovalId: approvedApproval?.id,
        businessRunSync: queue ? 'deployment' : undefined,
      },
      blockOnWarnings: true,
      requiredConfirmationText: project.name,
      confirmationText: dto.confirmationText,
    };

    if (queue) {
      const queuedExecution = await this.serverExecutor.queueExecution(executionInput, {
        maxAttempts: dto.maxAttempts,
      });
      assertDeploymentRunTransition(run.status, queuedExecution.status);
      const queuedRun = await this.prisma.deploymentRun.update({
        where: { id: run.id },
        data: {
          status: queuedExecution.status,
          serverExecutionJobId: queuedExecution.serverExecutionJobId,
          commandPlan: queuedExecution.commandPlan,
          logs: queuedExecution.logs,
          result: queuedExecution.result,
          error: queuedExecution.error,
        },
        include: this.runInclude(),
      });

      await this.auditEventService.create({
        teamId,
        actorId: userId,
        projectId: project.id,
        environmentId: environmentRef?.id,
        applicationId,
        applicationServiceId: applicationServiceRef?.id,
        serverId,
        deploymentRunId: queuedRun.id,
        category: 'deployment',
        action: 'deployment.queue',
        targetType: 'deployment_run',
        targetId: queuedRun.id,
        risk: dryRun ? 'low' : 'medium',
        status: queuedRun.status,
        summary: `部署运行已加入队列`,
        metadata: {
          dryRun,
          source: queuedRun.source,
          trigger: queuedRun.trigger,
          branch: queuedRun.branch,
          commitSha: queuedRun.commitSha,
          targetType: queuedRun.targetType,
          applicationName: applicationServiceRef?.application.name || applicationRef?.name,
          applicationServiceName: applicationServiceRef?.name,
          serverExecutionJobId: queuedExecution.serverExecutionJobId,
          operationApprovalId: approvedApproval?.id,
        },
      });

      if (approvedApproval && queuedRun.status !== DeploymentRunStatus.BLOCKED) {
        await this.operationApprovalService.consume(teamId, approvedApproval.id);
      }

      return queuedRun;
    }

    const execution = await this.serverExecutor.execute(executionInput);
    assertDeploymentRunTransition(run.status, execution.status);

    const completedRun = await this.prisma.deploymentRun.update({
      where: { id: run.id },
      data: {
        status: execution.status,
        commandPlan: execution.commandPlan,
        logs: execution.logs,
        result: execution.result,
        error: execution.error,
        finishedAt: new Date(),
      },
      include: this.runInclude(),
    });

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: project.id,
      environmentId: environmentRef?.id,
      applicationId,
      applicationServiceId: applicationServiceRef?.id,
      serverId,
      deploymentRunId: completedRun.id,
      category: 'deployment',
      action: 'deployment.run',
      targetType: 'deployment_run',
      targetId: completedRun.id,
      risk: dryRun ? 'low' : 'medium',
      status: completedRun.status,
      summary: `部署运行 ${completedRun.status}`,
      metadata: {
        dryRun,
        source: completedRun.source,
        trigger: completedRun.trigger,
        branch: completedRun.branch,
        commitSha: completedRun.commitSha,
        targetType: completedRun.targetType,
        applicationName: applicationServiceRef?.application.name || applicationRef?.name,
        applicationServiceName: applicationServiceRef?.name,
        operationApprovalId: approvedApproval?.id,
        error: completedRun.error,
      },
    });

    if (approvedApproval && completedRun.status !== DeploymentRunStatus.BLOCKED) {
      await this.operationApprovalService.consume(teamId, approvedApproval.id);
    }

    return completedRun;
  }

  async rollbackRun(
    teamId: string,
    userId: string | undefined,
    sourceRunId: string,
    dto: RollbackDeploymentRunDto,
  ) {
    const sourceRun = await this.prisma.deploymentRun.findFirst({
      where: { id: sourceRunId, teamId },
      include: {
        project: { select: { id: true, name: true, gitRepo: true, config: true } },
        projectEnvironment: { select: { id: true, key: true, name: true, status: true } },
        application: { select: { id: true, name: true, status: true } },
        applicationService: {
          select: {
            id: true,
            name: true,
            applicationId: true,
            environmentId: true,
            serverId: true,
            deployConfig: true,
            application: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!sourceRun) {
      throw new NotFoundException('部署运行不存在');
    }
    if (sourceRun.mode === 'rollback') {
      throw new BadRequestException('不能基于回滚运行再次发起回滚');
    }
    if (sourceRun.status !== DeploymentRunStatus.COMPLETED) {
      throw new BadRequestException('只能基于已完成的部署运行发起回滚');
    }

    const project = sourceRun.project;
    const config = isRecord(project.config) ? project.config : {};
    const managementScope = this.readManagementScope(config);
    if (managementScope === 'resources') {
      throw new BadRequestException('当前项目未启用构建部署能力');
    }

    const deployment = this.resolveDeploymentConfig(
      config,
      sourceRun.applicationService?.deployConfig,
      dto.overrides,
    );
    const gitRepo = sourceRun.gitRepo || this.readRepository(config, project.gitRepo);
    const branch = sourceRun.branch || this.readBranch(config);
    const environment = sourceRun.environment || sourceRun.projectEnvironment?.key || this.readDefaultEnvironment(config);
    const dryRun = dto.dryRun !== false;
    const queue = dto.queue === true;
    const postRollbackSmokePolicy = this.buildPostRollbackSmokeCheckPolicy(dto);
    const serverId = sourceRun.serverId || sourceRun.applicationService?.serverId || undefined;
    const target = await this.serverExecutor.resolveTarget(teamId, serverId);
    const applicationId = sourceRun.applicationService?.applicationId || sourceRun.applicationId || sourceRun.application?.id;
    const warnings = collectRollbackWarnings(deployment, gitRepo, sourceRun.commitSha);
    const steps = buildRollbackCommandSteps(deployment, gitRepo, sourceRun.commitSha);
    const requiresApproval = this.requiresDeploymentOperationApproval(dryRun);
    const approvalContext = this.buildDeploymentApprovalContext({
      teamId,
      userId,
      project,
      environmentId: sourceRun.environmentId,
      environment,
      applicationId,
      applicationName: sourceRun.applicationService?.application.name || sourceRun.application?.name,
      applicationServiceId: sourceRun.applicationServiceId,
      applicationServiceName: sourceRun.applicationService?.name,
      serverId,
      action: 'deployment.rollback',
      mode: 'rollback',
      dryRun,
      queue,
      maxAttempts: dto.maxAttempts,
      gitRepo,
      branch,
      commitSha: sourceRun.commitSha,
      targetType: deployment.targetType,
      approvalReason: dto.approvalReason,
      sourceRunId: sourceRun.id,
      deployment,
      warnings,
    });
    const approvedApproval = requiresApproval
      ? await this.operationApprovalService.resolveApproved({
          ...approvalContext,
          approvalId: dto.approvalId,
        })
      : null;

    const run = await this.prisma.deploymentRun.create({
      data: {
        teamId,
        actorId: userId,
        projectId: project.id,
        serverId,
        environmentId: sourceRun.environmentId,
        applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverExecutionJobId: undefined,
        operationApprovalId: approvedApproval?.id,
        sourceRunId: sourceRun.id,
        environment,
        mode: 'rollback',
        source: 'manual',
        trigger: 'manual_rollback',
        targetType: deployment.targetType,
        executorKey: 'server-executor',
        adapterKey: 'script-plan',
        dryRun,
        status: queue ? 'queued' : 'running',
        gitRepo,
        branch,
        commitSha: sourceRun.commitSha,
        workingDirectory: deployment.workingDirectory,
        buildCommand: deployment.buildCommand,
        deployCommand: deployment.rollbackCommand || deployment.deployCommand,
        healthCheckUrl: deployment.healthCheckUrl,
        params: this.toJsonValue({
          ...(dto.overrides || {}),
          rollbackSourceRunId: sourceRun.id,
          rollbackTargetCommitSha: sourceRun.commitSha,
          ...(postRollbackSmokePolicy
            ? { postRollbackSmokeCheck: postRollbackSmokePolicy }
            : {}),
        }),
      },
    });

    if (requiresApproval && !approvedApproval) {
      const approval = await this.operationApprovalService.createPending({
        ...approvalContext,
        reusePending: false,
        metadata: {
          ...(approvalContext.metadata as Record<string, unknown>),
          deploymentRunId: run.id,
        },
      });
      assertDeploymentRunTransition(run.status, DeploymentRunStatus.BLOCKED);
      const blockedRun = await this.prisma.deploymentRun.update({
        where: { id: run.id },
        data: {
          status: DeploymentRunStatus.BLOCKED,
          operationApprovalId: approval.id,
          commandPlan: this.toJsonValue(steps),
          logs: this.toJsonValue([
            {
              level: 'info',
              message: '非 dry-run 的部署回滚需要审批，已创建操作审批单',
            },
          ]),
          result: this.toJsonValue({
            mode: 'blocked_operation_approval',
            approvalId: approval.id,
            approvalStatus: approval.status,
            sourceRunId: sourceRun.id,
          }),
          error: '非 dry-run 的部署回滚需要审批',
          finishedAt: new Date(),
        },
        include: this.runInclude(),
      });

      await this.auditEventService.create({
        teamId,
        actorId: userId,
        projectId: project.id,
        environmentId: sourceRun.environmentId,
        applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverId,
        deploymentRunId: blockedRun.id,
        operationApprovalId: approval.id,
        category: 'deployment',
        action: 'deployment.rollback',
        targetType: 'deployment_run',
        targetId: blockedRun.id,
        risk: 'high',
        status: DeploymentRunStatus.BLOCKED,
        summary: '部署 live 回滚等待审批',
        metadata: {
          dryRun,
          sourceRunId: sourceRun.id,
          branch,
          commitSha: sourceRun.commitSha,
          targetType: blockedRun.targetType,
          approvalId: approval.id,
        },
      });

      return blockedRun;
    }

    const executionInput = {
      teamId,
      userId,
      operationKey: 'deployment.rollback',
      adapterKey: 'deployment-script-plan',
      dryRun,
      target,
      steps,
      warnings,
      metadata: {
        deploymentRunId: run.id,
        rollbackSourceRunId: sourceRun.id,
        projectId: project.id,
        projectName: project.name,
        applicationId,
        applicationName: sourceRun.applicationService?.application.name || sourceRun.application?.name,
        applicationServiceId: sourceRun.applicationServiceId,
        applicationServiceName: sourceRun.applicationService?.name,
        gitRepo,
        branch,
        commitSha: sourceRun.commitSha,
        environment,
        environmentId: sourceRun.environmentId,
        targetType: deployment.targetType,
        operationApprovalId: approvedApproval?.id,
        businessRunSync: queue ? 'deployment' : undefined,
      },
      blockOnWarnings: true,
      requiredConfirmationText: project.name,
      confirmationText: dto.confirmationText,
    };

    if (queue) {
      const queuedExecution = await this.serverExecutor.queueExecution(executionInput, {
        maxAttempts: dto.maxAttempts,
      });
      assertDeploymentRunTransition(run.status, queuedExecution.status);
      const queuedRun = await this.prisma.deploymentRun.update({
        where: { id: run.id },
        data: {
          status: queuedExecution.status,
          serverExecutionJobId: queuedExecution.serverExecutionJobId,
          commandPlan: queuedExecution.commandPlan,
          logs: queuedExecution.logs,
          result: queuedExecution.result,
          error: queuedExecution.error,
        },
        include: this.runInclude(),
      });

      await this.auditEventService.create({
        teamId,
        actorId: userId,
        projectId: project.id,
        environmentId: sourceRun.environmentId,
        applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverId,
        deploymentRunId: queuedRun.id,
        category: 'deployment',
        action: 'deployment.rollback.queue',
        targetType: 'deployment_run',
        targetId: queuedRun.id,
        risk: dryRun ? 'low' : 'high',
        status: queuedRun.status,
        summary: `部署回滚已加入队列`,
        metadata: {
          dryRun,
          sourceRunId: sourceRun.id,
          branch,
          commitSha: sourceRun.commitSha,
          targetType: queuedRun.targetType,
          serverExecutionJobId: queuedExecution.serverExecutionJobId,
          operationApprovalId: approvedApproval?.id,
        },
      });

      if (approvedApproval && queuedRun.status !== DeploymentRunStatus.BLOCKED) {
        await this.operationApprovalService.consume(teamId, approvedApproval.id);
      }

      return queuedRun;
    }

    const execution = await this.serverExecutor.execute(executionInput);
    const completedRun = await this.prisma.deploymentRun.update({
      where: { id: run.id },
      data: {
        status: execution.status,
        commandPlan: execution.commandPlan,
        logs: execution.logs,
        result: execution.result,
        error: execution.error,
        finishedAt: new Date(),
      },
      include: this.runInclude(),
    });

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: project.id,
      environmentId: sourceRun.environmentId,
      applicationId,
      applicationServiceId: sourceRun.applicationServiceId,
      serverId,
      deploymentRunId: completedRun.id,
      category: 'deployment',
      action: 'deployment.rollback',
      targetType: 'deployment_run',
      targetId: completedRun.id,
      risk: dryRun ? 'low' : 'high',
      status: completedRun.status,
      summary: `部署回滚 ${completedRun.status}`,
      metadata: {
        dryRun,
        sourceRunId: sourceRun.id,
        branch,
        commitSha: sourceRun.commitSha,
        targetType: completedRun.targetType,
        operationApprovalId: approvedApproval?.id,
        error: completedRun.error,
      },
    });

    if (approvedApproval && completedRun.status !== DeploymentRunStatus.BLOCKED) {
      await this.operationApprovalService.consume(teamId, approvedApproval.id);
    }

    if (!completedRun.dryRun && completedRun.status === DeploymentRunStatus.COMPLETED) {
      await this.createPostRollbackSmokeCheckIfEligible({
        id: completedRun.id,
        teamId,
        actorId: userId,
        projectId: project.id,
        environmentId: sourceRun.environmentId,
        applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverId,
        healthCheckUrl: completedRun.healthCheckUrl,
        params: completedRun.params,
      });
    }

    return completedRun;
  }

  async requestFailureRollback(
    teamId: string,
    userId: string | undefined,
    failedRunId: string,
    dto: RollbackDeploymentRunDto,
  ) {
    const failedRun = await this.prisma.deploymentRun.findFirst({
      where: { id: failedRunId, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        mode: true,
        dryRun: true,
        status: true,
        startedAt: true,
      },
    });

    if (!failedRun) {
      throw new NotFoundException('部署运行不存在');
    }
    if (failedRun.mode === 'rollback') {
      throw new BadRequestException('不能基于回滚运行申请失败回滚');
    }
    if (failedRun.dryRun) {
      throw new BadRequestException('只有 live 部署失败后才能申请失败回滚');
    }
    if (failedRun.status !== DeploymentRunStatus.FAILED) {
      throw new BadRequestException('只有失败的部署运行才能申请失败回滚');
    }

    const sourceRun = await this.prisma.deploymentRun.findFirst({
      where: {
        teamId,
        projectId: failedRun.projectId,
        mode: 'deploy',
        status: DeploymentRunStatus.COMPLETED,
        dryRun: false,
        id: { not: failedRun.id },
        startedAt: { lt: failedRun.startedAt },
        environmentId: failedRun.environmentId,
        applicationId: failedRun.applicationId,
        applicationServiceId: failedRun.applicationServiceId,
        serverId: failedRun.serverId,
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    if (!sourceRun) {
      throw new BadRequestException('没有可用于失败回滚的最近成功 live 部署');
    }

    return this.rollbackRun(teamId, userId, sourceRun.id, {
      ...dto,
      dryRun: false,
      approvalReason:
        dto.approvalReason ||
        `部署 ${failedRun.id.slice(0, 8)} 失败后申请回滚到最近成功版本`,
      overrides: {
        ...(dto.overrides || {}),
        failureRunId: failedRun.id,
      },
    });
  }

  async requestSmokeFailureRollback(
    teamId: string,
    userId: string | undefined,
    smokeRunId: string,
    dto: RollbackDeploymentRunDto,
  ) {
    const smokeRun = await this.prisma.deploymentRun.findFirst({
      where: { id: smokeRunId, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        mode: true,
        dryRun: true,
        status: true,
        healthCheckUrl: true,
        startedAt: true,
        sourceRun: {
          select: {
            id: true,
            projectId: true,
            environmentId: true,
            applicationId: true,
            applicationServiceId: true,
            serverId: true,
            mode: true,
            dryRun: true,
            status: true,
            startedAt: true,
          },
        },
      },
    });

    if (!smokeRun) {
      throw new NotFoundException('部署运行不存在');
    }
    if (smokeRun.mode !== 'smoke_check') {
      throw new BadRequestException('只能基于部署 Smoke 检查运行申请失败回滚');
    }
    if (smokeRun.status !== DeploymentRunStatus.FAILED) {
      throw new BadRequestException('只有失败的部署 Smoke 检查才能申请失败回滚');
    }

    const sourceRun = smokeRun.sourceRun;
    if (!sourceRun) {
      throw new BadRequestException('部署 Smoke 检查缺少来源部署运行');
    }
    if (sourceRun.mode !== 'deploy') {
      throw new BadRequestException('当前只支持部署 Smoke 失败后回滚到上一成功部署');
    }
    if (sourceRun.status !== DeploymentRunStatus.COMPLETED) {
      throw new BadRequestException('部署 Smoke 来源运行尚未完成，不能申请失败回滚');
    }
    if (dto.dryRun === false && (smokeRun.dryRun || sourceRun.dryRun)) {
      throw new BadRequestException('不能基于 dry-run Smoke 或 dry-run 部署直接申请 live 回滚');
    }

    const rollbackSource = await this.prisma.deploymentRun.findFirst({
      where: {
        teamId,
        projectId: sourceRun.projectId,
        mode: 'deploy',
        status: DeploymentRunStatus.COMPLETED,
        dryRun: false,
        id: { not: sourceRun.id },
        startedAt: { lt: sourceRun.startedAt },
        environmentId: sourceRun.environmentId,
        applicationId: sourceRun.applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverId: sourceRun.serverId,
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });

    if (!rollbackSource) {
      throw new BadRequestException('没有可用于 Smoke 失败回滚的上一成功 live 部署');
    }

    return this.rollbackRun(teamId, userId, rollbackSource.id, {
      ...dto,
      dryRun: dto.dryRun !== false,
      approvalReason:
        dto.approvalReason ||
        `部署 Smoke ${smokeRun.id.slice(0, 8)} 失败后申请回滚到上一成功版本`,
      overrides: {
        ...(dto.overrides || {}),
        smokeFailureRunId: smokeRun.id,
        smokeFailureSourceRunId: sourceRun.id,
        smokeFailureHealthCheckUrl: smokeRun.healthCheckUrl,
      },
    });
  }

  async processSmokeFailureAutoRollbacks(input: {
    teamId?: string;
    userId?: string | null;
    limit?: number;
  } = {}) {
    const candidates = await this.prisma.deploymentRun.findMany({
      where: {
        ...(input.teamId ? { teamId: input.teamId } : {}),
        mode: 'smoke_check',
        status: DeploymentRunStatus.FAILED,
        dryRun: false,
      },
      orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
      take: safePositiveInt(input.limit, 20, 100),
      select: {
        id: true,
        teamId: true,
        actorId: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        params: true,
      },
    });

    const summary = {
      scanned: candidates.length,
      attempted: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      results: [] as SmokeFailureAutoRollbackResult[],
    };

    for (const candidate of candidates) {
      const policy = this.readSmokeFailureAutoRollbackPolicy(candidate.params);
      if (!policy.enabled) {
        summary.skipped += 1;
        summary.results.push({
          status: 'skipped',
          smokeRunId: candidate.id,
          reason: 'auto rollback policy disabled',
        });
        continue;
      }

      summary.attempted += 1;
      const result = await this.createSmokeFailureAutoRollbackIfEligible(
        candidate,
        policy,
        input.userId ?? candidate.actorId ?? undefined,
      );
      summary.results.push(result);
      if (result.status === 'created') {
        summary.created += 1;
      } else if (result.status === DeploymentRunStatus.FAILED) {
        summary.failed += 1;
      } else {
        summary.skipped += 1;
      }
    }

    return summary;
  }

  async processPostRollbackSmokeChecks(input: {
    teamId?: string;
    userId?: string | null;
    limit?: number;
  } = {}) {
    const candidates = await this.prisma.deploymentRun.findMany({
      where: {
        ...(input.teamId ? { teamId: input.teamId } : {}),
        mode: 'rollback',
        status: DeploymentRunStatus.COMPLETED,
        dryRun: false,
      },
      orderBy: [{ finishedAt: 'desc' }, { startedAt: 'desc' }],
      take: safePositiveInt(input.limit, 20, 100),
      select: {
        id: true,
        teamId: true,
        actorId: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        healthCheckUrl: true,
        params: true,
      },
    });

    const summary = {
      scanned: candidates.length,
      attempted: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      results: [] as PostRollbackSmokeCheckResult[],
    };

    for (const candidate of candidates) {
      const policy = this.readPostRollbackSmokeCheckPolicy(candidate.params);
      if (!policy.enabled) {
        summary.skipped += 1;
        summary.results.push({
          status: 'skipped',
          rollbackRunId: candidate.id,
          reason: 'post-rollback smoke policy disabled',
        });
        continue;
      }

      summary.attempted += 1;
      const result = await this.createPostRollbackSmokeCheckIfEligible(
        candidate,
        policy,
        input.userId ?? candidate.actorId ?? undefined,
      );
      summary.results.push(result);
      if (result.status === 'created') {
        summary.created += 1;
      } else if (result.status === DeploymentRunStatus.FAILED) {
        summary.failed += 1;
      } else {
        summary.skipped += 1;
      }
    }

    return summary;
  }

  async retryRun(
    teamId: string,
    userId: string | undefined,
    sourceRunId: string,
    dto: RetryDeploymentRunDto,
  ) {
    const sourceRun = await this.prisma.deploymentRun.findFirst({
      where: { id: sourceRunId, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        environment: true,
        mode: true,
        source: true,
        trigger: true,
        targetType: true,
        dryRun: true,
        status: true,
        gitRepo: true,
        branch: true,
        commitSha: true,
        workingDirectory: true,
        buildCommand: true,
        deployCommand: true,
        healthCheckUrl: true,
        params: true,
      },
    });

    if (!sourceRun) {
      throw new NotFoundException('部署运行不存在');
    }
    if ((sourceRun.mode || 'deploy') !== 'deploy') {
      throw new BadRequestException('当前只支持重试部署运行，回滚运行请重新发起回滚');
    }
    if (sourceRun.status !== DeploymentRunStatus.FAILED) {
      throw new BadRequestException('只能重试失败的部署运行');
    }
    if (sourceRun.dryRun && dto.dryRun === false) {
      throw new BadRequestException('不能基于 dry-run 失败直接申请 live 重试');
    }

    const sourceParams = isRecord(sourceRun.params) ? sourceRun.params : {};
    const overrides: Record<string, unknown> = { ...sourceParams };
    if (sourceRun.targetType) {
      overrides.targetType = sourceRun.targetType;
    }
    if (sourceRun.workingDirectory) {
      overrides.workingDirectory = sourceRun.workingDirectory;
    }
    if (sourceRun.buildCommand) {
      overrides.buildCommand = sourceRun.buildCommand;
    }
    if (sourceRun.deployCommand) {
      overrides.deployCommand = sourceRun.deployCommand;
    }
    if (sourceRun.healthCheckUrl) {
      overrides.healthCheckUrl = sourceRun.healthCheckUrl;
    }
    Object.assign(overrides, dto.overrides || {});
    overrides.retrySourceRunId = sourceRun.id;
    overrides.retrySourceStatus = sourceRun.status;
    overrides.retrySourceDryRun = sourceRun.dryRun;
    overrides.retrySourceTrigger = sourceRun.trigger;
    overrides.retrySourceSource = sourceRun.source;

    return this.createRun(teamId, userId, sourceRun.projectId, {
      environment: sourceRun.environment || undefined,
      environmentId: sourceRun.environmentId || undefined,
      applicationId: sourceRun.applicationId || undefined,
      applicationServiceId: sourceRun.applicationServiceId || undefined,
      serverId: sourceRun.serverId || undefined,
      branch: sourceRun.branch || undefined,
      commitSha: sourceRun.commitSha || undefined,
      source: 'manual',
      trigger: 'manual_retry',
      dryRun: dto.dryRun !== false,
      queue: dto.queue,
      maxAttempts: dto.maxAttempts,
      overrides,
      confirmationText: dto.confirmationText,
      approvalId: dto.approvalId,
      approvalReason:
        dto.approvalReason ||
        `重试失败部署 ${sourceRun.id.slice(0, 8)}`,
    });
  }

  async smokeCheckRun(
    teamId: string,
    userId: string | undefined,
    sourceRunId: string,
    dto: SmokeDeploymentRunDto,
  ) {
    const sourceRun = await this.prisma.deploymentRun.findFirst({
      where: { id: sourceRunId, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        environment: true,
        mode: true,
        source: true,
        trigger: true,
        targetType: true,
        dryRun: true,
        status: true,
        gitRepo: true,
        branch: true,
        commitSha: true,
        healthCheckUrl: true,
        project: { select: { id: true, name: true } },
      },
    });

    if (!sourceRun) {
      throw new NotFoundException('部署运行不存在');
    }
    if (sourceRun.mode === 'smoke_check') {
      throw new BadRequestException('不能基于 Smoke 检查运行再次发起 Smoke 检查');
    }
    if (sourceRun.status !== DeploymentRunStatus.COMPLETED) {
      throw new BadRequestException('只能基于已完成的部署运行发起 Smoke 检查');
    }

    const healthCheckUrl = this.readHealthCheckUrl(dto.healthCheckUrl || sourceRun.healthCheckUrl);
    if (!healthCheckUrl) {
      throw new BadRequestException('当前部署运行缺少健康检查 URL，无法生成 Smoke 检查');
    }

    const dryRun = dto.dryRun !== false;
    const queue = dto.queue === true;
    const target = await this.serverExecutor.resolveTarget(teamId, sourceRun.serverId);
    const steps = buildSmokeCheckCommandSteps(healthCheckUrl);
    const autoRollbackPolicy = this.buildSmokeFailureAutoRollbackPolicy(dto);
    const run = await this.prisma.deploymentRun.create({
      data: {
        teamId,
        actorId: userId,
        projectId: sourceRun.projectId,
        serverId: sourceRun.serverId,
        environmentId: sourceRun.environmentId,
        applicationId: sourceRun.applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        sourceRunId: sourceRun.id,
        environment: sourceRun.environment,
        mode: 'smoke_check',
        source: 'manual',
        trigger: 'manual_smoke_check',
        targetType: sourceRun.targetType,
        executorKey: 'server-executor',
        adapterKey: 'script-plan',
        dryRun,
        status: queue ? 'queued' : 'running',
        gitRepo: sourceRun.gitRepo,
        branch: sourceRun.branch,
        commitSha: sourceRun.commitSha,
        healthCheckUrl,
        params: this.toJsonValue({
          smokeSourceRunId: sourceRun.id,
          smokeSourceMode: sourceRun.mode,
          smokeSourceDryRun: sourceRun.dryRun,
          smokeSourceSource: sourceRun.source,
          smokeSourceTrigger: sourceRun.trigger,
          ...(autoRollbackPolicy ? { autoRollback: autoRollbackPolicy } : {}),
        }),
      },
    });

    const executionInput = {
      teamId,
      userId,
      operationKey: 'deployment.smoke_check',
      adapterKey: 'deployment-script-plan',
      dryRun,
      target,
      steps,
      metadata: {
        deploymentRunId: run.id,
        smokeSourceRunId: sourceRun.id,
        projectId: sourceRun.projectId,
        projectName: sourceRun.project.name,
        applicationId: sourceRun.applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        environment: sourceRun.environment,
        environmentId: sourceRun.environmentId,
        targetType: sourceRun.targetType,
        healthCheckUrl,
        businessRunSync: queue ? 'deployment' : undefined,
      },
      blockOnWarnings: true,
    };

    if (queue) {
      const queuedExecution = await this.serverExecutor.queueExecution(executionInput, {
        maxAttempts: dto.maxAttempts,
      });
      assertDeploymentRunTransition(run.status, queuedExecution.status);
      const queuedRun = await this.prisma.deploymentRun.update({
        where: { id: run.id },
        data: {
          status: queuedExecution.status,
          serverExecutionJobId: queuedExecution.serverExecutionJobId,
          commandPlan: queuedExecution.commandPlan,
          logs: queuedExecution.logs,
          result: queuedExecution.result,
          error: queuedExecution.error,
        },
        include: this.runInclude(),
      });

      await this.auditEventService.create({
        teamId,
        actorId: userId,
        projectId: sourceRun.projectId,
        environmentId: sourceRun.environmentId,
        applicationId: sourceRun.applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverId: sourceRun.serverId,
        deploymentRunId: queuedRun.id,
        category: 'deployment',
        action: 'deployment.smoke_check.queue',
        targetType: 'deployment_run',
        targetId: queuedRun.id,
        risk: 'low',
        status: queuedRun.status,
        summary: '部署 Smoke 检查已加入队列',
        metadata: {
          dryRun,
          sourceRunId: sourceRun.id,
          healthCheckUrl,
          serverExecutionJobId: queuedExecution.serverExecutionJobId,
        },
      });

      return queuedRun;
    }

    const execution = await this.serverExecutor.execute(executionInput);
    const completedRun = await this.prisma.deploymentRun.update({
      where: { id: run.id },
      data: {
        status: execution.status,
        commandPlan: execution.commandPlan,
        logs: execution.logs,
        result: execution.result,
        error: execution.error,
        finishedAt: new Date(),
      },
      include: this.runInclude(),
    });

    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: sourceRun.projectId,
      environmentId: sourceRun.environmentId,
      applicationId: sourceRun.applicationId,
      applicationServiceId: sourceRun.applicationServiceId,
      serverId: sourceRun.serverId,
      deploymentRunId: completedRun.id,
      category: 'deployment',
      action: 'deployment.smoke_check',
      targetType: 'deployment_run',
      targetId: completedRun.id,
      risk: 'low',
      status: completedRun.status,
      summary: `部署 Smoke 检查 ${completedRun.status}`,
      metadata: {
        dryRun,
        sourceRunId: sourceRun.id,
        healthCheckUrl,
        error: completedRun.error,
      },
    });

    if (completedRun.status === DeploymentRunStatus.FAILED) {
      await this.createSmokeFailureAutoRollbackIfEligible({
        id: completedRun.id,
        teamId,
        actorId: userId,
        projectId: sourceRun.projectId,
        environmentId: sourceRun.environmentId,
        applicationId: sourceRun.applicationId,
        applicationServiceId: sourceRun.applicationServiceId,
        serverId: sourceRun.serverId,
        params: completedRun.params,
      });
    }

    return completedRun;
  }

  private async createSmokeFailureAutoRollbackIfEligible(
    candidate: SmokeFailureAutoRollbackCandidate,
    policy = this.readSmokeFailureAutoRollbackPolicy(candidate.params),
    userId: string | undefined = candidate.actorId ?? undefined,
  ): Promise<SmokeFailureAutoRollbackResult> {
    if (!policy.enabled) {
      return {
        status: 'skipped',
        smokeRunId: candidate.id,
        reason: 'auto rollback policy disabled',
      };
    }

    const existingRun = await this.findExistingSmokeFailureAutoRollbackRun(
      candidate.teamId,
      candidate.id,
    );
    if (existingRun) {
      return {
        status: 'skipped',
        smokeRunId: candidate.id,
        rollbackRunId: existingRun.id,
        reason: 'auto rollback already created',
      };
    }

    try {
      const preauthorizedLiveRollback = !policy.dryRun && !!policy.approvalId;
      const rollbackDto: RollbackDeploymentRunDto = {
        dryRun: policy.dryRun,
        queue: policy.queue,
        maxAttempts: policy.maxAttempts,
        approvalReason: policy.dryRun
          ? `部署 Smoke ${candidate.id.slice(0, 8)} 失败后自动生成回滚计划`
          : preauthorizedLiveRollback
            ? `部署 Smoke ${candidate.id.slice(0, 8)} 失败后按预授权执行 live 回滚`
            : `部署 Smoke ${candidate.id.slice(0, 8)} 失败后自动申请 live 回滚`,
        overrides: {
          autoRollback: true,
          autoRollbackSourceSmokeRunId: candidate.id,
          autoRollbackPolicy: {
            dryRun: policy.dryRun,
            queue: policy.queue,
            maxAttempts: policy.maxAttempts,
            ...(preauthorizedLiveRollback ? {
              approvalId: policy.approvalId,
              ...(policy.confirmationText ? { confirmationText: policy.confirmationText } : {}),
            } : {}),
          },
        },
      };
      if (preauthorizedLiveRollback) {
        rollbackDto.approvalId = policy.approvalId;
        if (policy.confirmationText) {
          rollbackDto.confirmationText = policy.confirmationText;
        }
      }

      const rollbackRun = await this.requestSmokeFailureRollback(
        candidate.teamId,
        userId,
        candidate.id,
        rollbackDto,
      ) as { id?: string; status?: string };

      await this.auditEventService.create({
        teamId: candidate.teamId,
        actorId: userId,
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        applicationId: candidate.applicationId,
        applicationServiceId: candidate.applicationServiceId,
        serverId: candidate.serverId,
        deploymentRunId: candidate.id,
        category: 'deployment',
        action: 'deployment.smoke_failure_auto_rollback',
        targetType: 'deployment_run',
        targetId: candidate.id,
        risk: policy.dryRun ? 'medium' : 'high',
        status: rollbackRun.status || 'created',
        summary: policy.dryRun
          ? '部署 Smoke 失败后已自动生成回滚计划'
          : preauthorizedLiveRollback
            ? '部署 Smoke 失败后已按预授权提交 live 回滚'
            : '部署 Smoke 失败后已自动提交 live 回滚申请',
        metadata: {
          rollbackRunId: rollbackRun.id,
          dryRun: policy.dryRun,
          queue: policy.queue,
          maxAttempts: policy.maxAttempts,
          ...(preauthorizedLiveRollback ? {
            preauthorized: true,
            approvalId: policy.approvalId,
          } : {
            preauthorized: false,
          }),
        },
      });

      return {
        status: 'created',
        smokeRunId: candidate.id,
        rollbackRunId: rollbackRun.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '自动回滚处理失败';
      await this.auditEventService.create({
        teamId: candidate.teamId,
        actorId: userId,
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        applicationId: candidate.applicationId,
        applicationServiceId: candidate.applicationServiceId,
        serverId: candidate.serverId,
        deploymentRunId: candidate.id,
        category: 'deployment',
        action: 'deployment.smoke_failure_auto_rollback',
        targetType: 'deployment_run',
        targetId: candidate.id,
        risk: policy.dryRun ? 'medium' : 'high',
        status: DeploymentRunStatus.FAILED,
        summary: '部署 Smoke 失败自动回滚处理失败',
        metadata: {
          dryRun: policy.dryRun,
          queue: policy.queue,
          maxAttempts: policy.maxAttempts,
          error: message,
        },
      });

      return {
        status: DeploymentRunStatus.FAILED,
        smokeRunId: candidate.id,
        reason: message,
      };
    }
  }

  private async findExistingSmokeFailureAutoRollbackRun(teamId: string, smokeRunId: string) {
    const rollbackRuns = await this.prisma.deploymentRun.findMany({
      where: {
        teamId,
        mode: 'rollback',
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        params: true,
      },
    });

    return rollbackRuns.find((run) => {
      const params = isRecord(run.params) ? run.params : {};
      return params.autoRollbackSourceSmokeRunId === smokeRunId;
    });
  }

  private buildSmokeFailureAutoRollbackPolicy(
    dto: SmokeDeploymentRunDto,
  ): SmokeFailureAutoRollbackPolicy | undefined {
    if (dto.autoRollbackOnFailure !== true) {
      return undefined;
    }

    const policy: SmokeFailureAutoRollbackPolicy = {
      enabled: true,
      dryRun: dto.autoRollbackDryRun !== false,
      queue: dto.autoRollbackQueue !== false,
      maxAttempts: safePositiveInt(dto.autoRollbackMaxAttempts, 1, 10),
    };

    const approvalId = readString(dto.autoRollbackApprovalId)?.trim();
    const confirmationText = readString(dto.autoRollbackConfirmationText)?.trim();
    if (approvalId) policy.approvalId = approvalId;
    if (confirmationText) policy.confirmationText = confirmationText;
    return policy;
  }

  private readSmokeFailureAutoRollbackPolicy(params?: Prisma.JsonValue | null): SmokeFailureAutoRollbackPolicy {
    const record = isRecord(params) ? params : {};
    const raw = isRecord(record.autoRollback) ? record.autoRollback : {};
    const policy: SmokeFailureAutoRollbackPolicy = {
      enabled: raw.enabled === true,
      dryRun: raw.dryRun !== false,
      queue: raw.queue !== false,
      maxAttempts: safePositiveInt(raw.maxAttempts, 1, 10),
    };

    const approvalId = readString(raw.approvalId)?.trim();
    const confirmationText = readString(raw.confirmationText)?.trim();
    if (approvalId) policy.approvalId = approvalId;
    if (confirmationText) policy.confirmationText = confirmationText;
    return policy;
  }

  private async createPostRollbackSmokeCheckIfEligible(
    candidate: PostRollbackSmokeCheckCandidate,
    policy = this.readPostRollbackSmokeCheckPolicy(candidate.params),
    userId: string | undefined = candidate.actorId ?? undefined,
  ): Promise<PostRollbackSmokeCheckResult> {
    if (!policy.enabled) {
      return {
        status: 'skipped',
        rollbackRunId: candidate.id,
        reason: 'post-rollback smoke policy disabled',
      };
    }

    const existingRun = await this.findExistingPostRollbackSmokeCheckRun(
      candidate.teamId,
      candidate.id,
    );
    if (existingRun) {
      return {
        status: 'skipped',
        rollbackRunId: candidate.id,
        smokeRunId: existingRun.id,
        reason: 'post-rollback smoke already created',
      };
    }

    try {
      const smokeRun = await this.smokeCheckRun(candidate.teamId, userId, candidate.id, {
        dryRun: policy.dryRun,
        queue: policy.queue,
        maxAttempts: policy.maxAttempts,
        healthCheckUrl: policy.healthCheckUrl || candidate.healthCheckUrl || undefined,
      }) as { id?: string; status?: string };

      await this.auditEventService.create({
        teamId: candidate.teamId,
        actorId: userId,
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        applicationId: candidate.applicationId,
        applicationServiceId: candidate.applicationServiceId,
        serverId: candidate.serverId,
        deploymentRunId: candidate.id,
        category: 'deployment',
        action: 'deployment.post_rollback_smoke_check',
        targetType: 'deployment_run',
        targetId: candidate.id,
        risk: 'low',
        status: smokeRun.status || 'created',
        summary: '部署回滚完成后已自动生成 Smoke 检查',
        metadata: {
          smokeRunId: smokeRun.id,
          dryRun: policy.dryRun,
          queue: policy.queue,
          maxAttempts: policy.maxAttempts,
          healthCheckUrl: policy.healthCheckUrl || candidate.healthCheckUrl,
        },
      });

      return {
        status: 'created',
        rollbackRunId: candidate.id,
        smokeRunId: smokeRun.id,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '回滚后 Smoke 检查处理失败';
      await this.auditEventService.create({
        teamId: candidate.teamId,
        actorId: userId,
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        applicationId: candidate.applicationId,
        applicationServiceId: candidate.applicationServiceId,
        serverId: candidate.serverId,
        deploymentRunId: candidate.id,
        category: 'deployment',
        action: 'deployment.post_rollback_smoke_check',
        targetType: 'deployment_run',
        targetId: candidate.id,
        risk: 'low',
        status: DeploymentRunStatus.FAILED,
        summary: '部署回滚完成后自动 Smoke 检查处理失败',
        metadata: {
          dryRun: policy.dryRun,
          queue: policy.queue,
          maxAttempts: policy.maxAttempts,
          healthCheckUrl: policy.healthCheckUrl || candidate.healthCheckUrl,
          error: message,
        },
      });

      return {
        status: DeploymentRunStatus.FAILED,
        rollbackRunId: candidate.id,
        reason: message,
      };
    }
  }

  private async findExistingPostRollbackSmokeCheckRun(teamId: string, rollbackRunId: string) {
    return this.prisma.deploymentRun.findFirst({
      where: {
        teamId,
        mode: 'smoke_check',
        sourceRunId: rollbackRunId,
      },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
  }

  private buildPostRollbackSmokeCheckPolicy(
    dto: RollbackDeploymentRunDto,
  ): PostRollbackSmokeCheckPolicy | undefined {
    if (dto.postRollbackSmokeCheck !== true) {
      return undefined;
    }

    const healthCheckUrl = this.readHealthCheckUrl(dto.postRollbackSmokeHealthCheckUrl);

    return {
      enabled: true,
      dryRun: dto.postRollbackSmokeDryRun !== false,
      queue: dto.postRollbackSmokeQueue !== false,
      maxAttempts: safePositiveInt(dto.postRollbackSmokeMaxAttempts, 1, 10),
      ...(healthCheckUrl ? { healthCheckUrl } : {}),
    };
  }

  private readPostRollbackSmokeCheckPolicy(params?: Prisma.JsonValue | null): PostRollbackSmokeCheckPolicy {
    const record = isRecord(params) ? params : {};
    const raw = isRecord(record.postRollbackSmokeCheck) ? record.postRollbackSmokeCheck : {};
    const healthCheckUrl = this.readHealthCheckUrl(readString(raw.healthCheckUrl));

    return {
      enabled: raw.enabled === true,
      dryRun: raw.dryRun !== false,
      queue: raw.queue !== false,
      maxAttempts: safePositiveInt(raw.maxAttempts, 1, 10),
      ...(healthCheckUrl ? { healthCheckUrl } : {}),
    };
  }

  private runInclude() {
    return {
      project: { select: { id: true, name: true } },
      projectEnvironment: { select: { id: true, key: true, name: true, status: true } },
      application: { select: { id: true, name: true, status: true } },
      applicationService: {
        select: {
          id: true,
          name: true,
          kind: true,
          runtime: true,
          status: true,
          environment: { select: { id: true, key: true, name: true, status: true } },
        },
      },
      actor: { select: { id: true, name: true, email: true } },
      server: { select: { id: true, name: true, host: true } },
      operationApproval: { select: { id: true, status: true, risk: true, reviewedAt: true, consumedAt: true } },
      sourceRun: { select: { id: true, mode: true, status: true, branch: true, commitSha: true, startedAt: true } },
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

  private buildDeploymentApprovalContext(input: {
    teamId: string;
    userId?: string;
    project: { id: string; name: string };
    environmentId?: string | null;
    environment?: string | null;
    applicationId?: string | null;
    applicationName?: string | null;
    applicationServiceId?: string | null;
    applicationServiceName?: string | null;
    serverId?: string | null;
    action: 'deployment.run' | 'deployment.rollback';
    mode: 'deploy' | 'rollback';
    dryRun: boolean;
    queue: boolean;
    maxAttempts?: number;
    gitRepo?: string | null;
    branch?: string | null;
    commitSha?: string | null;
    targetType: string;
    approvalReason?: string;
    sourceRunId?: string | null;
    deployment: DeploymentConfig;
    warnings: string[];
  }): CreateOperationApprovalInput {
    const label = input.action === 'deployment.rollback' ? '部署回滚' : '部署执行';

    return {
      teamId: input.teamId,
      requesterId: input.userId,
      projectId: input.project.id,
      environmentId: input.environmentId,
      applicationId: input.applicationId,
      applicationServiceId: input.applicationServiceId,
      serverId: input.serverId,
      category: 'deployment',
      action: input.action,
      targetType: 'project',
      targetId: input.project.id,
      risk: this.deploymentOperationRisk(input.action),
      summary: `申请执行${label} ${input.project.name}`,
      reason: input.approvalReason || `申请执行非 dry-run ${label}`,
      metadata: {
        projectName: input.project.name,
        mode: input.mode,
        dryRun: input.dryRun,
        queue: input.queue,
        maxAttempts: input.maxAttempts,
        environment: input.environment,
        environmentId: input.environmentId,
        applicationId: input.applicationId,
        applicationName: input.applicationName,
        applicationServiceId: input.applicationServiceId,
        applicationServiceName: input.applicationServiceName,
        serverId: input.serverId,
        sourceRunId: input.sourceRunId,
        gitRepo: input.gitRepo,
        branch: input.branch,
        commitSha: input.commitSha,
        targetType: input.targetType,
        workingDirectory: input.deployment.workingDirectory,
        buildCommandConfigured: Boolean(input.deployment.buildCommand),
        deployCommandConfigured: Boolean(input.deployment.deployCommand),
        rollbackCommandConfigured: Boolean(input.deployment.rollbackCommand),
        healthCheckUrl: input.deployment.healthCheckUrl,
        warnings: input.warnings,
      },
    };
  }

  private requiresDeploymentOperationApproval(dryRun: boolean) {
    return !dryRun;
  }

  private deploymentOperationRisk(action: 'deployment.run' | 'deployment.rollback') {
    return action === 'deployment.rollback' ? 'high' : 'medium';
  }

  private readManagementScope(config: ProjectConfigRecord) {
    const onboarding = isRecord(config.onboarding) ? config.onboarding : undefined;
    const rawScope = config.managementScope ?? onboarding?.scope;

    if (rawScope === 'full' || rawScope === 'deployment' || rawScope === 'resources') {
      return rawScope;
    }

    return config.origin === 'external' ? 'resources' : 'full';
  }

  private async resolveProjectEnvironment(
    teamId: string,
    projectId: string,
    environmentId?: string,
  ) {
    if (!environmentId) {
      return null;
    }

    const environment = await this.prisma.projectEnvironment.findFirst({
      where: {
        id: environmentId,
        teamId,
        projectId,
        status: 'active',
      },
      select: { id: true, key: true, name: true },
    });

    if (!environment) {
      throw new BadRequestException('项目环境不存在或不属于当前项目');
    }

    return environment;
  }

  private async resolveApplication(
    teamId: string,
    projectId: string,
    applicationId?: string,
  ): Promise<ApplicationRef | null> {
    if (!applicationId) {
      return null;
    }

    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, teamId, projectId, status: { not: 'archived' } },
      select: { id: true, name: true },
    });

    if (!application) {
      throw new BadRequestException('应用不存在或不属于当前项目');
    }

    return application;
  }

  private async resolveApplicationService(
    teamId: string,
    projectId: string,
    serviceId?: string,
    applicationId?: string,
  ): Promise<ApplicationServiceRef | null> {
    if (!serviceId) {
      return null;
    }

    const service = await this.prisma.applicationService.findFirst({
      where: {
        id: serviceId,
        teamId,
        projectId,
        status: { not: 'archived' },
      },
      select: {
        id: true,
        name: true,
        applicationId: true,
        environmentId: true,
        serverId: true,
        deployConfig: true,
        application: { select: { id: true, name: true } },
      },
    });

    if (!service) {
      throw new BadRequestException('应用服务不存在或不属于当前项目');
    }

    if (applicationId && service.applicationId !== applicationId) {
      throw new BadRequestException('应用服务不属于所选应用');
    }

    return service;
  }

  private resolveDeploymentConfig(
    config: ProjectConfigRecord,
    serviceConfigValue?: unknown,
    overrides?: Record<string, unknown>,
  ): DeploymentConfig {
    const deployment = isRecord(config.deployment) ? config.deployment : {};
    const serviceConfig = isRecord(serviceConfigValue) ? serviceConfigValue : {};
    const stackProfile = isRecord(config.stackProfile) ? config.stackProfile : {};
    const next = isRecord(overrides) ? overrides : {};

    return {
      targetType:
        readString(next.targetType) ??
        readString(serviceConfig.targetType) ??
        readString(deployment.targetType) ??
        'server',
      workingDirectory:
        readString(next.workingDirectory) ??
        readString(serviceConfig.workingDirectory) ??
        readString(deployment.workingDirectory),
      buildCommand:
        readString(next.buildCommand) ??
        readString(serviceConfig.buildCommand) ??
        readString(deployment.buildCommand) ??
        readString(stackProfile.buildCommand),
      deployCommand:
        readString(next.deployCommand) ??
        readString(serviceConfig.deployCommand) ??
        readString(deployment.deployCommand) ??
        readString(stackProfile.deployCommand),
      rollbackCommand:
        readString(next.rollbackCommand) ??
        readString(serviceConfig.rollbackCommand) ??
        readString(deployment.rollbackCommand) ??
        readString(stackProfile.rollbackCommand),
      healthCheckUrl:
        readString(next.healthCheckUrl) ??
        readString(serviceConfig.healthCheckUrl) ??
        readString(deployment.healthCheckUrl),
    };
  }

  private readRepository(config: ProjectConfigRecord, fallback?: string | null) {
    const source = isRecord(config.source) ? config.source : undefined;
    return readString(fallback) ?? readString(source?.repository);
  }

  private readBranch(config: ProjectConfigRecord) {
    const source = isRecord(config.source) ? config.source : undefined;
    return readString(source?.branch);
  }

  private readDefaultEnvironment(config: ProjectConfigRecord) {
    return readStringArray(config.environments)[0];
  }

  private readHealthCheckUrl(value?: string | null) {
    const raw = readString(value);
    if (!raw) {
      return undefined;
    }

    try {
      const url = new URL(raw);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('invalid protocol');
      }
      return url.toString();
    } catch {
      throw new BadRequestException('健康检查 URL 必须是 http(s) 地址');
    }
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
