/**
 * 发布计划访问控制（F383 Item 3 控制器瘦身）。
 *
 * 单一职责：从 release-plan.controller 抽离的 team→project→environment 归属校验 +
 * control_access_policy phase 校验。控制器只保留 HTTP 边界，本助手持有 PrismaService 与
 * ControlAccessPolicyService，把 read/write 两类 phase 的 RBAC 检查集中到一处。
 */
import { ForbiddenException, Injectable } from "@nestjs/common";
import { ControlAccessPolicyService } from "../control-access-policy";
import { PrismaService } from "../prisma/prisma.service";

export interface ReleasePlanActor {
  user: { id: string };
  teamId: string;
}

@Injectable()
export class ReleasePlanAccessGuard {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessPolicy: ControlAccessPolicyService,
  ) {}

  // 校验 team→project→environment 归属 + control_access_policy phase。
  async assertProjectAccess(
    req: ReleasePlanActor,
    projectId: string,
    environmentId: string | null | undefined,
    phase: "read" | "write",
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, teamId: req.teamId },
      select: { id: true },
    });
    if (!project) throw new ForbiddenException("无权访问该项目");
    if (environmentId) {
      const env = await this.prisma.projectEnvironment.findFirst({
        where: { id: environmentId, projectId, teamId: req.teamId },
        select: { id: true },
      });
      if (!env) throw new ForbiddenException("无权访问该环境");
    }
    const method = phase === "read" ? "assertCanRead" : "assertCanWrite";
    await this.accessPolicy[method]({
      teamId: req.teamId,
      actorId: req.user.id,
      projectId,
      environmentId: environmentId ?? undefined,
      category: "release_plan",
      action: phase === "read" ? "release_plan.read" : "release_plan.write",
      targetType: "project",
      targetId: projectId,
      risk: phase === "write" ? "high" : "low",
    });
  }
}
