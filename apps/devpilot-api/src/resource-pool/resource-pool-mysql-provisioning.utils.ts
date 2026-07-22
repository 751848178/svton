/**
 * Real MySQL pool provisioning — pure functions (no NestJS deps).
 *
 * `provisionMysqlDatabase` connects to the pool's MySQL admin endpoint and runs
 * `CREATE DATABASE / CREATE USER / GRANT / FLUSH PRIVILEGES`, returning working
 * credentials. `deprovisionMysqlDatabase` drops them.
 *
 * Identifier safety: `resourceName` must match a strict allowlist (`db_<hex>` /
 * `redis_<hex>` / `res_<hex>` from `generateResourceName`) — any deviation throws,
 * so the values can never reach SQL via string interpolation unsanitized.
 */
import { randomBytes } from "crypto";
import { createConnection } from "mysql2/promise";
import { parseResourceEndpoint } from "./resource-pool-endpoint.utils";

export type MysqlProvisioningOptions = {
  endpoint: string;
  adminUsername?: string;
  adminPassword?: string;
  resourceName: string;
  /** Override the generated password (mainly for tests). */
  password?: string;
  connectTimeoutMs?: number;
};

export type MysqlProvisioningCredentials = {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
};

const SAFE_RESOURCE_NAME_PATTERN = /^(db|redis|res)_[a-z0-9]+$/;

/**
 * Validate that `resourceName` matches the generator's output shape.
 * Throws on anything unexpected so it can never be interpolated into SQL.
 */
export function assertSafeResourceName(resourceName: string): void {
  if (!SAFE_RESOURCE_NAME_PATTERN.test(resourceName)) {
    throw new Error(
      `Unsafe resource name rejected: ${resourceName}. Must match ^(?:db|redis|res)_[a-z0-9]+$`,
    );
  }
}

export function generateMysqlPassword(): string {
  return randomBytes(16).toString("hex");
}

export async function provisionMysqlDatabase(
  opts: MysqlProvisioningOptions,
): Promise<MysqlProvisioningCredentials> {
  assertSafeResourceName(opts.resourceName);
  const { host, port } = parseResourceEndpoint(opts.endpoint, 3306);
  const database = opts.resourceName;
  const username = `user_${opts.resourceName}`;
  const password = opts.password ?? generateMysqlPassword();

  const connection = await createConnection({
    host,
    port,
    user: opts.adminUsername,
    password: opts.adminPassword,
    connectTimeout: opts.connectTimeoutMs ?? 5000,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await connection.query(
      `CREATE USER IF NOT EXISTS \`${username}\`@'%' IDENTIFIED BY ?`,
      [password],
    );
    await connection.query(
      `GRANT ALL PRIVILEGES ON \`${database}\`.* TO \`${username}\`@'%'`,
    );
    await connection.query(`FLUSH PRIVILEGES`);
    return { host, port, database, username, password };
  } finally {
    await connection.end();
  }
}

export async function deprovisionMysqlDatabase(
  opts: MysqlProvisioningOptions,
): Promise<void> {
  assertSafeResourceName(opts.resourceName);
  const { host, port } = parseResourceEndpoint(opts.endpoint, 3306);
  const database = opts.resourceName;
  const username = `user_${opts.resourceName}`;

  const connection = await createConnection({
    host,
    port,
    user: opts.adminUsername,
    password: opts.adminPassword,
    connectTimeout: opts.connectTimeoutMs ?? 5000,
  });

  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await connection.query(`DROP USER IF EXISTS \`${username}\`@'%'`);
    await connection.query(`FLUSH PRIVILEGES`);
  } finally {
    await connection.end();
  }
}
