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

  // 事务内获取租约：先清理已过期租约（避免崩溃 owner 长期阻塞），
  // 再尝试 create。唯一键冲突返回 false，由调用方决定是否回滚业务。
  async acquireWithinTx(
    tx: Prisma.TransactionClient,
    input: AcquireLeaseInput,
  ): Promise<boolean> {
    await tx.releaseConcurrencyLease.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
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
      if (code === UNIQUE_CONSTRAINT_VIOLATION) {
        return false;
      }
      throw err;
    }
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
