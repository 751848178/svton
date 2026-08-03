import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LegacyDeploymentWriteGuardService {
  constructor(private readonly prisma: PrismaService) {}

  async assertAllowed(teamId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: {
        archivedAt: true,
        onboardingStatus: true,
        _count: { select: { releaseOrders: true } },
      },
    });
    if (!project) throw new NotFoundException("项目不存在");
    if (project.archivedAt) {
      throw new UnprocessableEntityException({
        code: "project_archived_read_only",
        message: "项目已归档；历史运行和日志只读保留",
      });
    }
    if (project.onboardingStatus === "ready" || project._count.releaseOrders > 0) {
      throw new UnprocessableEntityException({
        code: "legacy_branch_deployment_closed",
        message: "受管项目必须从发布单选择已持久化 Manifest；禁止 branch/commit 直发和部署时构建",
        requiredEndpoint: `/projects/${projectId}/delivery/releases`,
      });
    }
  }
}
