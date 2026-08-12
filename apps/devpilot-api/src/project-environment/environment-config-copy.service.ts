import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CopyEnvironmentConfigRevisionDto } from "./dto/environment-config-revision.dto";

type RevisionResult = {
  revision: { id: string; revision: number; snapshotHash: string };
};

@Injectable()
export class EnvironmentConfigCopyService {
  constructor(private readonly prisma: PrismaService) {}

  async copy(
    teamId: string,
    actorId: string,
    sourceEnvironmentId: string,
    dto: CopyEnvironmentConfigRevisionDto,
    append: (
      teamId: string, actorId: string, environmentId: string,
      input: Record<string, unknown>,
    ) => Promise<RevisionResult>,
  ) {
    const source = await this.prisma.projectEnvironment.findFirst({
      where: { id: sourceEnvironmentId, teamId },
      select: { id: true, projectId: true },
    });
    if (!source) throw new NotFoundException("项目环境不存在");
    if (dto.targets.length === 0) throw new BadRequestException("请选择要复用的目标环境");
    const targets = [...new Map(
      dto.targets.map((target) => [target.environmentId, target]),
    ).values()];
    const rows = await this.prisma.projectEnvironment.findMany({
      where: {
        id: { in: targets.map((target) => target.environmentId) },
        teamId, projectId: source.projectId,
      },
      select: { id: true, key: true, currentConfigRevisionId: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const target of targets) {
      if (!byId.has(target.environmentId)) {
        throw new BadRequestException(
          `目标环境 ${target.environmentId} 无效或跨项目，无法复用`,
        );
      }
    }
    const results = [];
    for (const target of targets) {
      const row = byId.get(target.environmentId)!;
      try {
        const outcome = await append(teamId, actorId, row.id, {
          plainVariables: dto.plainVariables,
          secretReferenceIds: dto.secretReferenceIds,
          changeSummary: dto.changeSummary,
          expectedCurrentRevisionId: row.currentConfigRevisionId ?? undefined,
        });
        results.push({ environmentId: row.id, key: row.key, ok: true,
          revision: outcome.revision });
      } catch (cause) {
        results.push({ environmentId: row.id, key: row.key, ok: false,
          error: cause instanceof Error ? cause.message : "复制配置失败" });
      }
    }
    return { sourceEnvironmentId, results };
  }
}
