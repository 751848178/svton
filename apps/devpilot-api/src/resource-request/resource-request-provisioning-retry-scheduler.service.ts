import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { BaseIntervalScheduler } from '../common/scheduler/base-interval-scheduler';
import { ResourceRequestService } from './resource-request.service';

type ScheduledResourceRequestProvisioningRetrySummary = {
  skipped: boolean;
  retryEnabled: boolean;
  staleRecoveryEnabled: boolean;
  queueWorkerEnabled: boolean;
  providerStatePollingEnabled: boolean;
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
  queueScanned: number;
  queueProcessed: number;
  queueSkipped: number;
  queueFailed: number;
  providerPollScanned: number;
  providerPollPolled: number;
  providerPollCompleted: number;
  providerPollPlanned: number;
  providerPollBlocked: number;
  providerPollSkipped: number;
  providerPollFailed: number;
};

@Injectable()
export class ResourceRequestProvisioningRetrySchedulerService extends BaseIntervalScheduler {
  protected readonly logger = new Logger(ResourceRequestProvisioningRetrySchedulerService.name);

  constructor(
    private readonly resourceRequestService: ResourceRequestService,
    private readonly configService: ConfigService,
    @Optional() schedulerRegistry?: SchedulerRegistry,
  ) {
    super(schedulerRegistry);
  }

  schedulerName(): string {
    return 'resource-request-provisioning-retry';
  }

  isEnabled(): boolean {
    return (
      this.retrySchedulerEnabled()
      || this.staleRecoveryEnabled()
      || this.queueWorkerEnabled()
      || this.providerStatePollingEnabled()
    );
  }

  intervalMs(): number {
    return this.schedulerIntervalMs();
  }

  async runOnce(): Promise<ScheduledResourceRequestProvisioningRetrySummary> {
    const retryEnabled = this.retrySchedulerEnabled();
    const staleRecoveryEnabled = this.staleRecoveryEnabled();
    const queueWorkerEnabled = this.queueWorkerEnabled();
    const providerStatePollingEnabled = this.providerStatePollingEnabled();
    if (!retryEnabled && !staleRecoveryEnabled && !queueWorkerEnabled && !providerStatePollingEnabled) {
      return this.emptySummary(false, retryEnabled, staleRecoveryEnabled, queueWorkerEnabled, providerStatePollingEnabled);
    }

    if (!this.tryAcquireRunLock()) {
      return this.emptySummary(true, retryEnabled, staleRecoveryEnabled, queueWorkerEnabled, providerStatePollingEnabled);
    }

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
      const queueSummary = queueWorkerEnabled
        ? await this.processQueuedRuns()
        : { scanned: 0, processed: 0, skipped: 0, failed: 0 };
      const providerPollSummary = providerStatePollingEnabled
        ? await this.resourceRequestService.processDueProviderStatePollingRuns({
          limit: this.providerStatePollingBatchSize(),
        })
        : { scanned: 0, polled: 0, completed: 0, planned: 0, blocked: 0, skipped: 0, failed: 0 };

      return {
        skipped: false,
        retryEnabled,
        staleRecoveryEnabled,
        queueWorkerEnabled,
        providerStatePollingEnabled,
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
        queueScanned: queueSummary.scanned,
        queueProcessed: queueSummary.processed,
        queueSkipped: queueSummary.skipped,
        queueFailed: queueSummary.failed,
        providerPollScanned: providerPollSummary.scanned,
        providerPollPolled: providerPollSummary.polled,
        providerPollCompleted: providerPollSummary.completed,
        providerPollPlanned: providerPollSummary.planned,
        providerPollBlocked: providerPollSummary.blocked,
        providerPollSkipped: providerPollSummary.skipped,
        providerPollFailed: providerPollSummary.failed,
      };
    } finally {
      this.releaseRunLock();
    }
  }

  private async processQueuedRuns() {
    const limit = this.queueWorkerBatchSize();
    const summary = {
      scanned: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
    };

    for (let index = 0; index < limit; index += 1) {
      const result = await this.resourceRequestService.processNextQueuedProvisioningRun(undefined, undefined, {});
      summary.scanned += result.scanned;
      summary.processed += result.processed;
      summary.skipped += result.skipped;
      summary.failed += result.failed;

      if (result.scanned === 0 || result.reason === 'queue_empty') {
        break;
      }
    }

    return summary;
  }

  private emptySummary(
    skipped: boolean,
    retryEnabled: boolean,
    staleRecoveryEnabled: boolean,
    queueWorkerEnabled: boolean,
    providerStatePollingEnabled: boolean,
  ): ScheduledResourceRequestProvisioningRetrySummary {
    return {
      skipped,
      retryEnabled,
      staleRecoveryEnabled,
      queueWorkerEnabled,
      providerStatePollingEnabled,
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
      queueScanned: 0,
      queueProcessed: 0,
      queueSkipped: 0,
      queueFailed: 0,
      providerPollScanned: 0,
      providerPollPolled: 0,
      providerPollCompleted: 0,
      providerPollPlanned: 0,
      providerPollBlocked: 0,
      providerPollSkipped: 0,
      providerPollFailed: 0,
    };
  }

  private retrySchedulerEnabled() {
    return this.configService.get('RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED', 'false') === 'true';
  }

  private staleRecoveryEnabled() {
    return this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED', 'false') === 'true';
  }

  private queueWorkerEnabled() {
    return this.configService.get('RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED', 'false') === 'true';
  }

  private providerStatePollingEnabled() {
    return this.configService.get('RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_ENABLED', 'false') === 'true';
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

  private queueWorkerBatchSize() {
    const size = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_BATCH_SIZE', '10'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 10;
  }

  private providerStatePollingBatchSize() {
    const size = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_BATCH_SIZE', '10'));
    return Number.isFinite(size) && size > 0 ? Math.min(Math.floor(size), 100) : 10;
  }

  private staleRecoveryAfterSeconds() {
    const seconds = Number(this.configService.get('RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS', '1800'));
    return Number.isFinite(seconds) && seconds >= 60 ? Math.floor(seconds) : 1800;
  }
}
