import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditEventService } from '../audit-event';
import { GeneratorService, ProjectZipArtifactCleanupResult } from './generator.service';

type ScheduledProjectArtifactCleanupSummary = {
  skipped: boolean;
  enabled: boolean;
  dryRun: boolean;
  scanned: number;
  expired: number;
  deleted: number;
  auditEvents: number;
  auditFailures: number;
};

@Injectable()
export class GeneratedProjectArtifactCleanupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GeneratedProjectArtifactCleanupSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly generatorService: GeneratorService,
    private readonly auditEventService: AuditEventService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.schedulerEnabled()) {
      return;
    }

    const intervalMs = this.schedulerIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.logger.log(`Generated project artifact cleanup scheduler enabled; interval=${intervalMs}ms; dryRun=${this.schedulerDryRun()}`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(): Promise<ScheduledProjectArtifactCleanupSummary> {
    if (!this.schedulerEnabled()) {
      return this.emptySummary(false, false);
    }

    if (this.running) {
      return this.emptySummary(true, true);
    }

    this.running = true;
    try {
      const dryRun = this.schedulerDryRun();
      const result = await this.generatorService.cleanupExpiredProjectZipArtifacts({ dryRun });
      const auditSummary = await this.writeCleanupAuditEvents(result, 'scheduler');

      return {
        skipped: false,
        enabled: true,
        dryRun,
        scanned: result.scanned,
        expired: result.expired,
        deleted: result.deleted,
        auditEvents: auditSummary.auditEvents,
        auditFailures: auditSummary.auditFailures,
      };
    } finally {
      this.running = false;
    }
  }

  private async writeCleanupAuditEvents(
    result: ProjectZipArtifactCleanupResult,
    trigger: 'scheduler',
  ): Promise<{ auditEvents: number; auditFailures: number }> {
    const grouped = new Map<string, ProjectZipArtifactCleanupResult['artifacts']>();
    for (const artifact of result.artifacts) {
      if (!artifact.teamId) {
        continue;
      }

      const current = grouped.get(artifact.teamId) ?? [];
      current.push(artifact);
      grouped.set(artifact.teamId, current);
    }

    let auditEvents = 0;
    let auditFailures = 0;
    for (const [teamId, artifacts] of grouped.entries()) {
      try {
        await this.auditEventService.create({
          teamId,
          actorId: null,
          category: 'project',
          action: 'project.artifact.cleanup',
          targetType: 'project_artifact',
          targetId: 'generated-projects-local',
          risk: result.dryRun ? 'low' : 'high',
          status: 'completed',
          summary: result.dryRun
            ? `Scheduled dry-run found ${artifacts.length} expired generated project artifacts`
            : `Scheduled cleanup deleted ${artifacts.filter(artifact => artifact.deleted).length} expired generated project artifacts`,
          metadata: {
            trigger,
            dryRun: result.dryRun,
            scanned: result.scanned,
            expired: artifacts.length,
            deleted: artifacts.filter(artifact => artifact.deleted).length,
            artifacts: artifacts.slice(0, 20).map(artifact => ({
              projectId: artifact.projectId,
              fileName: artifact.fileName,
              size: artifact.size,
              generatedAt: artifact.generatedAt,
              expiresAt: artifact.expiresAt,
              deleted: artifact.deleted,
            })),
            artifactsTruncated: artifacts.length > 20,
          },
        });
        auditEvents += 1;
      } catch (error) {
        auditFailures += 1;
        this.logger.warn(
          `Failed to write generated project artifact cleanup audit for team ${teamId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return { auditEvents, auditFailures };
  }

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledProjectArtifactCleanupSummary {
    return {
      skipped,
      enabled,
      dryRun: this.schedulerDryRun(),
      scanned: 0,
      expired: 0,
      deleted: 0,
      auditEvents: 0,
      auditFailures: 0,
    };
  }

  private schedulerEnabled() {
    return this.configService.get('PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private schedulerDryRun() {
    return this.configService.get('PROJECT_ARTIFACT_CLEANUP_SCHEDULER_DRY_RUN', 'true') !== 'false';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('PROJECT_ARTIFACT_CLEANUP_SCHEDULER_INTERVAL_SECONDS', '86400'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 86400;
    return safeSeconds * 1000;
  }
}
