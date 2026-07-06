import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResourceProvisioningRunSupervisorQueryDto } from './dto/resource-request.dto';
import {
  JsonRecord,
  ProvisioningRunStatusCounts,
} from './resource-provisioning-run.types';
import {
  readProvisioningListLimit,
  readProvisioningSchedulerConfig,
  readStaleProvisioningRunAfterSeconds,
} from './resource-provisioning-run-supervisor-config.utils';

/**
 * Read-only supervisor snapshot for provisioning runs. Owns the team-scoped
 * status/sample queries; the host executor supplies `serializeProvisioningRun`
 * so the snapshot response shape stays unchanged.
 */
@Injectable()
export class ResourceProvisioningRunSupervisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getSupervisorSnapshot(
    teamId: string,
    query: ResourceProvisioningRunSupervisorQueryDto,
    serializeProvisioningRun: (run: JsonRecord) => unknown,
  ) {
    const now = new Date();
    const staleAfterSeconds = readStaleProvisioningRunAfterSeconds(
      this.configService,
      query.staleAfterSeconds,
    );
    const staleBefore = new Date(now.getTime() - staleAfterSeconds * 1000);
    const sampleLimit = readProvisioningListLimit(query.sampleLimit, 5, 20);
    const countWhere = (status: string): Record<string, unknown> => ({
      teamId,
      status,
      mode: { in: ['api', 'webhook'] },
    });
    const include = {
      actor: { select: { id: true, name: true, email: true } },
      resourceType: { select: { id: true, key: true, name: true } },
      _count: { select: { replayAttempts: true } },
    };

    const counts = await this.readCounts(countWhere, staleBefore);
    const samples = await this.readSamples(
      countWhere,
      staleBefore,
      sampleLimit,
      teamId,
      include,
    );

    const statusCounts: ProvisioningRunStatusCounts = counts;
    return {
      generatedAt: now.toISOString(),
      staleAfterSeconds,
      staleBefore: staleBefore.toISOString(),
      scheduler: readProvisioningSchedulerConfig(this.configService),
      counts: statusCounts,
      samples: {
        queued: samples.queuedSamples.map((run: JsonRecord) =>
          serializeProvisioningRun(run),
        ),
        staleRunning: samples.staleSamples.map((run: JsonRecord) =>
          serializeProvisioningRun(run),
        ),
        recentProblems: samples.recentProblemRuns.map((run: JsonRecord) =>
          serializeProvisioningRun(run),
        ),
      },
    };
  }

  private async readCounts(
    countWhere: (status: string) => Record<string, unknown>,
    staleBefore: Date,
  ): Promise<ProvisioningRunStatusCounts> {
    const [queued, running, staleRunning, planned, blocked, failed, completed] =
      await Promise.all([
        this.count(countWhere('queued')),
        this.count(countWhere('running')),
        this.count({
          ...countWhere('running'),
          startedAt: { lt: staleBefore },
        }),
        this.count(countWhere('planned')),
        this.count(countWhere('blocked')),
        this.count(countWhere('failed')),
        this.count(countWhere('completed')),
      ]);
    return {
      queued,
      running,
      staleRunning,
      planned,
      blocked,
      failed,
      completed,
    };
  }

  private async readSamples(
    countWhere: (status: string) => Record<string, unknown>,
    staleBefore: Date,
    sampleLimit: number,
    teamId: string,
    include: object,
  ) {
    const [queuedSamples, staleSamples, recentProblemRuns] = await Promise.all([
      this.prisma.resourceProvisioningRun.findMany({
        where: countWhere('queued'),
        orderBy: [{ availableAt: 'asc' }, { startedAt: 'asc' }],
        take: sampleLimit,
        include,
      }),
      this.prisma.resourceProvisioningRun.findMany({
        where: { ...countWhere('running'), startedAt: { lt: staleBefore } },
        orderBy: { startedAt: 'asc' },
        take: sampleLimit,
        include,
      }),
      this.prisma.resourceProvisioningRun.findMany({
        where: {
          teamId,
          mode: { in: ['api', 'webhook'] },
          status: { in: ['blocked', 'failed'] },
        },
        orderBy: { startedAt: 'desc' },
        take: sampleLimit,
        include: {
          ...include,
          replayOf: {
            select: {
              id: true,
              status: true,
              trigger: true,
              providerRunId: true,
              startedAt: true,
            },
          },
        },
      }),
    ]);
    return { queuedSamples, staleSamples, recentProblemRuns };
  }

  private count(where: Record<string, unknown>) {
    return this.prisma.resourceProvisioningRun.count({ where } as never);
  }
}
