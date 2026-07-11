import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSiteDto } from "./dto/site.dto";

type SiteBindingInput = Pick<
  CreateSiteDto,
  "projectId" | "environmentId" | "serverId" | "proxyConfigId"
>;

export class SiteBindingService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBindings(
    teamId: string,
    dto: SiteBindingInput,
    fallbackProjectId?: string | null,
  ) {
    if (dto.projectId) await this.assertProject(teamId, dto.projectId);
    if (dto.serverId) await this.assertServer(teamId, dto.serverId);
    if (dto.environmentId) {
      const projectId = dto.projectId || fallbackProjectId;
      if (!projectId)
        throw new BadRequestException("绑定项目环境前需要先关联项目");
      await this.assertEnvironment(teamId, dto.environmentId, projectId);
    }
    if (dto.proxyConfigId)
      await this.assertProxyConfig(teamId, dto.proxyConfigId);
  }

  private async assertProject(teamId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });
    if (!project) throw new BadRequestException("项目不存在或不属于当前团队");
  }

  private async assertServer(teamId: string, serverId: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, teamId },
      select: { id: true },
    });
    if (!server) throw new BadRequestException("服务器不存在或不属于当前团队");
  }

  private async assertProxyConfig(teamId: string, proxyConfigId: string) {
    const proxyConfig = await this.prisma.proxyConfig.findFirst({
      where: { id: proxyConfigId, teamId },
      select: { id: true },
    });
    if (!proxyConfig)
      throw new BadRequestException("代理配置不存在或不属于当前团队");
  }

  private async assertEnvironment(
    teamId: string,
    id: string,
    projectId: string,
  ) {
    const environment = await this.prisma.projectEnvironment.findFirst({
      where: { id, teamId, projectId, status: "active" },
      select: { id: true },
    });
    if (!environment)
      throw new BadRequestException("项目环境不存在或不属于当前项目");
  }
}
