import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AuditEventService } from '../audit-event';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
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
export class GeneratedProjectArtifactCleanupSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(GeneratedProjectArtifactCleanupSchedulerService.name);

  constructor(
    private readonly generatorService: GeneratorService,
    private readonly auditEventService: AuditEventService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'generated-project-artifact-cleanup';
  }

  isEnabled(): boolean {
    return this.configService.get('PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED', 'false') === 'true';
  }

  intervalMs(): number {
    const seconds = Number(this.configService.get('PROJECT_ARTIFACT_CLEANUP_SCHEDULER_INTERVAL_SECONDS', '86400'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 60 ? seconds : 86400;
    return safeSeconds * 1000;
  }

  async runOnce(): Promise<ScheduledProjectArtifactCleanupSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }

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
      this.releaseRunLock();
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

  private schedulerDryRun() {
    return this.configService.get('PROJECT_ARTIFACT_CLEANUP_SCHEDULER_DRY_RUN', 'true') !== 'false';
  }
}
