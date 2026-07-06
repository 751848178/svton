import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLogStreamDto } from "./dto/log-center.dto";
import { LogStreamTargetContext } from "./log-stream-target-context.types";

@Injectable()
export class LogStreamSourceTargetContextService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    teamId: string,
    dto: CreateLogStreamDto,
  ): Promise<LogStreamTargetContext> {
    if (dto.siteId) return this.resolveSite(teamId, dto.siteId);
    if (dto.managedResourceId) {
      return this.resolveManagedResource(teamId, dto.managedResourceId);
    }
    if (dto.serverId) return this.resolveServer(teamId, dto, dto.serverId);

    await this.validateLooseScope(teamId, dto);
    return {
      sourceType: dto.sourceType || "manual",
      projectId: dto.projectId,
      environmentId: dto.environmentId,
      applicationId: dto.applicationId,
    };
  }

  private async resolveSite(teamId: string, id: string) {
    const site = await this.prisma.site.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        serverId: true,
      },
    });
    if (!site) throw new NotFoundException("站点不存在");
    return {
      sourceType: "nginx",
      siteId: site.id,
      projectId: site.projectId,
      environmentId: site.environmentId,
      serverId: site.serverId,
    };
  }

  private async resolveManagedResource(teamId: string, id: string) {
    const resource = await this.prisma.managedResource.findFirst({
      where: { id, teamId },
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        serverId: true,
        provider: true,
        kind: true,
      },
    });
    if (!resource) throw new NotFoundException("托管资源不存在");
    return {
      sourceType:
        resource.provider === "aliyun-sls" || resource.kind === "log_service"
          ? "sls"
          : "manual",
      managedResourceId: resource.id,
      projectId: resource.projectId,
      environmentId: resource.environmentId,
      serverId: resource.serverId,
    };
  }

  private async resolveServer(
    teamId: string,
    dto: CreateLogStreamDto,
    id: string,
  ) {
    const server = await this.prisma.server.findFirst({
      where: { id, teamId },
      select: { id: true },
    });
    if (!server) throw new NotFoundException("服务器不存在");
    await this.validateLooseScope(teamId, dto);
    return {
      sourceType: "server_executor",
      projectId: dto.projectId,
      environmentId: dto.environmentId,
      applicationId: dto.applicationId,
      serverId: server.id,
    };
  }

  private async validateLooseScope(teamId: string, dto: CreateLogStreamDto) {
    if (dto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: dto.projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException("项目不存在");
    }

    if (dto.environmentId) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: { id: dto.environmentId, teamId },
        select: { id: true, projectId: true },
      });
      if (!environment) throw new NotFoundException("项目环境不存在");
      if (dto.projectId && environment.projectId !== dto.projectId) {
        throw new BadRequestException("项目环境不属于指定项目");
      }
    }

    if (dto.applicationId) {
      const application = await this.prisma.application.findFirst({
        where: { id: dto.applicationId, teamId },
        select: { id: true, projectId: true },
      });
      if (!application) throw new NotFoundException("应用不存在");
      if (dto.projectId && application.projectId !== dto.projectId) {
        throw new BadRequestException("应用不属于指定项目");
      }
    }
  }
}
