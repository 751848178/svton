import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { CryptoService } from "../common/crypto/crypto.service";

type ProvisioningPool = {
  type: string;
  endpoint: string;
  adminConfig: string;
};

@Injectable()
export class ResourcePoolProvisioningService {
  private readonly logger = new Logger(ResourcePoolProvisioningService.name);

  constructor(private readonly cryptoService: CryptoService) {}

  generateResourceName(type: string, projectId: string): string {
    const suffix = projectId.slice(-6);
    switch (type) {
      case "mysql":
        return `db_${suffix}`;
      case "redis":
        return `redis_${suffix}`;
      default:
        return `res_${suffix}`;
    }
  }

  async provisionResource(pool: ProvisioningPool, resourceName: string) {
    const adminConfig = JSON.parse(
      this.cryptoService.decryptCbc(pool.adminConfig),
    ) as Record<string, unknown>;

    switch (pool.type) {
      case "mysql": {
        const endpoint = this.parseEndpoint(pool.endpoint, 3306);
        return {
          host: endpoint.host,
          port: endpoint.port,
          database: resourceName,
          username: `user_${resourceName}`,
          password: crypto.randomBytes(16).toString("hex"),
        };
      }
      case "postgresql": {
        const endpoint = this.parseEndpoint(pool.endpoint, 5432);
        return {
          host: endpoint.host,
          port: endpoint.port,
          database: resourceName,
          schema: "public",
          username: `user_${resourceName}`,
          password: crypto.randomBytes(16).toString("hex"),
        };
      }
      case "redis": {
        const endpoint = this.parseEndpoint(pool.endpoint, 6379);
        return {
          host: endpoint.host,
          port: endpoint.port,
          db: crypto.randomInt(1, 16),
          password:
            typeof adminConfig.password === "string"
              ? adminConfig.password
              : "",
          keyPrefix: `${resourceName}:`,
        };
      }
      default:
        return { resourceName };
    }
  }

  async deprovisionResource(
    pool: { type: string; adminConfig: string },
    resourceName: string,
  ) {
    this.logger.log(`Deprovisioning ${pool.type} resource: ${resourceName}`);
  }

  private parseEndpoint(endpoint: string, defaultPort: number) {
    try {
      const normalized = endpoint.includes("://")
        ? endpoint
        : `tcp://${endpoint}`;
      const url = new URL(normalized);
      return {
        host: url.hostname || endpoint,
        port: url.port ? Number(url.port) : defaultPort,
      };
    } catch {
      const [host, port] = endpoint.split(":");
      return {
        host: host || endpoint,
        port: port ? Number(port) : defaultPort,
      };
    }
  }
}
