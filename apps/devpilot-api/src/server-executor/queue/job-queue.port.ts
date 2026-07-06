import type { Prisma } from "@prisma/client";

/**
 * NestJS 注入 token（因 `JobQueuePort` 是 interface，不能直接作为 provider token）。
 */
export const JOB_QUEUE_PORT = Symbol("JOB_QUEUE_PORT");

/**
 * Server execution job 队列端口（抽象）。
 *
 * 把 `ServerExecutorService` 对"job 如何被 claim/续租/释放/恢复"的依赖收敛成接口，
 * 使队列实现可在 DB（当前 `DbJobQueue`，基于 `serverExecutionJob` 表的 compare-and-set）
 * 与未来基于 Redis/bullmq 的实现之间替换。
 *
 * 这 4 个原语是 bullmq 的天然映射：
 *  - {@link claimNextDueJob} ≈ bullmq Worker 的 getNextJob
 *  - {@link extendJobLock} ≈ bullmq job 的 heartbeat/extendLock
 *  - {@link completeJob} / {@link failJob} ≈ bullmq job.moveToCompleted/Failed
 *  - {@link recoverStaleJobs} ≈ bullmq 的 stalled job recovery
 *
 * lease（{@link acquireLiveLease} 等 server 级并发互斥）不属于 job queue 概念，
 * 由 `ServerExecutorLiveLeaseService` 编排，端口只提供可替换的持久化原语。
 */
export interface JobQueuePort {
  /**
   * 原子领取下一个到期（availableAt <= now）的 queued job，标记为 running 并绑定 worker。
   * 并发安全：用 compare-and-set 保证一个 job 只被一个 worker 领取。
   * 返回 null 表示无到期 job。
   */
  claimNextDueJob(teamId?: string): Promise<ClaimedJob | null>;

  /**
   * 续租 job 锁（心跳）。延长 lockExpiresAt，更新 lastHeartbeatAt。
   * 仅当 job 仍为 running 且属于当前 worker 时生效。
   */
  extendJobLock(jobId: string): Promise<void>;

  /**
   * 标记 job 完成（终态）。释放锁。
   */
  completeJob(
    jobId: string,
    status: "completed" | "failed" | "cancelled",
    data: JobCompletionData,
  ): Promise<void>;

  /**
   * 清扫锁过期但仍为 running 的 job，重置为可重试。
   * 返回恢复的 job id 列表（供调用方做远程 cleanup / 审计）。
   */
  recoverStaleJobs(teamId?: string): Promise<RecoveredJob[]>;

  // ---------- Lease 原语 ----------

  /**
   * 获取 server 级 live 执行租约（DB unique constraint 保证同 server 同时只有一个 running）。
   * 被占用时返回 blocked（含 blocking lease 信息），不抛错。
   */
  acquireLiveLease(input: AcquireLeaseInput): Promise<AcquireLeaseResult>;

  /**
   * 释放租约（标记终态 status，清除 activeKey）。
   * 仅当 lease 仍为 running 时生效（compare-and-set）。
   */
  releaseLiveLease(leaseId: string, status: string): Promise<void>;

  /**
   * 清扫过期的 running 租约（worker 崩溃后残留）。
   */
  expireStaleLeases(now: Date, teamId?: string): Promise<number>;
}

export interface ClaimedJob {
  id: string;
  teamId: string;
  actorId: string | null;
  operationKey: string;
  adapterKey: string;
  attempt: number;
  maxAttempts: number;
  retryOfId: string | null;
  inputSnapshot: Prisma.JsonValue;
}

export interface JobCompletionData {
  status: "completed" | "failed" | "cancelled";
  commandPlan?: Prisma.InputJsonValue;
  logs?: Prisma.InputJsonValue;
  result?: Prisma.InputJsonValue;
  error?: string;
}

export interface RecoveredJob {
  jobId: string;
  teamId: string;
  operationKey: string;
}

// ---------- Lease 原语（server 级并发互斥的 DB 持久化层）----------

/** DB lease 记录（acquire 成功后返回给 service）。 */
export interface LeaseRecord {
  id: string;
  operationKey: string;
  adapterKey: string;
  acquiredAt: Date;
  expiresAt: Date;
}

/** acquireLiveLease 的输入（service 组装好的业务上下文）。 */
export interface AcquireLeaseInput {
  teamId: string;
  actorId?: string;
  serverId: string;
  activeKey: string;
  operationKey: string;
  adapterKey: string;
  transport: string;
  dryRun: boolean;
  ttlMs: number;
  /** 审计元数据（service 组装）。 */
  metadata: Record<string, unknown>;
}

/** acquireLiveLease 的结果。 */
export interface AcquireLeaseResult {
  /** 成功获取时返回 lease 记录。 */
  lease?: LeaseRecord;
  /** 被占用时返回 blocking lease 信息（service 用于构造 blocked 结果）。 */
  blocked?: {
    blockingLeaseId?: string;
    blockingOperationKey?: string;
    blockingAcquiredAt?: Date;
    blockingExpiresAt?: Date;
  };
}
