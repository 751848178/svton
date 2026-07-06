import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { DbLiveLeaseRepository } from "./db-live-lease.repository";
import { DbQueuedJobRepository } from "./db-queued-job.repository";
import {
  AcquireLeaseInput,
  AcquireLeaseResult,
  ClaimedJob,
  JobCompletionData,
  JobQueuePort,
  RecoveredJob,
} from "./job-queue.port";

@Injectable()
export class DbJobQueue implements JobQueuePort {
  private readonly logger = new Logger(DbJobQueue.name);
  private readonly workerId = `server-executor-${randomUUID()}`;
  private readonly queuedJobs: DbQueuedJobRepository;
  private readonly liveLeases: DbLiveLeaseRepository;

  constructor(prisma: PrismaService, configService: ConfigService) {
    this.queuedJobs = new DbQueuedJobRepository(
      prisma,
      configService,
      this.workerId,
      this.logger,
    );
    this.liveLeases = new DbLiveLeaseRepository(prisma);
  }

  claimNextDueJob(teamId?: string): Promise<ClaimedJob | null> {
    return this.queuedJobs.claimNextDueJob(teamId);
  }

  extendJobLock(jobId: string): Promise<void> {
    return this.queuedJobs.extendJobLock(jobId);
  }

  completeJob(
    jobId: string,
    status: "completed" | "failed" | "cancelled",
    data: JobCompletionData,
  ): Promise<void> {
    return this.queuedJobs.completeJob(jobId, status, data);
  }

  recoverStaleJobs(teamId?: string): Promise<RecoveredJob[]> {
    return this.queuedJobs.recoverStaleJobs(teamId);
  }

  acquireLiveLease(input: AcquireLeaseInput): Promise<AcquireLeaseResult> {
    return this.liveLeases.acquireLiveLease(input);
  }

  releaseLiveLease(leaseId: string, status: string): Promise<void> {
    return this.liveLeases.releaseLiveLease(leaseId, status);
  }

  expireStaleLeases(now: Date, teamId?: string): Promise<number> {
    return this.liveLeases.expireStaleLeases(now, teamId);
  }
}
