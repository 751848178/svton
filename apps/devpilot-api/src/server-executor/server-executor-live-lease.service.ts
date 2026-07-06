import { DistributedLock, LockHandle } from "../common/lock/distributed-lock";
import { PrismaService } from "../prisma/prisma.service";
import {
  AcquireLeaseInput,
  JobQueuePort,
  LeaseRecord,
} from "./queue/job-queue.port";
import { buildServerExecutorConcurrencyBlockedResult } from "./server-executor-blocked-result.utils";
import { toJsonValue } from "./server-executor-json.utils";
import {
  buildServerExecutorBlockedLeaseData,
  buildServerExecutorBlockingLeaseRecord,
  buildServerExecutorLiveLeaseActiveKey,
  buildServerExecutorLiveLeaseInput,
  isPrismaUniqueConstraintError,
} from "./server-executor-live-lease.utils";
import {
  ServerExecutionInput,
  ServerExecutionResult,
} from "./server-executor.types";

export type ServerExecutorLiveLeaseAcquireResult = {
  lease?: LeaseRecord;
  lock?: LockHandle;
  blocked?: ServerExecutionResult;
};

type AcquireServerExecutorLiveLeaseOptions = {
  leaseTtlMs: number;
};

export class ServerExecutorLiveLeaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly distributedLock: DistributedLock,
    private readonly jobQueue?: JobQueuePort,
  ) {}

  async acquire(
    input: ServerExecutionInput,
    { leaseTtlMs }: AcquireServerExecutorLiveLeaseOptions,
  ): Promise<ServerExecutorLiveLeaseAcquireResult> {
    if (
      input.dryRun ||
      input.target.transport !== "ssh" ||
      !input.target.serverId
    ) {
      return {};
    }

    const now = new Date();
    await this.expire(now);
    const activeKey = buildServerExecutorLiveLeaseActiveKey(
      input.teamId,
      input.target.serverId,
    );
    const lockHandle = await this.distributedLock.acquire(
      activeKey,
      leaseTtlMs + 30_000,
    );
    const leaseInput = buildServerExecutorLiveLeaseInput(
      input,
      activeKey,
      leaseTtlMs,
    );

    if (this.jobQueue) {
      return this.acquireViaJobQueue(input, now, leaseInput, lockHandle);
    }
    return this.acquireViaPrisma(input, now, leaseInput, lockHandle);
  }

  async release(
    lease: LeaseRecord | undefined,
    status: ServerExecutionResult["status"],
    lock?: LockHandle,
  ) {
    if (lock) await this.distributedLock.release(lock);
    if (!lease) return;

    if (this.jobQueue) {
      await this.jobQueue.releaseLiveLease(lease.id, status);
      return;
    }
    await this.prisma.serverExecutionLease.updateMany({
      where: { id: lease.id, status: "running" },
      data: { status, activeKey: null, releasedAt: new Date() },
    });
  }

  async expire(now: Date, teamId?: string) {
    if (this.jobQueue) {
      return this.jobQueue.expireStaleLeases(now, teamId);
    }
    return this.prisma.serverExecutionLease.updateMany({
      where: {
        teamId,
        status: "running",
        expiresAt: { lte: now },
      },
      data: {
        status: "expired",
        activeKey: null,
        releasedAt: now,
      },
    });
  }

  private async acquireViaJobQueue(
    input: ServerExecutionInput,
    now: Date,
    leaseInput: AcquireLeaseInput,
    lockHandle: LockHandle | null,
  ): Promise<ServerExecutorLiveLeaseAcquireResult> {
    const result = await this.jobQueue?.acquireLiveLease(leaseInput);
    if (result?.lease) {
      return { lease: result.lease, lock: lockHandle ?? undefined };
    }
    if (!result?.blocked) return {};

    const blockedLease = await this.prisma.serverExecutionLease.create({
      data: buildServerExecutorBlockedLeaseData(
        input,
        now,
        leaseInput,
        result.blocked,
      ),
      select: { id: true },
    });
    if (lockHandle) await this.distributedLock.release(lockHandle);
    const blocked = result.blocked;
    return {
      blocked: buildServerExecutorConcurrencyBlockedResult(
        input,
        buildServerExecutorBlockingLeaseRecord(input, now, blocked),
        blockedLease.id,
      ),
    };
  }

  private async acquireViaPrisma(
    input: ServerExecutionInput,
    now: Date,
    leaseInput: AcquireLeaseInput,
    lockHandle: LockHandle | null,
  ): Promise<ServerExecutorLiveLeaseAcquireResult> {
    const expiresAt = new Date(now.getTime() + leaseInput.ttlMs);
    try {
      const lease = await this.prisma.serverExecutionLease.create({
        data: {
          teamId: leaseInput.teamId,
          actorId: input.userId ?? undefined,
          serverId: leaseInput.serverId,
          activeKey: leaseInput.activeKey,
          operationKey: leaseInput.operationKey,
          adapterKey: leaseInput.adapterKey,
          transport: leaseInput.transport,
          dryRun: leaseInput.dryRun,
          status: "running",
          expiresAt,
          metadata: toJsonValue(leaseInput.metadata),
        },
        select: {
          id: true,
          operationKey: true,
          adapterKey: true,
          acquiredAt: true,
          expiresAt: true,
        },
      });
      return { lease, lock: lockHandle ?? undefined };
    } catch (error) {
      if (lockHandle) await this.distributedLock.release(lockHandle);
      if (!isPrismaUniqueConstraintError(error)) throw error;
      return {
        blocked: buildServerExecutorConcurrencyBlockedResult(
          input,
          null,
          "blocked-fallback",
        ),
      };
    }
  }
}
