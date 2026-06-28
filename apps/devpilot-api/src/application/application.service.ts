import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditEventService } from '../audit-event';
import { OperationApprovalService } from '../operation-approval';
import { PrismaService } from '../prisma/prisma.service';
import { ServerCommandStep, ServerExecutionInput, ServerExecutorService } from '../server-executor';
import {
  CreateApplicationDto,
  CreateApplicationServiceDto,
  ExecuteApplicationServiceOperationDto,
  ListApplicationsQueryDto,
  UpdateApplicationDto,
  UpdateApplicationServiceDto,
} from './dto/application.dto';

type ApplicationRef = {
  id: string;
  projectId: string;
};

type EnvironmentRef = {
  id: string;
  projectId: string;
};

type ApplicationServiceOperationTarget = {
  id: string;
  teamId: string;
  projectId: string;
  applicationId: string;
  environmentId: string;
  serverId: string | null;
  name: string;
  kind: string;
  runtime: string | null;
  image: string | null;
  deployConfig: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  application: { id: string; name: string };
  environment: { id: string; key: string; name: string };
  server: { id: string; name: string; host: string } | null;
  site: { id: string; name: string; primaryDomain: string } | null;
  managedResource: { id: string; name: string; provider: string; kind: string; endpoint: string | null } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly serverExecutor: ServerExecutorService,
    private readonly auditEventService: AuditEventService,
    private readonly operationApprovalService: OperationApprovalService,
  ) {}

  async list(teamId: string, query: ListApplicationsQueryDto) {
    const where: Prisma.ApplicationWhereInput = { teamId };

    if (query.projectId) {
      where.projectId = query.projectId;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.environmentId) {
      where.services = { some: { environmentId: query.environmentId } };
    }

    return this.prisma.application.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: this.applicationInclude(),
    });
  }

  async create(teamId: string, userId: string, dto: CreateApplicationDto) {
    await this.assertProject(teamId, dto.projectId);

    return this.prisma.application.create({
      data: {
        teamId,
        projectId: dto.projectId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        repositoryUrl: dto.repositoryUrl,
        repoPath: dto.repoPath,
        defaultBranch: dto.defaultBranch,
        config: dto.config ? this.toJsonValue(dto.config) : undefined,
      },
      include: this.applicationInclude(),
    });
  }

  async findOne(teamId: string, id: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, teamId },
      include: this.applicationInclude(),
    });

    if (!application) {
      throw new NotFoundException('应用不存在');
    }

    return application;
  }

  async getApplicationAccessScope(teamId: string, id: string) {
    const application = await this.getApplicationRef(teamId, id);
    return {
      projectId: application.projectId,
      environmentId: null,
    };
  }

  async resolveServiceCreateAccessScope(teamId: string, applicationId: string, environmentId: string) {
    const application = await this.getApplicationRef(teamId, applicationId);
    const environment = await this.resolveEnvironment(teamId, application.projectId, environmentId);
    return {
      projectId: application.projectId,
      environmentId: environment.id,
    };
  }

  async getServiceAccessScope(teamId: string, applicationId: string, serviceId: string) {
    await this.getApplicationRef(teamId, applicationId);
    const service = await this.prisma.applicationService.findFirst({
      where: { id: serviceId, teamId, applicationId },
      select: { id: true, projectId: true, environmentId: true },
    });

    if (!service) {
      throw new NotFoundException('应用服务不存在');
    }

    return {
      projectId: service.projectId,
      environmentId: service.environmentId,
    };
  }

  async update(teamId: string, id: string, dto: UpdateApplicationDto) {
    await this.getApplicationRef(teamId, id);

    return this.prisma.application.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        repositoryUrl: dto.repositoryUrl,
        repoPath: dto.repoPath,
        defaultBranch: dto.defaultBranch,
        status: dto.status,
        config: dto.config !== undefined ? this.toJsonValue(dto.config) : undefined,
      },
      include: this.applicationInclude(),
    });
  }

  async archive(teamId: string, id: string) {
    await this.getApplicationRef(teamId, id);

    return this.prisma.application.update({
      where: { id },
      data: { status: 'archived' },
      include: this.applicationInclude(),
    });
  }

  async createService(
    teamId: string,
    applicationId: string,
    dto: CreateApplicationServiceDto,
  ) {
    const application = await this.getApplicationRef(teamId, applicationId);
    const environment = await this.resolveEnvironment(teamId, application.projectId, dto.environmentId);
    await this.assertOptionalBindings(teamId, application.projectId, environment.id, dto);

    if (dto.serverId) {
      await this.bindServerToEnvironment(teamId, application.projectId, environment.id, dto.serverId);
    }

    return this.prisma.applicationService.create({
      data: {
        teamId,
        projectId: application.projectId,
        applicationId: application.id,
        environmentId: environment.id,
        serverId: dto.serverId,
        siteId: dto.siteId,
        managedResourceId: dto.managedResourceId,
        name: dto.name,
        kind: dto.kind || 'docker-compose',
        runtime: dto.runtime,
        image: dto.image,
        ports: dto.ports ? this.toJsonValue(dto.ports) : undefined,
        env: dto.env ? this.toJsonValue(dto.env) : undefined,
        secretKeyIds: dto.secretKeyIds ? this.toJsonValue(dto.secretKeyIds) : undefined,
        deployConfig: dto.deployConfig ? this.toJsonValue(dto.deployConfig) : undefined,
        metadata: dto.metadata ? this.toJsonValue(dto.metadata) : undefined,
      },
      include: this.serviceInclude(),
    });
  }

  async updateService(
    teamId: string,
    applicationId: string,
    serviceId: string,
    dto: UpdateApplicationServiceDto,
  ) {
    const application = await this.getApplicationRef(teamId, applicationId);
    const existing = await this.prisma.applicationService.findFirst({
      where: { id: serviceId, teamId, applicationId },
      select: { id: true, environmentId: true },
    });

    if (!existing) {
      throw new NotFoundException('应用服务不存在');
    }

    const environment = dto.environmentId
      ? await this.resolveEnvironment(teamId, application.projectId, dto.environmentId)
      : await this.resolveEnvironment(teamId, application.projectId, existing.environmentId);

    await this.assertOptionalBindings(teamId, application.projectId, environment.id, dto);

    if (dto.serverId) {
      await this.bindServerToEnvironment(teamId, application.projectId, environment.id, dto.serverId);
    }

    return this.prisma.applicationService.update({
      where: { id: existing.id },
      data: {
        environmentId: dto.environmentId,
        serverId: dto.serverId,
        siteId: dto.siteId,
        managedResourceId: dto.managedResourceId,
        name: dto.name,
        kind: dto.kind,
        runtime: dto.runtime,
        image: dto.image,
        ports: dto.ports !== undefined ? this.toJsonValue(dto.ports) : undefined,
        env: dto.env !== undefined ? this.toJsonValue(dto.env) : undefined,
        secretKeyIds: dto.secretKeyIds !== undefined ? this.toJsonValue(dto.secretKeyIds) : undefined,
        deployConfig: dto.deployConfig !== undefined ? this.toJsonValue(dto.deployConfig) : undefined,
        status: dto.status,
        metadata: dto.metadata !== undefined ? this.toJsonValue(dto.metadata) : undefined,
      },
      include: this.serviceInclude(),
    });
  }

  async archiveService(teamId: string, applicationId: string, serviceId: string) {
    await this.getApplicationRef(teamId, applicationId);
    const existing = await this.prisma.applicationService.findFirst({
      where: { id: serviceId, teamId, applicationId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('应用服务不存在');
    }

    return this.prisma.applicationService.update({
      where: { id: existing.id },
      data: { status: 'archived' },
      include: this.serviceInclude(),
    });
  }

  async listServiceOperations(teamId: string, applicationId: string, serviceId: string) {
    await this.getServiceOperationTarget(teamId, applicationId, serviceId);

    return this.prisma.applicationServiceOperationRun.findMany({
      where: { teamId, applicationId, applicationServiceId: serviceId },
      orderBy: { startedAt: 'desc' },
      take: 20,
      include: this.operationRunInclude(),
    });
  }

  async executeServiceOperation(
    teamId: string,
    userId: string,
    applicationId: string,
    serviceId: string,
    dto: ExecuteApplicationServiceOperationDto,
  ) {
    const service = await this.getServiceOperationTarget(teamId, applicationId, serviceId);
    const params = dto.params || {};
    const dryRun = dto.dryRun !== false;
    const queue = dto.queue === true;
    const risk = this.operationRisk(dto.action);
    const approvalContext = this.buildServiceOperationApprovalContext(
      teamId,
      userId,
      service,
      dto.action,
      risk,
      dto.approvalReason,
    );
    const requiresApproval = this.requiresServiceOperationApproval(risk, dryRun);
    const approvedApproval = requiresApproval
      ? await this.operationApprovalService.resolveApproved({
          ...approvalContext,
          approvalId: dto.approvalId,
        })
      : null;
    const target = await this.serverExecutor.resolveTarget(teamId, service.serverId);
    const warnings = this.collectOperationWarnings(service, dto.action);
    const steps = this.buildOperationSteps(service, dto.action, params);
    const operationRun = await this.prisma.applicationServiceOperationRun.create({
      data: {
        teamId,
        projectId: service.projectId,
        applicationId: service.applicationId,
        applicationServiceId: service.id,
        environmentId: service.environmentId,
        serverId: service.serverId,
        actorId: userId,
        action: dto.action,
        executorKey: 'server-executor',
        adapterKey: 'application-service-runtime-plan',
        dryRun,
        risk,
        status: queue ? 'queued' : 'running',
        operationApprovalId: approvedApproval?.id,
        params: this.toJsonValue(params),
      },
    });

    try {
      if (requiresApproval && !approvedApproval) {
        const approval = await this.operationApprovalService.createPending({
          ...approvalContext,
          metadata: {
            ...approvalContext.metadata,
            operationRunId: operationRun.id,
            params,
            queue,
            maxAttempts: dto.maxAttempts,
          },
        });
        const blocked = await this.prisma.applicationServiceOperationRun.update({
          where: { id: operationRun.id },
          data: {
            status: 'blocked',
            operationApprovalId: approval.id,
            error: '非 dry-run 的中高风险服务操作需要审批',
            finishedAt: new Date(),
            result: this.toJsonValue({
              mode: 'blocked_operation_approval',
              approvalId: approval.id,
              approvalStatus: approval.status,
            }),
          },
          include: this.operationRunInclude(),
        });
        await this.writeServiceOperationAudit(teamId, userId, service, blocked);
        return blocked;
      }

      const executionInput: ServerExecutionInput = {
        teamId,
        userId,
        operationKey: `application-service.${dto.action}`,
        adapterKey: 'application-service-runtime-plan',
        dryRun,
        target,
        steps,
        warnings,
        metadata: {
          operationRunId: operationRun.id,
          applicationServiceOperationRunId: operationRun.id,
          operationApprovalId: approvedApproval?.id,
          businessRunSync: queue ? 'service_operation' : undefined,
          projectId: service.projectId,
          applicationId: service.applicationId,
          applicationName: service.application.name,
          applicationServiceId: service.id,
          applicationServiceName: service.name,
          environmentId: service.environmentId,
          environmentKey: service.environment.key,
          action: dto.action,
        },
        blockOnWarnings: true,
        requiredConfirmationText: service.name,
        confirmationText: dto.confirmationText,
      };

      const execution = queue
        ? await this.serverExecutor.queueExecution(executionInput, { maxAttempts: dto.maxAttempts })
        : await this.serverExecutor.execute(executionInput);
      const serverExecutionJobId =
        'serverExecutionJobId' in execution && typeof execution.serverExecutionJobId === 'string'
          ? execution.serverExecutionJobId
          : undefined;
      const completedData: Prisma.ApplicationServiceOperationRunUncheckedUpdateInput = {
        status: execution.status,
        commandPlan: execution.commandPlan,
        logs: execution.logs,
        result: execution.result,
        error: execution.error,
        ...(serverExecutionJobId ? { serverExecutionJobId } : {}),
        ...(execution.status === 'queued' ? {} : { finishedAt: new Date() }),
      };

      const completed = await this.prisma.applicationServiceOperationRun.update({
        where: { id: operationRun.id },
        data: completedData,
        include: this.operationRunInclude(),
      });
      await this.writeServiceOperationAudit(teamId, userId, service, completed);
      if (approvedApproval && completed.status !== 'blocked') {
        await this.operationApprovalService.consume(teamId, approvedApproval.id);
      }
      return completed;
    } catch (error) {
      const failed = await this.prisma.applicationServiceOperationRun.update({
        where: { id: operationRun.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : '服务操作执行失败',
          finishedAt: new Date(),
        },
        include: this.operationRunInclude(),
      });
      await this.writeServiceOperationAudit(teamId, userId, service, failed);
      return failed;
    }
  }

  private applicationInclude(): Prisma.ApplicationInclude {
    return {
      project: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      services: {
        where: { status: { not: 'archived' } },
        orderBy: [{ environmentId: 'asc' }, { name: 'asc' }],
        include: this.serviceInclude(),
      },
      _count: {
        select: {
          services: true,
          deploymentRuns: true,
          operationRuns: true,
        },
      },
    };
  }

  private serviceInclude(): Prisma.ApplicationServiceInclude {
    return {
      environment: { select: { id: true, key: true, name: true, status: true } },
      server: { select: { id: true, name: true, host: true, status: true } },
      site: { select: { id: true, name: true, primaryDomain: true, status: true } },
      managedResource: {
        select: { id: true, name: true, provider: true, kind: true, status: true, endpoint: true },
      },
      operationRuns: {
        orderBy: { startedAt: 'desc' },
        take: 3,
        include: this.operationRunInclude(),
      },
      _count: {
        select: {
          deploymentRuns: true,
          operationRuns: true,
        },
      },
    };
  }

  private operationRunInclude(): Prisma.ApplicationServiceOperationRunInclude {
    return {
      actor: { select: { id: true, name: true, email: true } },
      environment: { select: { id: true, key: true, name: true, status: true } },
      server: { select: { id: true, name: true, host: true, status: true } },
      application: { select: { id: true, name: true } },
      applicationService: { select: { id: true, name: true, kind: true, runtime: true } },
      operationApproval: { select: { id: true, status: true, risk: true, reviewedAt: true, consumedAt: true } },
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

  private requiresServiceOperationApproval(risk: string, dryRun: boolean) {
    return !dryRun && risk !== 'low';
  }

  private buildServiceOperationApprovalContext(
    teamId: string,
    userId: string,
    service: ApplicationServiceOperationTarget,
    action: ExecuteApplicationServiceOperationDto['action'],
    risk: string,
    reason?: string,
  ) {
    return {
      teamId,
      requesterId: userId,
      projectId: service.projectId,
      environmentId: service.environmentId,
      applicationId: service.applicationId,
      applicationServiceId: service.id,
      serverId: service.serverId,
      siteId: service.site?.id,
      managedResourceId: service.managedResource?.id,
      category: 'service_operation',
      action: `application-service.${action}`,
      targetType: 'application_service',
      targetId: service.id,
      risk,
      summary: `申请执行服务操作 ${action}`,
      reason: reason || '申请执行非 dry-run 服务操作',
      metadata: {
        serviceName: service.name,
        serviceKind: service.kind,
        applicationName: service.application.name,
        environmentKey: service.environment.key,
        serverName: service.server?.name,
        siteDomain: service.site?.primaryDomain,
        managedResourceName: service.managedResource?.name,
      },
    };
  }

  private async writeServiceOperationAudit(
    teamId: string,
    userId: string,
    service: ApplicationServiceOperationTarget,
    operationRun: {
      id: string;
      action: string;
      risk: string;
      status: string;
      dryRun: boolean;
      executorKey: string;
      adapterKey: string;
      operationApprovalId?: string | null;
      error: string | null;
    },
  ) {
    await this.auditEventService.create({
      teamId,
      actorId: userId,
      projectId: service.projectId,
      environmentId: service.environmentId,
      applicationId: service.applicationId,
      applicationServiceId: service.id,
      serverId: service.serverId,
      siteId: service.site?.id,
      managedResourceId: service.managedResource?.id,
      applicationServiceOperationRunId: operationRun.id,
      operationApprovalId: operationRun.operationApprovalId,
      category: 'service_operation',
      action: `application-service.${operationRun.action}`,
      targetType: 'application_service',
      targetId: service.id,
      risk: operationRun.risk,
      status: operationRun.status,
      summary: `服务操作 ${operationRun.action} ${operationRun.status}`,
      metadata: {
        dryRun: operationRun.dryRun,
        serviceName: service.name,
        serviceKind: service.kind,
        applicationName: service.application.name,
        environmentKey: service.environment.key,
        serverName: service.server?.name,
        siteDomain: service.site?.primaryDomain,
        managedResourceName: service.managedResource?.name,
        executorKey: operationRun.executorKey,
        adapterKey: operationRun.adapterKey,
        operationApprovalId: operationRun.operationApprovalId,
        error: operationRun.error,
      },
    });
  }

  private async getApplicationRef(teamId: string, id: string): Promise<ApplicationRef> {
    const application = await this.prisma.application.findFirst({
      where: { id, teamId },
      select: { id: true, projectId: true },
    });

    if (!application) {
      throw new NotFoundException('应用不存在');
    }

    return application;
  }

  private async assertProject(teamId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('项目不存在或不属于当前团队');
    }

    return project;
  }

  private async resolveEnvironment(
    teamId: string,
    projectId: string,
    environmentId: string,
  ): Promise<EnvironmentRef> {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId, projectId, status: 'active' },
      select: { id: true, projectId: true },
    });

    if (!environment) {
      throw new BadRequestException('项目环境不存在或不属于当前应用项目');
    }

    return environment;
  }

  private async assertOptionalBindings(
    teamId: string,
    projectId: string,
    environmentId: string,
    dto: Partial<CreateApplicationServiceDto & UpdateApplicationServiceDto>,
  ) {
    if (dto.serverId) {
      const server = await this.prisma.server.findFirst({
        where: { id: dto.serverId, teamId },
        select: { id: true },
      });
      if (!server) {
        throw new BadRequestException('服务器不存在或不属于当前团队');
      }
    }

    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, teamId },
        select: { id: true, projectId: true, environmentId: true },
      });
      if (!site) {
        throw new BadRequestException('站点不存在或不属于当前团队');
      }
      if (site.projectId && site.projectId !== projectId) {
        throw new BadRequestException('站点不属于当前应用项目');
      }
      if (site.environmentId && site.environmentId !== environmentId) {
        throw new BadRequestException('站点不属于当前服务环境');
      }
    }

    if (dto.managedResourceId) {
      const resource = await this.prisma.managedResource.findFirst({
        where: { id: dto.managedResourceId, teamId },
        select: { id: true, projectId: true, environmentId: true },
      });
      if (!resource) {
        throw new BadRequestException('托管资源不存在或不属于当前团队');
      }
      if (resource.projectId && resource.projectId !== projectId) {
        throw new BadRequestException('托管资源不属于当前应用项目');
      }
      if (resource.environmentId && resource.environmentId !== environmentId) {
        throw new BadRequestException('托管资源不属于当前服务环境');
      }
    }
  }

  private async getServiceOperationTarget(
    teamId: string,
    applicationId: string,
    serviceId: string,
  ): Promise<ApplicationServiceOperationTarget> {
    const service = await this.prisma.applicationService.findFirst({
      where: { id: serviceId, teamId, applicationId, status: { not: 'archived' } },
      select: {
        id: true,
        teamId: true,
        projectId: true,
        applicationId: true,
        environmentId: true,
        serverId: true,
        name: true,
        kind: true,
        runtime: true,
        image: true,
        deployConfig: true,
        metadata: true,
        application: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true } },
        server: { select: { id: true, name: true, host: true } },
        site: { select: { id: true, name: true, primaryDomain: true } },
        managedResource: {
          select: { id: true, name: true, provider: true, kind: true, endpoint: true },
        },
      },
    });

    if (!service) {
      throw new NotFoundException('应用服务不存在');
    }

    return service;
  }

  private operationRisk(action: ExecuteApplicationServiceOperationDto['action']) {
    if (action === 'restart') return 'medium';
    if (action === 'rollback') return 'high';
    return 'low';
  }

  private collectOperationWarnings(
    service: ApplicationServiceOperationTarget,
    action: ExecuteApplicationServiceOperationDto['action'],
  ) {
    const warnings: string[] = [];
    const deployConfig = this.asRecord(service.deployConfig);

    if (!service.serverId && action !== 'status') {
      warnings.push('服务未绑定服务器，无法生成服务器侧运行态操作命令。');
    }
    if (!service.serverId && action === 'status' && !readString(deployConfig.healthCheckUrl)) {
      warnings.push('服务未绑定服务器且未配置 healthCheckUrl，只能生成不完整状态检查计划。');
    }
    if (action === 'rollback' && !readString(deployConfig.rollbackCommand)) {
      warnings.push('服务未配置 rollbackCommand，回滚只能生成阻塞计划。');
    }

    return warnings;
  }

  private buildOperationSteps(
    service: ApplicationServiceOperationTarget,
    action: ExecuteApplicationServiceOperationDto['action'],
    params: Record<string, unknown>,
  ): ServerCommandStep[] {
    const deployConfig = this.asRecord(service.deployConfig);
    const workingDirectory = readString(deployConfig.workingDirectory) || '';
    const serviceName = this.shellQuote(readString(params.serviceName) || service.name);
    const containerName = this.shellQuote(
      readString(params.containerName) ||
      readString(this.asRecord(service.metadata).containerName) ||
      service.name,
    );
    const tail = readString(params.tail) || '200';
    const healthCheckUrl = readString(params.healthCheckUrl) || readString(deployConfig.healthCheckUrl);

    if (action === 'status') {
      return [
        {
          key: 'health-check',
          label: '健康检查',
          command: healthCheckUrl ? `curl -fsS ${this.shellQuote(healthCheckUrl)}` : '',
          cwd: workingDirectory,
          required: false,
          risk: 'low',
        },
        this.serviceCommandStep(
          service,
          'runtime-status',
          '运行状态',
          {
            compose: `docker compose ps ${serviceName}`,
            container: `docker ps --filter name=${containerName} --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"`,
            fallback: `docker ps --filter name=${containerName} --format "table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}"`,
          },
          workingDirectory,
          Boolean(service.serverId),
          'low',
        ),
      ];
    }

    if (action === 'logs') {
      return [
        this.serviceCommandStep(
          service,
          'tail-logs',
          '查看日志',
          {
            compose: `docker compose logs --tail=${this.shellQuote(tail)} ${serviceName}`,
            container: `docker logs --tail=${this.shellQuote(tail)} ${containerName}`,
            fallback: `docker logs --tail=${this.shellQuote(tail)} ${containerName}`,
          },
          workingDirectory,
          true,
          'low',
        ),
      ];
    }

    if (action === 'restart') {
      return [
        this.serviceCommandStep(
          service,
          'restart',
          '重启服务',
          {
            compose: `docker compose restart ${serviceName}`,
            container: `docker restart ${containerName}`,
            fallback: `docker restart ${containerName}`,
          },
          workingDirectory,
          true,
          'medium',
        ),
        {
          key: 'post-restart-health-check',
          label: '重启后健康检查',
          command: healthCheckUrl ? `curl -fsS ${this.shellQuote(healthCheckUrl)}` : '',
          cwd: workingDirectory,
          required: false,
          risk: 'low',
        },
      ];
    }

    return [
      {
        key: 'rollback',
        label: '回滚服务',
        command: readString(params.rollbackCommand) || readString(deployConfig.rollbackCommand) || '',
        cwd: workingDirectory,
        required: true,
        risk: 'high',
        preview: '回滚命令必须由服务 deployConfig.rollbackCommand 或本次参数提供。',
      },
      {
        key: 'post-rollback-health-check',
        label: '回滚后健康检查',
        command: healthCheckUrl ? `curl -fsS ${this.shellQuote(healthCheckUrl)}` : '',
        cwd: workingDirectory,
        required: false,
        risk: 'low',
      },
    ];
  }

  private serviceCommandStep(
    service: ApplicationServiceOperationTarget,
    key: string,
    label: string,
    commands: { compose: string; container: string; fallback: string },
    cwd: string,
    required: boolean,
    risk: 'low' | 'medium' | 'high',
  ): ServerCommandStep {
    const command = service.kind === 'docker-compose'
      ? commands.compose
      : service.kind === 'container'
        ? commands.container
        : commands.fallback;

    return {
      key,
      label,
      command: service.serverId ? command : '',
      cwd,
      required,
      risk,
    };
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return isRecord(value) ? value : {};
  }

  private shellQuote(value: string) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  private async bindServerToEnvironment(
    teamId: string,
    projectId: string,
    environmentId: string,
    serverId: string,
  ) {
    await this.prisma.projectEnvironmentServer.upsert({
      where: {
        environmentId_serverId: {
          environmentId,
          serverId,
        },
      },
      create: {
        teamId,
        projectId,
        environmentId,
        serverId,
        role: 'runtime',
        metadata: this.toJsonValue({ source: 'application-service' }),
      },
      update: {
        projectId,
        role: 'runtime',
        status: 'active',
      },
    });
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
