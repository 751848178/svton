import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResourceRequestService } from './resource-request.service';

type ScheduledResourceRequestProvisioningRetrySummary = {
  skipped: boolean;
  retryEnabled: boolean;
  staleRecoveryEnabled: boolean;
  scanned: number;
  attempted: number;
  completed: number;
  blocked: number;
  skippedCandidates: number;
  failed: number;
  staleScanned: number;
  staleRecovered: number;
  staleRequestUpdated: number;
  staleSkipped: number;
  staleFailed: number;
};

@Injectable()
export class ResourceRequestProvisioningRetrySchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResourceRequestProvisioningRetrySchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly resourceRequestService: ResourceRequestService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    if (!this.retrySchedulerEnabled() && !this.staleRecoveryEnabled()) {
      return;
    }

    const intervalMs = this.schedulerIntervalMs();
    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);
    this.logger.log(`ResourceRequest provisioning retry scheduler enabled; interval=${intervalMs}ms`);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async runOnce(): Promise<ScheduledResourceRequestProvisioningRetrySummary> {
    const retryEnabled = this.retrySchedulerEnabled();
    const staleRecoveryEnabled = this.staleRecoveryEnabled();
    if (!retryEnabled && !staleRecoveryEnabled) {
      return this.emptySummary(false, retryEnabled, staleRecoveryEnabled);
    }

    if (this.running) {
      return this.emptySummary(true, retryEnabled, staleRecoveryEnabled);
    }

    this.running = true;
    try {
      const retrySummary = retryEnabled
        ? await this.resourceRequestService.processDueProvisioningAutoRetries({
          limit: this.retryBatchSize(),
        })
        : { scanned: 0, attempted: 0, completed: 0, blocked: 0, skipped: 0, failed: 0 };
      const staleSummary = staleRecoveryEnabled
        ? await this.resourceRequestService.recoverStaleProvisioningRuns({
          limit: this.staleRecoveryBatchSize(),
          staleAfterSeconds: this.staleRecoveryAfterSeconds(),
        })
        : { scanned: 0, recovered: 0, requestUpdated: 0, skipped: 0, failed: 0 };

      return {
        skipped: false,
        retryEnabled,
        staleRecoveryEnabled,
        scanned: retrySummary.scanned,
        attempted: retrySummary.attempted,
        completed: retrySummary.completed,
        blocked: retrySummary.blocked,
        skippedCandidates: retrySummary.skipped,
        failed: retrySummary.failed,
        staleScanned: staleSummary.scanned,
        staleRecovered: staleSummary.recovered,
        staleRequestUpdated: staleSummary.requestUpdated,
        staleSkipped: staleSummary.skipped,
        staleFailed: staleSummary.failed,
      };
    } finally {
      this.running = false;
    }
  }

  private emptySummary(
    skipped: boolean,
    retryEnabled: boolean,
    staleRecoveryEnabled: boolean,
  ): ScheduledResourceRequestProvisioningRetrySummary {
    return {
      skipped,
      retryEnabled,
      staleRecoveryEnabled,
      scanned: 0,
      attempted: 0,
      completed: 0,
      blocked: 0,
      skippedCandidates: 0,
      failed: 0,
      staleScanned: 0,
      staleRecovered: 0,
      staleRequestUpdated: 0,
      staleSkipped: 0,
      staleFailed: 0,
    };
  }

  private retrySchedulerEnabled() {
    return this.configService.get('RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private staleRecoveryEnabled() {
    return this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED', 'false') === 'true';
  }

  private schedulerIntervalMs() {
    const seconds = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_INTERVAL_SECONDS', '60'));
    const safeSeconds = Number.isFinite(seconds) && seconds >= 10 ? seconds : 60;
    return safeSeconds * 1000;
  }

  private retryBatchSize() {
    const size = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_BATCH_SIZE', '10'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 10;
  }

  private staleRecoveryBatchSize() {
    const size = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_BATCH_SIZE', '10'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 10;
  }

  private staleRecoveryAfterSeconds() {
    const seconds = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS', '1800'));
    return Number.isFinite(seconds) && seconds >= 60 ? Math.floor(seconds) : 1800;
  }
}
