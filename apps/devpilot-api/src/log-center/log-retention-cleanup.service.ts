import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CleanupLogRetentionDto } from "./dto/log-center.dto";
import { LogCenterAuditService } from "./log-center-audit.service";

const logRetentionCleanupRunInclude =
  Prisma.validator<Prisma.LogRetentionRunInclude>()({
    actor: { select: { id: true, name: true, email: true } },
    stream: {
      select: {
        id: true,
        projectId: true,
        environmentId: true,
        name: true,
        sourceType: true,
        status: true,
        retentionDays: true,
      },
    },
  });

type LogRetentionCleanupStream = {
  id: string;
  name: string;
  sourceType: string;
  sourceKey?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  applicationId?: string | null;
  applicationServiceId?: string | null;
  serverId?: string | null;
  siteId?: string | null;
  managedResourceId?: string | null;
  deploymentRunId?: string | null;
  backupRunId?: string | null;
  alertEventId?: string | null;
  retentionDays?: number | null;
};

@Injectable()
export class LogRetentionCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logCenterAuditService: LogCenterAuditService,
  ) {}

  async cleanup(
    teamId: string,
    userId: string | null,
    stream: LogRetentionCleanupStream,
    dto: CleanupLogRetentionDto,
  ) {
    const dryRun = dto.dryRun !== false;
    const retentionDays = Math.max(1, stream.retentionDays || 1);
    const cutoffAt = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const run = await this.prisma.logRetentionRun.create({
      data: {
        teamId,
        streamId: stream.id,
        actorId: userId || undefined,
        projectId: stream.projectId,
        environmentId: stream.environmentId,
        dryRun,
        retentionDays,
        cutoffAt,
      },
      include: logRetentionCleanupRunInclude,
    });

    try {
      const where: Prisma.LogEntryWhereInput = {
        teamId,
        streamId: stream.id,
        timestamp: { lt: cutoffAt },
      };
      const matchedEntryCount = await this.prisma.logEntry.count({ where });
      const deletedEntryCount = dryRun
        ? 0
        : (await this.prisma.logEntry.deleteMany({ where })).count;

      if (!dryRun && deletedEntryCount > 0) {
        await this.refreshLogStreamLastEntry(stream.id);
      }

      const completed = await this.prisma.logRetentionRun.update({
        where: { id: run.id },
        data: {
          status: "completed",
          matchedEntryCount,
          deletedEntryCount,
          finishedAt: new Date(),
        },
        include: logRetentionCleanupRunInclude,
      });
      await this.logCenterAuditService.recordRetention(
        teamId,
        userId,
        stream,
        completed,
      );
      return completed;
    } catch (error) {
      const failed = await this.prisma.logRetentionRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          error: error instanceof Error ? error.message : "日志保留清理失败",
          finishedAt: new Date(),
        },
        include: logRetentionCleanupRunInclude,
      });
      await this.logCenterAuditService.recordRetention(
        teamId,
        userId,
        stream,
        failed,
      );
      return failed;
    }
  }

  private async refreshLogStreamLastEntry(streamId: string) {
    const latest = await this.prisma.logEntry.findFirst({
      where: { streamId },
      orderBy: { timestamp: "desc" },
      select: { timestamp: true, level: true, message: true },
    });

    return this.prisma.logStream.update({
      where: { id: streamId },
      data: {
        lastEntryAt: latest?.timestamp || null,
        lastLevel: latest?.level || null,
        lastMessage: latest?.message || null,
      },
    });
  }
}
