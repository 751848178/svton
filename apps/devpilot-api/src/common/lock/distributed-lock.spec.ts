import { NoopDistributedLock } from './noop-distributed-lock';
import { RedlockDistributedLock } from './redlock-distributed-lock';

/**
 * 分布式锁多实例并发互斥测试。
 *
 * RedlockDistributedLock 通过替换内部 redlock 为 fake（duck-typed acquire/release）
 * 验证：同一 key 第二次 acquire 返回 null（互斥）、release 后可重新 acquire、
 * Redis 故障时降级返回 null、key 加命名空间前缀。
 * NoopDistributedLock 验证降级路径（始终成功）。
 */

/** Duck-typed fake：模拟 redlock 的 acquire/release，用 Set 跟踪已持有 key。 */
function createFakeRedlock(shouldFail = false) {
  const held = new Set<string>();
  return {
    async acquire(resources: string[], _ttlMs: number) {
      if (shouldFail) throw new Error('redis connection refused');
      const key = resources.join(',');
      if (held.has(key)) {
        const err = new Error('The lock was unable to be acquired');
        (err as { name?: string }).name = 'ResourceLockedError';
        throw err;
      }
      held.add(key);
      return {
        resource: resources,
        async release() {
          held.delete(key);
        },
      };
    },
  };
}

/** 构造一个内部 redlock 已被替换为 fake 的 RedlockDistributedLock。 */
function createLockWithFakeRedlock(fakeRedlock: unknown) {
  // 构造时传一个 stub Redis（不会被用到，因为构造后立即覆盖 redlock 字段）。
  const stubRedis = { status: 'ready' } as never;
  const lock = new RedlockDistributedLock(stubRedis);
  // 覆盖内部 redlock 为 fake（duck-typed）。
  (lock as unknown as { redlock: unknown }).redlock = fakeRedlock;
  return lock;
}

describe('RedlockDistributedLock multi-instance mutex', () => {
  it('allows the first acquire and blocks the second on the same resource', async () => {
    const lock = createLockWithFakeRedlock(createFakeRedlock());

    const handle1 = await lock.acquire('team-1:server-1', 30_000);
    expect(handle1).not.toBeNull();
    expect(handle1!.resource).toBe('team-1:server-1');

    // 第二个实例并发 acquire 同一资源 → 应被互斥（返回 null）
    const handle2 = await lock.acquire('team-1:server-1', 30_000);
    expect(handle2).toBeNull();
  });

  it('allows re-acquiring a resource after release', async () => {
    const lock = createLockWithFakeRedlock(createFakeRedlock());

    const handle1 = await lock.acquire('team-1:server-1', 30_000);
    expect(handle1).not.toBeNull();
    await lock.release(handle1!);

    // 释放后可重新获取
    const handle2 = await lock.acquire('team-1:server-1', 30_000);
    expect(handle2).not.toBeNull();
    await lock.release(handle2!);
  });

  it('allows concurrent acquires on different resources', async () => {
    const lock = createLockWithFakeRedlock(createFakeRedlock());

    const h1 = await lock.acquire('team-1:server-1', 30_000);
    const h2 = await lock.acquire('team-1:server-2', 30_000);
    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();
    await lock.release(h1!);
    await lock.release(h2!);
  });

  it('degrades to null when Redis is unavailable (acquire does not throw)', async () => {
    const lock = createLockWithFakeRedlock(createFakeRedlock(true));

    await expect(lock.acquire('team-1:server-1', 30_000)).resolves.toBeNull();
  });

  it('release is best-effort and does not throw on unknown handle', async () => {
    const lock = createLockWithFakeRedlock(createFakeRedlock());

    await expect(lock.release({ resource: 'unknown' })).resolves.toBeUndefined();
  });

  it('scopes keys with a namespace prefix to avoid collisions', async () => {
    const acquireCalls: string[][] = [];
    const fakeRedlock = {
      async acquire(resources: string[], _ttl: number) {
        acquireCalls.push([...resources]);
        return { resource: resources, async release() {} };
      },
    };
    const lock = createLockWithFakeRedlock(fakeRedlock);

    await lock.acquire('team-1:server-1', 30_000);
    expect(acquireCalls[0][0]).toBe('devpilot:lock:team-1:server-1');
  });
});

describe('NoopDistributedLock (degraded mode)', () => {
  it('always succeeds acquire and never throws on release', async () => {
    const lock = new NoopDistributedLock();

    const h1 = await lock.acquire('any-resource', 1000);
    const h2 = await lock.acquire('any-resource', 1000); // 同资源也成功（无互斥）
    expect(h1).not.toBeNull();
    expect(h2).not.toBeNull();

    await expect(lock.release(h1!)).resolves.toBeUndefined();
    await expect(lock.release(h2!)).resolves.toBeUndefined();
  });
});
