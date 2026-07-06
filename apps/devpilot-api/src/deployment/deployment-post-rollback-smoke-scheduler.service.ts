import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { DeploymentService } from './deployment.service';

type ScheduledDeploymentPostRollbackSmokeSummary = {
  skipped: boolean;
  enabled: boolean;
  scanned: number;
  attempted: number;
  created: number;
  skippedRuns: number;
  failed: number;
};

@Injectable()
export class DeploymentPostRollbackSmokeSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(DeploymentPostRollbackSmokeSchedulerService.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'deployment-post-rollback-smoke';
  }

  isEnabled(): boolean {
    return this.configService.get('DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_ENABLED', 'false') === 'true';
  }

  intervalMs(): number {
    const seconds = Number(this.configService.get('DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_INTERVAL_SECONDS', '60'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 10 ? seconds : 60;
    return safeSeconds * 1000;
  }

  async runOnce(): Promise<ScheduledDeploymentPostRollbackSmokeSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }

    try {
      const summary = await this.deploymentService.processPostRollbackSmokeChecks({
        limit: this.batchSize(),
      });

      return {
        skipped: false,
        enabled: true,
        scanned: summary.scanned,
        attempted: summary.attempted,
        created: summary.created,
        skippedRuns: summary.skipped,
        failed: summary.failed,
      };
    } finally {
      this.releaseRunLock();
    }
  }

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledDeploymentPostRollbackSmokeSummary {
    return {
      skipped,
      enabled,
      scanned: 0,
      attempted: 0,
      created: 0,
      skippedRuns: 0,
      failed: 0,
    };
  }

  private batchSize() {
    const size = Number(this.configService.get('DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 20;
  }
}
