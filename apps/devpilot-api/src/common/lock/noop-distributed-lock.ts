import { Injectable } from '@nestjs/common';
import { DISTRIBUTED_LOCK, DistributedLock, LockHandle } from './distributed-lock';

/**
 * 空操作的分布式锁：`acquire` 始终返回成功句柄，`release` no-op。
 *
 * 当 Redis 未配置或连接失败时作为降级实现注入，
 * 让 `acquireLiveLease` 回退到纯 DB lease 的 compare-and-set 互斥。
 */
@Injectable()
export class NoopDistributedLock implements DistributedLock {
  async acquire(resource: string, _ttlMs?: number): Promise<LockHandle | null> {
    return { resource };
  }

  async release(_handle?: LockHandle): Promise<void> {
    // no-op
  }
}
