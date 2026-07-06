import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import Redlock, { type Lock as RedlockLock } from 'redlock';
import { DISTRIBUTED_LOCK, DistributedLock, LockHandle } from './distributed-lock';

/**
 * 基于 redlock（Redis）的分布式锁实现。
 *
 * 在 DB lease 行（`serverExecutionLease`，承担审计持久化）之上叠加 redlock 强一致互斥：
 * 多实例 worker 并发时，redlock 保证只有一个能获取锁并写 lease 行，
 * 避免纯 DB compare-and-set 在时钟漂移/竞态下的窗口。
 *
 * 降级策略：redlock 操作抛错（Redis 不可用等）时，`acquire` 返回 null，
 * 调用方回退到纯 DB lease 路径（单实例安全、多实例弱一致），不阻断业务。
 */
@Injectable()
export class RedlockDistributedLock implements DistributedLock, OnModuleDestroy {
  private readonly logger = new Logger(RedlockDistributedLock.name);
  private readonly redlock: Redlock;
  /** 缓存 resource → 当前持有的 lock，便于 release */
  private readonly held = new Map<string, RedlockLock>();

  constructor(redis: Redis) {
    // driftFactor=0.01, retryCount=0（不内部重试，由调用方决定降级）, retryDelay=200
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 0,
      retryJitter: 0,
      retryDelay: 200,
      automaticExtensionThreshold: 500,
    });
  }

  async acquire(resource: string, ttlMs: number): Promise<LockHandle | null> {
    try {
      const lock = await this.redlock.acquire([this.scopedKey(resource)], ttlMs);
      this.held.set(resource, lock);
      return { resource, internal: lock };
    } catch (error) {
      // 锁被占用（竞争失败）或 Redis 故障——都返回 null，调用方按 DB lease 结果决定。
      this.logger.debug(
        `redlock acquire failed for ${resource}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async release(handle: LockHandle): Promise<void> {
    const lock = this.held.get(handle.resource) ?? (handle.internal as RedlockLock | undefined);
    if (!lock) return;
    this.held.delete(handle.resource);
    try {
      await lock.release();
    } catch (error) {
      // 锁可能已过期被自动释放，或 Redis 故障——best-effort，仅记录。
      this.logger.debug(
        `redlock release failed for ${handle.resource}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    // 释放所有仍持有的锁
    for (const handle of this.held.values()) {
      try {
        await handle.release();
      } catch {
        // ignore
      }
    }
    this.held.clear();
  }

  /** 给 key 加命名空间前缀，避免与其他用途的 Redis key 冲突。 */
  private scopedKey(resource: string): string {
    return `devpilot:lock:${resource}`;
  }
}
