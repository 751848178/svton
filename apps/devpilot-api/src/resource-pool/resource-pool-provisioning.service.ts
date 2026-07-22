import { Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../common/crypto/crypto.service';
import { provisionMysqlDatabase, deprovisionMysqlDatabase } from './resource-pool-mysql-provisioning.utils';
import {
  provisionRedisDatabase,
  deprovisionRedisDatabase,
} from './resource-pool-redis-provisioning.utils';

type ProvisioningPool = {
  type: string;
  endpoint: string;
  adminConfig: string;
};

type DeprovisioningPool = {
  type: string;
  endpoint?: string;
  adminConfig: string;
};

/**
 * Decrypted per-allocation credentials produced by `provisionResource`.
 *
 * For Redis, the allocated logical DB index lives here (not in the pool
 * adminConfig), so the caller must decrypt the allocation's credentials and
 * pass them to `deprovisionResource` — otherwise deprovision would target
 * the wrong DB (see CR finding H1).
 */
type AllocationCredentials = {
  db?: number;
  [key: string]: unknown;
};

/**
 * Real resource-pool provisioning.
 *
 * Delegates the actual DB/user creation to pure, driver-backed utils
 * (`resource-pool-mysql-provisioning.utils.ts` for MySQL,
 * `resource-pool-redis-provisioning.utils.ts` for Redis) so this orchestration
 * service stays thin and the connection logic is independently testable.
 * Credentials are produced by talking to the pool's real endpoint.
 */
@Injectable()
export class ResourcePoolProvisioningService {
  private readonly logger = new Logger(ResourcePoolProvisioningService.name);

  constructor(private readonly cryptoService: CryptoService) {}

  generateResourceName(type: string, projectId: string): string {
    const suffix = projectId.slice(-6);
    switch (type) {
      case 'mysql':
        return `db_${suffix}`;
      case 'redis':
        return `redis_${suffix}`;
      default:
        return `res_${suffix}`;
    }
  }

  async provisionResource(pool: ProvisioningPool, resourceName: string) {
    const adminConfig = this.readAdminConfig(pool.adminConfig);
    switch (pool.type) {
      case 'mysql':
        return provisionMysqlDatabase({
          endpoint: pool.endpoint,
          adminUsername: this.readAdminUser(adminConfig),
          adminPassword: this.readAdminPassword(adminConfig),
          resourceName,
        });
      case 'redis':
        return provisionRedisDatabase({
          endpoint: pool.endpoint,
          adminPassword: this.readAdminPassword(adminConfig),
          resourceName,
        });
      case 'postgresql':
        throw new Error(
          'postgresql pool provisioning is not implemented: no postgres driver is bundled. ' +
            'Use a script/api provisioning mode for postgresql resources.',
        );
      default:
        return { resourceName };
    }
  }

  async deprovisionResource(
    pool: DeprovisioningPool,
    resourceName: string,
    allocationCredentials?: AllocationCredentials,
  ) {
    this.logger.log(`Deprovisioning ${pool.type} resource: ${resourceName}`);
    const adminConfig = this.readAdminConfig(pool.adminConfig);
    switch (pool.type) {
      case 'mysql':
        await deprovisionMysqlDatabase({
          endpoint: pool.endpoint ?? '',
          adminUsername: this.readAdminUser(adminConfig),
          adminPassword: this.readAdminPassword(adminConfig),
          resourceName,
        });
        return;
      case 'redis':
        await deprovisionRedisDatabase({
          endpoint: pool.endpoint ?? '',
          adminPassword: this.readAdminPassword(adminConfig),
          resourceName,
          // Thread the originally-allocated DB index so we deprovision the
          // slot that was actually written to (1..15), never a default. Without
          // this the allocated DB would leak and DB 0 could be corrupted.
          db: this.readAllocatedDb(allocationCredentials),
        });
        return;
      default:
        return;
    }
  }

  private readAdminConfig(encrypted: string): Record<string, unknown> {
    return JSON.parse(
      this.cryptoService.decryptCbc(encrypted),
    ) as Record<string, unknown>;
  }

  private readAdminUser(config: Record<string, unknown>): string | undefined {
    const value = config.username ?? config.user;
    return typeof value === 'string' ? value : undefined;
  }

  private readAdminPassword(config: Record<string, unknown>): string | undefined {
    const value = config.password;
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * Read the allocated Redis DB index from decrypted allocation credentials.
   * Returns `undefined` if absent (e.g. legacy allocations) — the redis util
   * will then refuse to guess, throwing rather than silently targeting DB 0.
   */
  private readAllocatedDb(
    credentials: AllocationCredentials | undefined,
  ): number | undefined {
    if (!credentials) return undefined;
    const value = credentials.db;
    return typeof value === 'number' ? value : undefined;
  }
}
