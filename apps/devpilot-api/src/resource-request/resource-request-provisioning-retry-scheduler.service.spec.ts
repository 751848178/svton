import { ConfigService } from '@nestjs/config';
import { ResourceRequestProvisioningRetrySchedulerService } from './resource-request-provisioning-retry-scheduler.service';
import { ResourceRequestService } from './resource-request.service';

describe('ResourceRequestProvisioningRetrySchedulerService', () => {
  it('skips work when retry and stale recovery schedulers are disabled', async () => {
    const { service, resourceRequestService } = createScheduler();

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      skipped: false,
      retryEnabled: false,
      staleRecoveryEnabled: false,
      queueWorkerEnabled: false,
      scanned: 0,
      staleScanned: 0,
      queueScanned: 0,
    }));
    expect(resourceRequestService.processDueProvisioningAutoRetries).not.toHaveBeenCalled();
    expect(resourceRequestService.recoverStaleProvisioningRuns).not.toHaveBeenCalled();
    expect(resourceRequestService.processNextQueuedProvisioningRun).not.toHaveBeenCalled();
  });

  it('runs stale recovery independently from provisioning retry', async () => {
    const { service, resourceRequestService } = createScheduler({
      RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED: 'true',
      RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_BATCH_SIZE: '7',
      RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS: '120',
    });
    resourceRequestService.recoverStaleProvisioningRuns.mockResolvedValue({
      scanned: 2,
      recovered: 2,
      requestUpdated: 1,
      skipped: 1,
      failed: 0,
    });

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      skipped: false,
      retryEnabled: false,
      staleRecoveryEnabled: true,
      queueWorkerEnabled: false,
      scanned: 0,
      staleScanned: 2,
      staleRecovered: 2,
      staleRequestUpdated: 1,
      staleSkipped: 1,
      staleFailed: 0,
    }));
    expect(resourceRequestService.processDueProvisioningAutoRetries).not.toHaveBeenCalled();
    expect(resourceRequestService.processNextQueuedProvisioningRun).not.toHaveBeenCalled();
    expect(resourceRequestService.recoverStaleProvisioningRuns).toHaveBeenCalledWith({
      limit: 7,
      staleAfterSeconds: 120,
    });
  });

  it('processes queued provisioning runs independently from retry and stale recovery', async () => {
    const { service, resourceRequestService } = createScheduler({
      RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED: 'true',
      RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_BATCH_SIZE: '3',
    });
    resourceRequestService.processNextQueuedProvisioningRun
      .mockResolvedValueOnce({ scanned: 1, processed: 1, skipped: 0, failed: 0 })
      .mockResolvedValueOnce({ scanned: 1, processed: 0, skipped: 1, failed: 0, reason: 'queue_claim_conflict' })
      .mockResolvedValueOnce({ scanned: 0, processed: 0, skipped: 0, failed: 0, reason: 'queue_empty' });

    await expect(service.runOnce()).resolves.toEqual(expect.objectContaining({
      skipped: false,
      retryEnabled: false,
      staleRecoveryEnabled: false,
      queueWorkerEnabled: true,
      scanned: 0,
      staleScanned: 0,
      queueScanned: 2,
      queueProcessed: 1,
      queueSkipped: 1,
      queueFailed: 0,
    }));
    expect(resourceRequestService.processDueProvisioningAutoRetries).not.toHaveBeenCalled();
    expect(resourceRequestService.recoverStaleProvisioningRuns).not.toHaveBeenCalled();
    expect(resourceRequestService.processNextQueuedProvisioningRun).toHaveBeenCalledTimes(3);
    expect(resourceRequestService.processNextQueuedProvisioningRun).toHaveBeenCalledWith(undefined, undefined, {});
  });
});

function createScheduler(configValues: Record<string, string> = {}) {
  const resourceRequestService = {
    processDueProvisioningAutoRetries: jest.fn().mockResolvedValue({
      scanned: 0,
      attempted: 0,
      completed: 0,
      blocked: 0,
      skipped: 0,
      failed: 0,
    }),
    recoverStaleProvisioningRuns: jest.fn().mockResolvedValue({
      scanned: 0,
      recovered: 0,
      requestUpdated: 0,
      skipped: 0,
      failed: 0,
    }),
    processNextQueuedProvisioningRun: jest.fn().mockResolvedValue({
      scanned: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      reason: 'queue_empty',
    }),
  };
  const configService = {
    get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback),
  };
  const service = new ResourceRequestProvisioningRetrySchedulerService(
    resourceRequestService as unknown as ResourceRequestService,
    configService as unknown as ConfigService,
  );

  return { service, resourceRequestService, configService };
}
