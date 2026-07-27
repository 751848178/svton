/**
 * ReleaseConcurrencyLease 仓储：基于唯一键的并发租约原子获取/释放/续约。
 * 所有方法接受 Prisma.TransactionClient 作为第一参数，使租约获取与
 * 阶段 CAS 在 coordinator 的同一 $transaction 内执行（F383 D2）。
 *
 * 关键不变式：同一 concurrencyKey 任意时刻至多一行（DB 唯一索引）。
 * 失败的 CAS 会让事务回滚，租约随之撤销——不再产生孤儿 attempt。
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { Prisma } from "@prisma/client";

const UNIQUE_CONSTRAINT_VIOLATION = "P2002";

export interface AcquireLeaseInput {
  concurrencyKey: string;
  releaseStageId: string;
  attemptId: string;
  owner: string;
  expiresAt: Date;
}

@Injectable()
export class ReleaseConcurrencyLeaseRepository {
  private readonly logger = new Logger(ReleaseConcurrencyLeaseRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // 事务内获取租约（CR-1-F1 根因修复）：
  // 旧实现先 deleteMany expiresAt<now 再 create —— 在 READ COMMITTED + 时钟漂移/慢心跳下
  // 可能删掉一个仍有效的租约 → 同一 concurrencyKey 出现两个并发赢家。新实现：
  //   1. 先尝试 create（happy path，没有竞争时最快）；
  //   2. 唯一键冲突（P2002）→ 尝试 CAS-steal：仅当现租约 expiresAt<now 时原子 updateMany
  //      改写 owner/releaseStageId/attemptId/expiresAt。count>0 → 抢占成功；count===0 → 干净落败；
  //   3. 非 P2002 错误向上抛。
  // 这样任何时刻一个 concurrencyKey 至多一个有效持有者；过期租约由恢复调度器 sweepExpired 清扫。
  async acquireWithinTx(
    tx: Prisma.TransactionClient,
    input: AcquireLeaseInput,
  ): Promise<boolean> {
    try {
      await tx.releaseConcurrencyLease.create({
        data: {
          concurrencyKey: input.concurrencyKey,
          releaseStageId: input.releaseStageId,
          attemptId: input.attemptId,
          owner: input.owner,
          expiresAt: input.expiresAt,
        },
      });
      return true;
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code !== UNIQUE_CONSTRAINT_VIOLATION) throw err;
    }
    // 唯一键冲突：尝试 CAS 抢占已过期租约
    const stolen = await tx.releaseConcurrencyLease.updateMany({
      where: { concurrencyKey: input.concurrencyKey, expiresAt: { lt: new Date() } },
      data: {
        releaseStageId: input.releaseStageId,
        attemptId: input.attemptId,
        owner: input.owner,
        expiresAt: input.expiresAt,
        acquiredAt: new Date(),
        heartbeatAt: null,
      },
    });
    return stolen.count > 0;
  }

  // 事务内释放租约：仅删除当前 owner 持有的行（安全：他者租约不受影响）
  async releaseWithinTx(
    tx: Prisma.TransactionClient,
    concurrencyKey: string,
    owner: string,
  ): Promise<void> {
    await tx.releaseConcurrencyLease.deleteMany({
      where: { concurrencyKey, owner },
    });
  }

  // 事务内续约：仅当仍是当前 owner 且行存在时更新（心跳续命）
  async renewWithinTx(
    tx: Prisma.TransactionClient,
    concurrencyKey: string,
    owner: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const r = await tx.releaseConcurrencyLease.updateMany({
      where: { concurrencyKey, owner },
      data: { expiresAt, heartbeatAt: new Date() },
    });
    return r.count > 0;
  }

  // 释放全部当前 owner 名下的租约（非事务便捷入口，用于收尾/取消）
  async releaseByOwner(owner: string): Promise<number> {
    const r = await this.prisma.releaseConcurrencyLease.deleteMany({
      where: { owner },
    });
    return r.count;
  }

  // 清理所有已过期租约（恢复扫描入口调用）
  async sweepExpired(): Promise<number> {
    const r = await this.prisma.releaseConcurrencyLease.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return r.count;
  }
}
