import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { DeploymentService } from './deployment.service';

type ScheduledDeploymentAutoRollbackSummary = {
  skipped: boolean;
  enabled: boolean;
  scanned: number;
  attempted: number;
  created: number;
  skippedRuns: number;
  failed: number;
};

@Injectable()
export class DeploymentAutoRollbackSchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(DeploymentAutoRollbackSchedulerService.name);

  constructor(
    private readonly deploymentService: DeploymentService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'deployment-auto-rollback';
  }

  isEnabled(): boolean {
    return this.configService.get('DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_ENABLED', 'false') === 'true';
  }

  intervalMs(): number {
    const seconds = Number(this.configService.get('DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_INTERVAL_SECONDS', '60'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 10 ? seconds : 60;
    return safeSeconds * 1000;
  }

  async runOnce(): Promise<ScheduledDeploymentAutoRollbackSummary> {
    if (!this.isEnabled()) {
      return this.emptySummary(false, false);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, true);
    }

    try {
      const summary = await this.deploymentService.processSmokeFailureAutoRollbacks({
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

  private emptySummary(skipped: boolean, enabled: boolean): ScheduledDeploymentAutoRollbackSummary {
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
    const size = Number(this.configService.get('DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 20;
  }
}
