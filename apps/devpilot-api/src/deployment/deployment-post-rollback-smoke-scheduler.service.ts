import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
export class DeploymentPostRollbackSmokeSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeploymentPostRollbackSmokeSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly deploymentService: DeploymentService,
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
    this.logger.log(`Deployment post-rollback smoke scheduler enabled; interval=${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(): Promise<ScheduledDeploymentPostRollbackSmokeSummary> {
    if (!this.schedulerEnabled()) {
      return this.emptySummary(false, false);
    }

    if (this.running) {
      return this.emptySummary(true, true);
    }

    this.running = true;
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
      this.running = false;
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

  private schedulerEnabled() {
    return this.configService.get('DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_INTERVAL_SECONDS', '60'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 10 ? seconds : 60;
    return safeSeconds * 1000;
  }

  private batchSize() {
    const size = Number(this.configService.get('DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_BATCH_SIZE', '20'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 20;
  }
}
