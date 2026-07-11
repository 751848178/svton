import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { MemberRole } from "../team/dto/team.dto";
import {
  CreateControlAccessPolicyDto,
  ListControlAccessPoliciesQueryDto,
  UpdateControlAccessPolicyDto,
} from "./dto/control-access-policy.dto";
import {
  CONTROL_ACCESS_POLICY_INCLUDE,
  CONTROL_ACCESS_POLICY_MATCH_SELECT,
} from "./control-access-policy-includes.constants";
import {
  ControlAccessCheckInput,
  PolicyMembership,
  PolicyRecord,
} from "./control-access-policy.types";

@Injectable()
export class ControlAccessPolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string, query: ListControlAccessPoliciesQueryDto) {
    return this.prisma.controlAccessPolicy.findMany({
      where: this.toListWhere(teamId, query),
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: CONTROL_ACCESS_POLICY_INCLUDE,
    });
  }

  create(teamId: string, userId: string, dto: CreateControlAccessPolicyDto) {
    return this.prisma.controlAccessPolicy.create({
      data: {
        teamId,
        createdById: userId,
        principalUserId: dto.principalUserId || undefined,
        projectId: dto.projectId || undefined,
        environmentId: dto.environmentId || undefined,
        name: dto.name,
        description: dto.description,
        enabled: dto.enabled ?? true,
        effect: dto.effect || "allow",
        principalType: dto.principalType || "team_role",
        principalRole: dto.principalRole || undefined,
        categories: this.toStringListJson(dto.categories),
        actions: this.toStringListJson(dto.actions),
        riskLevels: this.toStringListJson(dto.riskLevels),
        priority: dto.priority ?? 0,
      },
      include: CONTROL_ACCESS_POLICY_INCLUDE,
    });
  }

  findByIdForTeam(teamId: string, id: string) {
    return this.prisma.controlAccessPolicy.findFirst({
      where: { id, teamId },
      include: CONTROL_ACCESS_POLICY_INCLUDE,
    });
  }

  update(id: string, dto: UpdateControlAccessPolicyDto) {
    return this.prisma.controlAccessPolicy.update({
      where: { id },
      data: this.toUpdateData(dto),
      include: CONTROL_ACCESS_POLICY_INCLUDE,
    });
  }

  delete(id: string) {
    return this.prisma.controlAccessPolicy.delete({ where: { id } });
  }

  async resolveMembership(
    teamId: string,
    userId: string,
  ): Promise<PolicyMembership | null> {
    const membership = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });
    return membership ? { role: membership.role as MemberRole, userId } : null;
  }

  findTeamMember(teamId: string, userId: string) {
    return this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { id: true },
    });
  }

  findProject(teamId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });
  }

  findEnvironment(teamId: string, environmentId: string) {
    return this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId, status: "active" },
      select: { id: true, projectId: true },
    });
  }

  loadCandidatePolicies(
    input: ControlAccessCheckInput,
  ): Promise<PolicyRecord[]> {
    return this.prisma.controlAccessPolicy.findMany({
      where: {
        teamId: input.teamId,
        enabled: true,
        OR: this.toScopeWhere(input),
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      select: CONTROL_ACCESS_POLICY_MATCH_SELECT,
    });
  }

  private toListWhere(
    teamId: string,
    query: ListControlAccessPoliciesQueryDto,
  ): Prisma.ControlAccessPolicyWhereInput {
    const where: Prisma.ControlAccessPolicyWhereInput = { teamId };
    if (query.projectId) where.projectId = query.projectId;
    if (query.environmentId) where.environmentId = query.environmentId;
    if (query.principalUserId) where.principalUserId = query.principalUserId;
    if (query.principalRole) where.principalRole = query.principalRole;
    if (query.principalType) where.principalType = query.principalType;
    if (query.effect) where.effect = query.effect;
    if (query.enabled === "true") where.enabled = true;
    if (query.enabled === "false") where.enabled = false;
    return where;
  }

  private toScopeWhere(
    input: ControlAccessCheckInput,
  ): Prisma.ControlAccessPolicyWhereInput[] {
    const scope: Prisma.ControlAccessPolicyWhereInput[] = [
      { projectId: null, environmentId: null },
    ];
    if (input.projectId) {
      scope.push({ projectId: input.projectId, environmentId: null });
    }
    if (input.environmentId) {
      scope.push({ projectId: null, environmentId: input.environmentId });
      if (input.projectId) {
        scope.push({
          projectId: input.projectId,
          environmentId: input.environmentId,
        });
      }
    }
    return scope;
  }

  private toStringListJson(values?: string[] | null): Prisma.InputJsonValue {
    if (!Array.isArray(values)) return [];
    return Array.from(
      new Set(values.map((value) => value.trim()).filter(Boolean)),
    );
  }

  private toUpdateData(
    dto: UpdateControlAccessPolicyDto,
  ): Prisma.ControlAccessPolicyUpdateInput {
    const data: Prisma.ControlAccessPolicyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.effect !== undefined) data.effect = dto.effect;
    if (dto.principalType !== undefined) data.principalType = dto.principalType;
    if (dto.principalRole !== undefined)
      data.principalRole = dto.principalRole || null;
    if (dto.principalUserId !== undefined) {
      data.principalUser = dto.principalUserId
        ? { connect: { id: dto.principalUserId } }
        : { disconnect: true };
    }
    if (dto.projectId !== undefined) {
      data.project = dto.projectId
        ? { connect: { id: dto.projectId } }
        : { disconnect: true };
    }
    if (dto.environmentId !== undefined) {
      data.environment = dto.environmentId
        ? { connect: { id: dto.environmentId } }
        : { disconnect: true };
    }
    if (dto.categories !== undefined)
      data.categories = this.toStringListJson(dto.categories);
    if (dto.actions !== undefined)
      data.actions = this.toStringListJson(dto.actions);
    if (dto.riskLevels !== undefined)
      data.riskLevels = this.toStringListJson(dto.riskLevels);
    if (dto.priority !== undefined) data.priority = dto.priority;
    return data;
  }
}
