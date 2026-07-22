/**
 * Real Redis pool provisioning — pure functions (no NestJS deps).
 *
 * Redis has no `CREATE DATABASE`/`CREATE USER` in the same sense as MySQL, so
 * isolation is achieved by allocating a logical DB index (1-15) plus a
 * `keyPrefix` namespace and (optionally) a password from the pool adminConfig.
 *
 * `provisionRedisDatabase` connects via ioredis, `SELECT`s the allocated DB,
 * and writes a marker key to reserve/verify the slot. `deprovisionRedisDatabase`
 * runs a prefix-scoped `KEYS`/`DEL` against the **same** allocated DB (the DB
 * index must be supplied by the caller from the allocation's stored credentials
 * — it never defaults, to avoid deleting from the wrong slot, see CR H1).
 */
import { randomInt } from "crypto";
import Redis from "ioredis";
import { assertSafeResourceName } from "./resource-pool-mysql-provisioning.utils";
import { parseResourceEndpoint } from "./resource-pool-endpoint.utils";

export type RedisProvisioningOptions = {
  endpoint: string;
  adminPassword?: string;
  resourceName: string;
  /** Pin a DB index (mainly for tests). Defaults to a random 1..15 slot. */
  db?: number;
  connectTimeoutMs?: number;
};

export type RedisProvisioningCredentials = {
  host: string;
  port: number;
  db: number;
  password: string;
  keyPrefix: string;
};

export function allocateRedisDbIndex(): number {
  return randomInt(1, 16);
}

export async function provisionRedisDatabase(
  opts: RedisProvisioningOptions,
): Promise<RedisProvisioningCredentials> {
  assertSafeResourceName(opts.resourceName);
  const { host, port } = parseResourceEndpoint(opts.endpoint, 6379);
  const db = opts.db ?? allocateRedisDbIndex();
  const password = opts.adminPassword ?? "";
  const keyPrefix = `${opts.resourceName}:`;

  const redis = new Redis({
    host,
    port,
    password: password || undefined,
    db,
    connectTimeout: opts.connectTimeoutMs ?? 5000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.select(db);
    await redis.set(`${keyPrefix}__provisioned__`, new Date().toISOString());
    return { host, port, db, password, keyPrefix };
  } finally {
    redis.disconnect();
  }
}

export async function deprovisionRedisDatabase(
  opts: RedisProvisioningOptions,
): Promise<void> {
  assertSafeResourceName(opts.resourceName);
  const { host, port } = parseResourceEndpoint(opts.endpoint, 6379);
  const db = resolveDeprovisionDb(opts.db);
  const password = opts.adminPassword ?? "";
  const keyPrefix = `${opts.resourceName}:`;

  const redis = new Redis({
    host,
    port,
    password: password || undefined,
    db,
    connectTimeout: opts.connectTimeoutMs ?? 5000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.select(db);
    // Best-effort: drop only the keys owned by this resource's prefix, then the
    // marker. We avoid a global FLUSHDB so a shared Redis slot isn't wiped.
    const owned = await redis.keys(`${keyPrefix}*`);
    if (owned.length > 0) {
      await redis.del(...owned);
    }
  } finally {
    redis.disconnect();
  }
}

/**
 * Resolve the DB index to deprovision. The caller MUST pass the originally
 * allocated `db` (read from the allocation's stored credentials). Refusing to
 * guess prevents the historical bug where a missing `db` silently targeted
 * DB 0 — leaking the real slot and risking cross-tenant deletion (CR H1).
 */
function resolveDeprovisionDb(db: number | undefined): number {
  if (db === undefined || db === null) {
    throw new Error(
      "Redis deprovision requires the allocated `db` index; refusing to default " +
        "(would target DB 0 and orphan the real slot — see CR H1).",
    );
  }
  return db;
}
