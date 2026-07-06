import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLogStreamDto } from "./dto/log-center.dto";
import { LogStreamTargetContext } from "./log-stream-target-context.types";

@Injectable()
export class LogStreamLinkedTargetContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    teamId: string,
    dto: CreateLogStreamDto,
  ): Promise<LogStreamTargetContext | null> {
    if (dto.applicationServiceId) {
      return this.resolveApplicationService(teamId, dto.applicationServiceId);
    }
    if (dto.deploymentRunId) {
      return this.resolveDeploymentRun(teamId, dto.deploymentRunId);
    }
    if (dto.backupRunId) return this.resolveBackupRun(teamId, dto.backupRunId);
    if (dto.backupPlanId) {
      return this.resolveBackupPlan(teamId, dto.backupPlanId);
    }
    if (dto.alertEventId)
      return this.resolveAlertEvent(teamId, dto.alertEventId);
    return null;
  }

  private async resolveApplicationService(teamId: string, id: string) {
    const service = await this.prisma.applicationService.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        projectId: true,
        applicationId: true,
        environmentId: true,
        serverId: true,
        siteId: true,
        managedResourceId: true,
      },
    });
    if (!service) throw new NotFoundException("应用服务不存在");
    return {
      sourceType: "docker",
      projectId: service.projectId,
      applicationId: service.applicationId,
      environmentId: service.environmentId,
      applicationServiceId: service.id,
      serverId: service.serverId,
      siteId: service.siteId,
      managedResourceId: service.managedResourceId,
    };
  }

  private async resolveDeploymentRun(teamId: string, id: string) {
    const run = await this.prisma.deploymentRun.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
      },
    });
    if (!run) throw new NotFoundException("部署运行不存在");
    return {
      sourceType: "deployment",
      deploymentRunId: run.id,
      projectId: run.projectId,
      environmentId: run.environmentId,
      applicationId: run.applicationId,
      applicationServiceId: run.applicationServiceId,
      serverId: run.serverId,
    };
  }

  private async resolveBackupRun(teamId: string, id: string) {
    const run = await this.prisma.backupRun.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        planId: true,
        projectId: true,
        environmentId: true,
        serverId: true,
        resourceId: true,
      },
    });
    if (!run) throw new NotFoundException("备份运行不存在");
    return {
      sourceType: "backup",
      backupRunId: run.id,
      backupPlanId: run.planId,
      projectId: run.projectId,
      environmentId: run.environmentId,
      serverId: run.serverId,
      managedResourceId: run.resourceId,
    };
  }

  private async resolveBackupPlan(teamId: string, id: string) {
    const plan = await this.prisma.backupPlan.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        serverId: true,
        resourceId: true,
      },
    });
    if (!plan) throw new NotFoundException("备份计划不存在");
    return {
      sourceType: "backup",
      backupPlanId: plan.id,
      projectId: plan.projectId,
      environmentId: plan.environmentId,
      serverId: plan.serverId,
      managedResourceId: plan.resourceId,
    };
  }

  private async resolveAlertEvent(teamId: string, id: string) {
    const event = await this.prisma.alertEvent.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        applicationId: true,
        applicationServiceId: true,
        serverId: true,
        siteId: true,
        managedResourceId: true,
        backupPlanId: true,
      },
    });
    if (!event) throw new NotFoundException("告警事件不存在");
    return {
      sourceType: "alert",
      alertEventId: event.id,
      projectId: event.projectId,
      environmentId: event.environmentId,
      applicationId: event.applicationId,
      applicationServiceId: event.applicationServiceId,
      serverId: event.serverId,
      siteId: event.siteId,
      managedResourceId: event.managedResourceId,
      backupPlanId: event.backupPlanId,
    };
  }
}
