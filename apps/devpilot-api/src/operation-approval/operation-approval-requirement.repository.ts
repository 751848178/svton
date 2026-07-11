import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { OperationApprovalRequirementPolicyRecord } from "./operation-approval.types";

@Injectable()
export class OperationApprovalRequirementRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRequesterRole(teamId: string, requesterId?: string | null) {
    if (!requesterId) return null;

    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: requesterId } },
      select: { role: true },
    });

    return membership?.role ?? null;
  }

  listCandidatePolicies(input: {
    teamId: string;
    projectId?: string | null;
    environmentId?: string | null;
  }): Promise<OperationApprovalRequirementPolicyRecord[]> {
    return this.prisma.controlAccessPolicy.findMany({
      where: {
        teamId: input.teamId,
        enabled: true,
        OR: this.scopeWhere(input.projectId, input.environmentId),
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        effect: true,
        principalType: true,
        principalRole: true,
        principalUserId: true,
        projectId: true,
        environmentId: true,
        categories: true,
        actions: true,
        riskLevels: true,
        priority: true,
      },
    });
  }

  private scopeWhere(
    projectId?: string | null,
    environmentId?: string | null,
  ): Prisma.ControlAccessPolicyWhereInput[] {
    const scope: Prisma.ControlAccessPolicyWhereInput[] = [
      { projectId: null, environmentId: null },
    ];

    if (projectId) scope.push({ projectId, environmentId: null });
    if (environmentId) {
      scope.push({ projectId: null, environmentId });
      if (projectId) scope.push({ projectId, environmentId });
    }

    return scope;
  }
}
