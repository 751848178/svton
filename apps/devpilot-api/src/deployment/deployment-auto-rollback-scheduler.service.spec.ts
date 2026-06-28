import { ConfigService } from '@nestjs/config';
import { DeploymentAutoRollbackSchedulerService } from './deployment-auto-rollback-scheduler.service';
import { DeploymentService } from './deployment.service';

describe('DeploymentAutoRollbackSchedulerService', () => {
  let deploymentService: { processSmokeFailureAutoRollbacks: jest.Mock };
  let config: { get: jest.Mock };
  let service: DeploymentAutoRollbackSchedulerService;

  beforeEach(() => {
    deploymentService = {
      processSmokeFailureAutoRollbacks: jest.fn().mockResolvedValue({
        scanned: 0,
        attempted: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        results: [],
      }),
    };
    config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_ENABLED: 'true',
          DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_INTERVAL_SECONDS: '60',
          DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_BATCH_SIZE: '5',
        };
        return values[key] ?? fallback;
      }),
    };
    service = new DeploymentAutoRollbackSchedulerService(
      deploymentService as unknown as DeploymentService,
      config as unknown as ConfigService,
    );
  });

  it('returns disabled summary when scheduler is off', async () => {
    config.get.mockImplementation((key: string, fallback?: string) => (
      key === 'DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_ENABLED' ? 'false' : fallback
    ));

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: false,
      scanned: 0,
      attempted: 0,
      created: 0,
      skippedRuns: 0,
      failed: 0,
    });
    expect(deploymentService.processSmokeFailureAutoRollbacks).not.toHaveBeenCalled();
  });

  it('processes failed smoke checks in bounded batches', async () => {
    deploymentService.processSmokeFailureAutoRollbacks.mockResolvedValue({
      scanned: 5,
      attempted: 3,
      created: 2,
      skipped: 2,
      failed: 1,
      results: [],
    });

    await expect(service.runOnce()).resolves.toEqual({
      skipped: false,
      enabled: true,
      scanned: 5,
      attempted: 3,
      created: 2,
      skippedRuns: 2,
      failed: 1,
    });
    expect(deploymentService.processSmokeFailureAutoRollbacks).toHaveBeenCalledWith({
      limit: 5,
    });
  });

  it('returns skipped summary when a scheduler tick is already running', async () => {
    deploymentService.processSmokeFailureAutoRollbacks.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({
        scanned: 0,
        attempted: 0,
        created: 0,
        skipped: 0,
        failed: 0,
        results: [],
      }), 10);
    }));

    const first = service.runOnce();
    await expect(service.runOnce()).resolves.toEqual({
      skipped: true,
      enabled: true,
      scanned: 0,
      attempted: 0,
      created: 0,
      skippedRuns: 0,
      failed: 0,
    });
    await first;
  });
});
