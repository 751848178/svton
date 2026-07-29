/**
 * 阶段原子认领服务（F383 D2/D8/P0-1/P1-4）：把“读阶段 → 检查幂等/活跃 →
 * 获取并发租约 → CAS 阶段状态 → 创建 attempt → 标记租约 attemptId → 写事件”
 * 全部收敛进单个 prisma.$transaction。CAS 失败 → 事务回滚 → 租约自动撤销，
 * 杜绝孤儿 attempt。
 *
 * 200 行内专注单一职责：原子 claim。后续的 startAttempt/finishAttempt 仍在
 * ReleaseCoordinatorService 中。
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseConcurrencyLeaseRepository } from "./repository/release-concurrency-lease.repository";
import { RELEASE_AUDIT_ACTIONS } from "./types/release-orchestration.types";

const LEASE_MS = 15 * 60 * 1000;
const CLAIMABLE_FROM = ["pending", "blocked", "failed", "ready", "awaiting_approval"] as const;
const ACTIVE_ATTEMPT_STATUSES = ["queued", "running"] as const;

export type ClaimOutcome =
  | { kind: "won"; attemptId: string; attemptNo: number; owner: string; leaseExpiresAt: Date }
  | { kind: "already-succeeded" }
  | { kind: "already-active" }
  | { kind: "concurrency-busy" }
  | { kind: "cas-lost" };

export interface ClaimRequest {
  stageId: string;
  teamId: string;
  actorId?: string | null;
  // 已批准且未消费的阶段绑定审批（attempt 创建时绑定；null 表示无需绑定）
  approvalId?: string | null;
}

@Injectable()
export class ReleaseStageClaimService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leaseRepo: ReleaseConcurrencyLeaseRepository,
  ) {}

  // 原子认领：成功返回 won+attemptId；失败返回原因（不抛错）。所有副作用在同一事务。
  async claimAtomically(input: ClaimRequest): Promise<ClaimOutcome> {
    const owner = `release-coordinator:${process.pid}:${Date.now()}`;
    const leaseExpiresAt = new Date(Date.now() + LEASE_MS);

    try {
      return await this.runClaimTx(input, owner, leaseExpiresAt);
    } catch (err) {
      // 并发竞态：两个事务同时争同一 concurrencyKey 唯一键时，MySQL 可能抛
      // deadlock（P2034）或写冲突（P2034）而非 P2002。视为未获取租约，
      // 由调用方按 concurrency-busy 处理——不产生孤儿。
      const code = (err as { code?: string } | null)?.code;
      if (code === "P2034" || code === "P2031") {
        return { kind: "concurrency-busy" };
      }
      throw err;
    }
  }

  private async runClaimTx(
    input: ClaimRequest,
    owner: string,
    leaseExpiresAt: Date,
  ): Promise<ClaimOutcome> {
    return this.prisma.$transaction(async (tx) => {
      // 1. 事务内重读阶段（含 attempts、concurrencyLeases）
      const stage = await tx.releaseStage.findUniqueOrThrow({
        where: { id: input.stageId },
        include: { attempts: true, concurrencyLeases: true },
      });
      // 2. 幂等短路：阶段已有 succeeded attempt（D8）
      if (stage.attempts.some((a) => a.status === "succeeded")) {
        return { kind: "already-succeeded" as const };
      }
      // 3. 非终态活跃 attempt 已存在：不重复认领
      if (stage.attempts.some((a) => ACTIVE_ATTEMPT_STATUSES.includes(a.status as never))) {
        return { kind: "already-active" as const };
      }
      // 4. 并发租约：先于 CAS 获取。失败 → concurrency-busy；CAS 失败事务回滚，
      //    租约随事务撤销，绝不留孤儿。
      if (stage.concurrencyKey) {
        const won = await this.leaseRepo.acquireWithinTx(tx, {
          concurrencyKey: stage.concurrencyKey,
          releaseStageId: stage.id,
          attemptId: "<pending>",
          owner,
          expiresAt: leaseExpiresAt,
        });
        if (!won) return { kind: "concurrency-busy" as const };
      }
      // 5. CAS：阶段状态 pending/blocked/failed/ready → queued（含 pending，P0-1 根因修复）
      const attemptNo = stage.currentAttempt + 1;
      const cas = await tx.releaseStage.updateMany({
        where: { id: stage.id, status: { in: [...CLAIMABLE_FROM] } },
        data: { status: "queued", currentAttempt: attemptNo, blockedReason: null },
      });
      if (cas.count === 0) return { kind: "cas-lost" as const };
      // 6. CAS 赢了之后才创建 attempt
      const attempt = await tx.releaseStageAttempt.create({
        data: {
          releaseStageId: stage.id,
          teamId: input.teamId,
          attemptNo,
          status: "queued",
          operationApprovalId: input.approvalId ?? null,
          inputSnapshot: { configHash: stage.configHash } as never,
          leaseOwner: owner,
          leaseExpiresAt,
        },
      });
      // 7. 用真实 attemptId 回填租约（占位符 → attempt.id）
      if (stage.concurrencyKey) {
        await tx.releaseConcurrencyLease.update({
          where: { concurrencyKey: stage.concurrencyKey },
          data: { attemptId: attempt.id },
        });
      }
      // 8. 事件 IN TX（P1-7）
      await tx.releaseEvent.create({
        data: {
          releasePlanId: stage.releasePlanId,
          releaseStageId: stage.id,
          stageAttemptId: attempt.id,
          teamId: input.teamId,
          eventType: RELEASE_AUDIT_ACTIONS.stage_claimed,
          actorId: input.actorId ?? null,
          summary: `阶段 ${stage.key} 排队（attempt ${attemptNo}）`,
        },
      });
      return {
        kind: "won" as const,
        attemptId: attempt.id,
        attemptNo,
        owner,
        leaseExpiresAt,
      };
    });
  }
}
