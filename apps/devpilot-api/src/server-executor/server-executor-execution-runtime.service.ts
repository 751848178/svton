import { NotFoundException } from "@nestjs/common";
import type { LockHandle } from "../common/lock/distributed-lock";
import type { LeaseRecord } from "./queue/job-queue.port";
import { ServerExecutorJobHeartbeatService } from "./server-executor-job-heartbeat.service";
import { ServerExecutorLiveLeaseService } from "./server-executor-live-lease.service";
import type {
  ServerExecutionInput,
  ServerExecutionResult,
  ServerExecutorAdapter,
} from "./server-executor.types";

export type ServerExecutorRuntimeLease = LeaseRecord;
export type ServerExecutorRuntimeLeaseLock = LockHandle;

export class ServerExecutorExecutionRuntimeService {
  constructor(
    private readonly adapters: ServerExecutorAdapter[],
    private readonly liveLeaseService: ServerExecutorLiveLeaseService,
    private readonly jobHeartbeatService: ServerExecutorJobHeartbeatService,
    private readonly workerId: string,
    private readonly leaseTtlMs: () => number,
    private readonly queueLockHeartbeatMs: () => number,
    private readonly lockExpiresAt: (now: Date) => Date,
  ) {}

  resolveAdapter(input: ServerExecutionInput) {
    const adapter = this.adapters.find((candidate) =>
      candidate.supports(input),
    );
    if (!adapter) {
      throw new NotFoundException(
        `没有可用的 Server executor adapter: ${input.target.transport}`,
      );
    }
    return adapter;
  }

  acquireLiveLease(input: ServerExecutionInput) {
    return this.liveLeaseService.acquire(input, {
      leaseTtlMs: this.leaseTtlMs(),
    });
  }

  releaseLiveLease(
    lease: ServerExecutorRuntimeLease | undefined,
    status: ServerExecutionResult["status"],
    lock?: ServerExecutorRuntimeLeaseLock,
  ) {
    return this.liveLeaseService.release(lease, status, lock);
  }

  expireStaleLeases(now: Date, teamId?: string) {
    return this.liveLeaseService.expire(now, teamId);
  }

  startJobHeartbeat(jobId: string) {
    return this.jobHeartbeatService.start({
      jobId,
      workerId: this.workerId,
      intervalMs: this.queueLockHeartbeatMs(),
      lockExpiresAt: this.lockExpiresAt,
    });
  }

  extendJobLock(jobId: string) {
    return this.jobHeartbeatService.extend(
      jobId,
      this.workerId,
      this.lockExpiresAt,
    );
  }
}
