import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudProviderHealthRun } from './resource-control-cloud-provider-health.types';
import { summarizeCloudProviderHealthRuns } from './resource-control-cloud-provider-health.utils';

@Injectable()
export class ResourceControlCloudProviderHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async listRuns(teamId: string) {
    return this.prisma.resourceSyncRun.findMany({
      where: { teamId, sourceType: 'cloud' },
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
  }

  summarize(runs: CloudProviderHealthRun[]) {
    return summarizeCloudProviderHealthRuns(runs);
  }
}
