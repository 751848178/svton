import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class MonitoringProjectEnvironmentScopeService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveLooseScope(
    teamId: string,
    rawProjectId?: string,
    rawEnvironmentId?: string,
  ) {
    const projectId = this.readString(rawProjectId) || null;
    const environmentId = this.readString(rawEnvironmentId) || null;

    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, teamId },
        select: { id: true },
      });
      if (!project) throw new NotFoundException("项目不存在");
    }

    if (environmentId) {
      const environment = await this.prisma.projectEnvironment.findFirst({
        where: { id: environmentId, teamId },
        select: { id: true, projectId: true },
      });
      if (!environment) throw new NotFoundException("项目环境不存在");
      if (projectId && environment.projectId !== projectId) {
        throw new BadRequestException("项目环境不属于指定项目");
      }
      return {
        projectId: projectId || environment.projectId,
        environmentId,
      };
    }

    return { projectId, environmentId };
  }

  private readString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
  }
}
