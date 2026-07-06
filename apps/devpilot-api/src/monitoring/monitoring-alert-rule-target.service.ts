import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlertRuleDto } from './dto/monitoring.dto';
import type { AlertRuleTargetContext } from './monitoring-alert-rule.types';

@Injectable()
export class MonitoringAlertRuleTargetService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveTargetContext(teamId: string, dto: CreateAlertRuleDto): Promise<AlertRuleTargetContext> {
    if (dto.applicationServiceId) {
      const service = await this.prisma.applicationService.findFirst({
        where: { id: dto.applicationServiceId, teamId },
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
      if (!service) throw new NotFoundException('应用服务不存在');
      return {
        category: 'service',
        projectId: service.projectId,
        applicationId: service.applicationId,
        environmentId: service.environmentId,
        applicationServiceId: service.id,
        serverId: service.serverId,
        siteId: service.siteId,
        managedResourceId: service.managedResourceId,
      };
    }

    if (dto.backupPlanId) {
      const backupPlan = await this.prisma.backupPlan.findFirst({
        where: { id: dto.backupPlanId, teamId },
        select: {
          id: true,
          projectId: true,
          environmentId: true,
          serverId: true,
          resourceId: true,
        },
      });
      if (!backupPlan) throw new NotFoundException('备份计划不存在');
      return {
        category: 'backup',
        projectId: backupPlan.projectId,
        environmentId: backupPlan.environmentId,
        serverId: backupPlan.serverId,
        managedResourceId: backupPlan.resourceId,
        backupPlanId: backupPlan.id,
      };
    }

    if (dto.siteId) {
      const site = await this.prisma.site.findFirst({
        where: { id: dto.siteId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true },
      });
      if (!site) throw new NotFoundException('站点不存在');
      return {
        category: 'site',
        projectId: site.projectId,
        environmentId: site.environmentId,
        serverId: site.serverId,
        siteId: site.id,
      };
    }

    if (dto.managedResourceId) {
      const resource = await this.prisma.managedResource.findFirst({
        where: { id: dto.managedResourceId, teamId },
        select: { id: true, projectId: true, environmentId: true, serverId: true },
      });
      if (!resource) throw new NotFoundException('托管资源不存在');
      return {
        category: 'resource',
        projectId: resource.projectId,
        environmentId: resource.environmentId,
        serverId: resource.serverId,
        managedResourceId: resource.id,
      };
    }

    if (dto.serverId) {
      const server = await this.prisma.server.findFirst({
        where: { id: dto.serverId, teamId },
        select: { id: true },
      });
      if (!server) throw new NotFoundException('服务器不存在');
      return {
        category: 'server',
        projectId: dto.projectId,
        environmentId: dto.environmentId,
        serverId: server.id,
      };
    }

    await this.validateLooseScope(teamId, dto);
    return {
      category: dto.category,
      projectId: dto.projectId,
      environmentId: dto.environmentId,
      applicationId: dto.applicationId,
    };
  }

  private async validateLooseScope(teamId: string, dto: CreateAlertRuleDto) {
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException('项目不存在');
    }

    if (dto.environmentId) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: { id: dto.environmentId, teamId },
        select: { id: true, projectId: true },
      });
      if (!environment) throw new NotFoundException('项目环境不存在');
      if (dto.projectId && environment.projectId !== dto.projectId) {
        throw new BadRequestException('项目环境不属于指定项目');
      }
    }

    if (dto.applicationId) {
      const application = await this.prisma.application.findFirst({
        where: { id: dto.applicationId, teamId },
        select: { id: true, projectId: true },
      });
      if (!application) throw new NotFoundException('应用不存在');
      if (dto.projectId && application.projectId !== dto.projectId) {
        throw new BadRequestException('应用不属于指定项目');
      }
    }
  }
}
