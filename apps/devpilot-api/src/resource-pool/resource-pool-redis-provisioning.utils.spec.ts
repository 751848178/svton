/**
 * Redis pool provisioning utils — unit tests.
 *
 * `ioredis` is jest-mocked so no network is touched. We assert:
 *  - provisioning SELECTs the allocated DB and writes a marker key
 *  - the returned credentials echo host/port/db/password/keyPrefix
 *  - deprovisioning drops only the keys owned by the resource prefix
 *  - connections are always disconnected
 */
const redisMethods = {
  connect: jest.fn(async () => undefined),
  select: jest.fn(async () => 'OK'),
  set: jest.fn(async (..._args: unknown[]) => 'OK'),
  keys: jest.fn(async (..._args: unknown[]) => [] as string[]),
  del: jest.fn(async (..._args: unknown[]) => 1),
  disconnect: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn(() => ({ ...redisMethods })),
}));

import Redis from 'ioredis';
import {
  provisionRedisDatabase,
  deprovisionRedisDatabase,
  allocateRedisDbIndex,
} from './resource-pool-redis-provisioning.utils';

describe('resource-pool redis provisioning utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects the allocated db, writes a marker and returns working credentials', async () => {
    const credentials = await provisionRedisDatabase({
      endpoint: 'redis.internal:6379',
      adminPassword: 'adminpw',
      resourceName: 'redis_abc123',
      db: 4,
    });

    expect(credentials).toEqual({
      host: 'redis.internal',
      port: 6379,
      db: 4,
      password: 'adminpw',
      keyPrefix: 'redis_abc123:',
    });

    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({
      host: 'redis.internal',
      port: 6379,
      password: 'adminpw',
      db: 4,
      lazyConnect: true,
    }));
    expect(redisMethods.connect).toHaveBeenCalledTimes(1);
    expect(redisMethods.select).toHaveBeenCalledWith(4);
    expect(redisMethods.set).toHaveBeenCalledWith(
      'redis_abc123:__provisioned__',
      expect.any(String),
    );
  });

  it('uses an empty password when adminConfig has none', async () => {
    const credentials = await provisionRedisDatabase({
      endpoint: 'redis.internal',
      resourceName: 'redis_abc123',
      db: 1,
    });
    expect(credentials.password).toBe('');
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ password: undefined }));
  });

  it('drops only the keys owned by the resource prefix on deprovision', async () => {
    redisMethods.keys.mockResolvedValueOnce([
      'redis_abc123:__provisioned__',
      'redis_abc123:sess-1',
    ]);
    await deprovisionRedisDatabase({
      endpoint: 'redis.internal:6379',
      resourceName: 'redis_abc123',
      db: 4,
    });

    expect(redisMethods.select).toHaveBeenCalledWith(4);
    expect(redisMethods.keys).toHaveBeenCalledWith('redis_abc123:*');
    expect(redisMethods.del).toHaveBeenCalledWith(
      'redis_abc123:__provisioned__',
      'redis_abc123:sess-1',
    );
  });

  it('does not call del when there are no owned keys', async () => {
    redisMethods.keys.mockResolvedValueOnce([]);
    await deprovisionRedisDatabase({
      endpoint: 'redis.internal:6379',
      resourceName: 'redis_abc123',
      db: 4,
    });
    expect(redisMethods.del).not.toHaveBeenCalled();
  });

  // CR H1 regression: deprovision must target the allocated DB index. Without
  // it, the old code silently defaulted to DB 0 — orphaning the real slot and
  // risking cross-tenant deletion. It now refuses to guess.
  it('throws when deprovision is called without the allocated db index', async () => {
    await expect(
      deprovisionRedisDatabase({
        endpoint: 'redis.internal:6379',
        resourceName: 'redis_abc123',
      }),
    ).rejects.toThrow(/requires the allocated `db` index/);
    expect(redisMethods.connect).not.toHaveBeenCalled();
  });

  // CR M3: resourceName is interpolated into a KEYS/DEL glob, so glob-meta
  // chars must be rejected up front (same guard as the MySQL path).
  it('rejects unsafe resource names before connecting', async () => {
    await expect(
      provisionRedisDatabase({ endpoint: '127.0.0.1', resourceName: 'evil*glob' }),
    ).rejects.toThrow(/Unsafe resource name rejected/);
    await expect(
      deprovisionRedisDatabase({ endpoint: '127.0.0.1', resourceName: 'evil*glob', db: 1 }),
    ).rejects.toThrow(/Unsafe resource name rejected/);
    expect(Redis).not.toHaveBeenCalled();
  });

  it('always disconnects the client, even on failure', async () => {
    redisMethods.connect.mockRejectedValueOnce(new Error('refused'));
    await expect(
      provisionRedisDatabase({ endpoint: '127.0.0.1', resourceName: 'redis_abc123' }),
    ).rejects.toThrow('refused');
    expect(redisMethods.disconnect).toHaveBeenCalledTimes(1);
  });

  it('allocates a db index between 1 and 15 inclusive', () => {
    for (let i = 0; i < 50; i += 1) {
      const db = allocateRedisDbIndex();
      expect(db).toBeGreaterThanOrEqual(1);
      expect(db).toBeLessThanOrEqual(15);
    }
  });
});
