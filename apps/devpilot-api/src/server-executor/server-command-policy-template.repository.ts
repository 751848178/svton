import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type CommandPolicyTemplateFilter = {
  projectId?: string;
  environmentId?: string;
  enabled?: "true" | "false";
};

@Injectable()
export class ServerCommandPolicyTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string, filter: CommandPolicyTemplateFilter) {
    const where: Prisma.ServerCommandPolicyTemplateWhereInput = { teamId };
    if (filter.projectId) where.projectId = filter.projectId;
    if (filter.environmentId) where.environmentId = filter.environmentId;
    if (filter.enabled === "true") where.enabled = true;
    if (filter.enabled === "false") where.enabled = false;

    return this.prisma.serverCommandPolicyTemplate.findMany({
      where,
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        environment: { select: { id: true, key: true, name: true } },
      },
    });
  }

  create(data: Prisma.ServerCommandPolicyTemplateUncheckedCreateInput) {
    return this.prisma.serverCommandPolicyTemplate.create({ data });
  }

  findByTeam(teamId: string, id: string) {
    return this.prisma.serverCommandPolicyTemplate.findFirst({
      where: { id, teamId },
    });
  }

  findAccessScope(teamId: string, id: string) {
    return this.prisma.serverCommandPolicyTemplate.findFirst({
      where: { id, teamId },
      select: { id: true, projectId: true, environmentId: true },
    });
  }

  update(id: string, data: Prisma.ServerCommandPolicyTemplateUpdateInput) {
    return this.prisma.serverCommandPolicyTemplate.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.prisma.serverCommandPolicyTemplate.delete({ where: { id } });
    return { deleted: true };
  }

  findProject(teamId: string, projectId: string) {
    return this.prisma.project.findFirst({
      where: { id: projectId, teamId },
      select: { id: true },
    });
  }

  findActiveEnvironment(teamId: string, environmentId: string) {
    return this.prisma.projectEnvironment.findFirst({
      where: { id: environmentId, teamId, status: "active" },
      select: { id: true, projectId: true },
    });
  }

  findEnabledForScope(
    teamId: string,
    scope: Prisma.ServerCommandPolicyTemplateWhereInput[],
  ) {
    return this.prisma.serverCommandPolicyTemplate.findMany({
      where: {
        teamId,
        enabled: true,
        OR: scope,
      },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        adapterKeys: true,
        operationKeys: true,
        allowedPatterns: true,
        blockedPatterns: true,
      },
    });
  }
}
