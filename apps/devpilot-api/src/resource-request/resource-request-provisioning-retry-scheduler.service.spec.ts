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
      scanned: 0,
      staleScanned: 0,
    }));
    expect(resourceRequestService.processDueProvisioningAutoRetries).not.toHaveBeenCalled();
    expect(resourceRequestService.recoverStaleProvisioningRuns).not.toHaveBeenCalled();
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
      scanned: 0,
      staleScanned: 2,
      staleRecovered: 2,
      staleRequestUpdated: 1,
      staleSkipped: 1,
      staleFailed: 0,
    }));
    expect(resourceRequestService.processDueProvisioningAutoRetries).not.toHaveBeenCalled();
    expect(resourceRequestService.recoverStaleProvisioningRuns).toHaveBeenCalledWith({
      limit: 7,
      staleAfterSeconds: 120,
    });
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
