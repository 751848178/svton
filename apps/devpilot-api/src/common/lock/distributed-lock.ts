/**
 * 分布式锁端口（抽象）。
 *
 * 用于在多实例部署下对共享资源（如"某台服务器的 live SSH 执行"）做强一致互斥。
 * `server-executor` 的 `acquireLiveLease` 在写 DB lease 行（审计持久化）之前，
 * 先通过此端口获取分布式锁，确保即使多个 worker 实例并发也不会同时操作同一服务器。
 *
 * 设计为可选叠加：当 Redis 不可用时降级为 `NoopDistributedLock`（acquire 始终成功），
 * 回退到纯 DB lease 的 compare-and-set 互斥（单实例安全、多实例弱一致）。
 */
export const DISTRIBUTED_LOCK = Symbol('DISTRIBUTED_LOCK');

export interface LockHandle {
  /** 资源 key（如 `teamId:serverId`）。 */
  resource: string;
  /** 内部锁句柄（redlock 的 Lock 对象），release 时用。 */
  internal?: unknown;
}

export interface DistributedLock {
  /**
   * 尝试获取 `resource` 的独占锁，TTL 为 `ttlMs`。
   * 返回 LockHandle 表示成功；返回 null 表示已被占用（或底层不可用，降级）。
   * 不抛错——Redis 故障时返回 null 让调用方降级到 DB lease。
   */
  acquire(resource: string, ttlMs: number): Promise<LockHandle | null>;

  /**
   * 释放锁。best-effort：失败仅记录日志，不抛错。
   */
  release(handle: LockHandle): Promise<void>;
}
