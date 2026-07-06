import { PrismaService } from '../prisma/prisma.service';
import { ResourceControlCloudProviderHealthService } from './resource-control-cloud-provider-health.service';

describe('ResourceControlCloudProviderHealthService', () => {
  it('lists recent cloud sync runs with the provider health projection', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new ResourceControlCloudProviderHealthService({
      resourceSyncRun: { findMany },
    } as unknown as PrismaService);

    await service.listRuns('team-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { teamId: 'team-1', sourceType: 'cloud' },
      orderBy: { startedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        provider: true,
        status: true,
        discovered: true,
        error: true,
        metadata: true,
        startedAt: true,
        finishedAt: true,
      },
    });
  });

  it('summarizes provider failure and live inventory signals', () => {
    const service = new ResourceControlCloudProviderHealthService({} as PrismaService);

    expect(
      service.summarize([
        {
          id: 'run-1',
          provider: 'aliyun-rds',
          status: 'completed',
          discovered: 2,
          error: null,
          metadata: {
            providers: [
              {
                provider: 'aliyun-rds',
                syncMode: 'cloud_sdk_live',
                live: true,
                sdk: '@alicloud/pop-core',
                regions: ['cn-hangzhou'],
              },
            ],
          },
          startedAt: new Date('2026-07-05T01:00:00Z'),
          finishedAt: new Date('2026-07-05T01:01:00Z'),
        },
        {
          id: 'run-2',
          provider: 'aliyun-rds',
          status: 'completed',
          discovered: 0,
          error: null,
          metadata: {
            providers: [
              {
                provider: 'aliyun-rds',
                syncMode: 'cloud_inventory_stub_fallback',
                fallbackReason: 'Aliyun RDS live inventory failed: quota timeout',
                live: false,
                regions: ['cn-hangzhou'],
              },
            ],
          },
          startedAt: new Date('2026-07-05T02:00:00Z'),
          finishedAt: new Date('2026-07-05T02:01:00Z'),
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        provider: 'aliyun-rds',
        status: 'error',
        totalRuns: 2,
        liveRuns: 1,
        fallbackRuns: 1,
        providerFailureCount: 1,
        quotaSignals: 1,
        timeoutSignals: 1,
        regions: ['cn-hangzhou'],
      }),
    ]);
  });
});
