import { Injectable, Logger } from '@nestjs/common';
import type { DockerOptions } from 'dockerode';
import { CliDockerInventoryExecutor } from './cli-docker-inventory-executor';
import { DockerApiInventoryExecutor } from './docker-api-inventory-executor';
import { DockerInventoryExecutor } from './docker-inventory-executor';

/** Server 的 tags/metadata 中携带 Docker API 连接信息的字段名。 */
const DOCKER_API_HOST_FIELD = 'dockerApiHost';
const DOCKER_API_SOCKET_FIELD = 'dockerApiSocket';
const DOCKER_API_TLS_FIELD = 'dockerApiTls';

/** host 字段未携带端口时的默认端口（Docker TLS 默认 2376）。 */
const DEFAULT_DOCKER_API_PORT = 2376;

/**
 * Docker inventory executor 工厂。
 *
 * 根据服务器元数据（tags / services）是否含 Docker API 连接信息，自动选择实现：
 *  - 含 `dockerApiHost`（如 `tcp://10.0.0.1:2376`）或 `dockerApiSocket`（如 `/var/run/docker.sock`）
 *    → 返回 {@link DockerApiInventoryExecutor}（dockerode 直连，结构化数据，免文本解析）
 *  - 否则 → 返回 {@link CliDockerInventoryExecutor}（SSH 远程跑 `docker ps`，解析 stdout）
 *
 * 这样服务器开了 Docker API 时自动用 dockerode；只装 CLI 的服务器走原 SSH 路径。
 */
@Injectable()
export class DockerInventoryExecutorFactory {
  private readonly logger = new Logger(DockerInventoryExecutorFactory.name);

  constructor(private readonly cliExecutor: CliDockerInventoryExecutor) {}

  /**
   * 按服务器元数据解析出合适的 executor。
   * @param serverMeta 服务器记录（含 tags/services 等 JSON 字段）
   */
  resolve(serverMeta: { tags?: unknown; services?: unknown }): DockerInventoryExecutor {
    const dockerOptions = this.extractDockerOptions(serverMeta);
    if (dockerOptions) {
      this.logger.log(
        `Using Docker API (dockerode) for inventory: ${dockerOptions.host ?? dockerOptions.socketPath}`,
      );
      return new DockerApiInventoryExecutor(dockerOptions);
    }
    return this.cliExecutor;
  }

  /** 是否启用了 Docker API（供调用方决定 syncMode 标签等）。 */
  usesDockerApi(serverMeta: { tags?: unknown; services?: unknown }): boolean {
    return this.extractDockerOptions(serverMeta) !== null;
  }

  private extractDockerOptions(meta: {
    tags?: unknown;
    services?: unknown;
  }): DockerOptions | null {
    const tags = this.asRecord(meta.tags);
    const services = this.asRecord(meta.services);

    const host = this.readString(tags, DOCKER_API_HOST_FIELD) ?? this.readString(services, DOCKER_API_HOST_FIELD);
    const socket = this.readString(tags, DOCKER_API_SOCKET_FIELD) ?? this.readString(services, DOCKER_API_SOCKET_FIELD);
    const tls = this.readBool(tags, DOCKER_API_TLS_FIELD) ?? this.readBool(services, DOCKER_API_TLS_FIELD);

    if (host) {
      const port = this.extractPort(host) ?? DEFAULT_DOCKER_API_PORT;
      const hostname = this.extractHostname(host) ?? host;
      return { host: hostname, port, ...(tls !== undefined ? { ...(tls ? {} : {}) } : {}) };
    }
    if (socket) {
      return { socketPath: socket };
    }
    return null;
  }

  /**
   * 从 host 字段解析端口。host 可能是完整 URL（`tcp://host:2375`）或裸 `host:port`。
   * 无端口时返回 undefined（由调用方决定默认值）。
   */
  private extractPort(host: string): number | undefined {
    const parsed = this.parseHostUrl(host);
    return parsed?.port ? Number(parsed.port) : undefined;
  }

  /**
   * 从 host 字段解析 hostname（不含 scheme/port）。解析失败或 hostname 为空
   * （如 `unix:///var/run/docker.sock` 误填到 host 字段，`new URL().hostname` 返回 ""）
   * 时返回 undefined，由调用方回退到原始 host。IPv6 的方括号形式 `[::1]` 一并剥离。
   */
  private extractHostname(host: string): string | undefined {
    const hostname = this.parseHostUrl(host)?.hostname;
    if (!hostname) return undefined;
    // `new URL().hostname` 对 IPv6 返回带方括号的 `[::1]`，dockerode 不接受括号形式。
    return hostname.replace(/^\[|\]$/g, '');
  }

  private parseHostUrl(host: string): URL | undefined {
    try {
      const normalized = host.includes('://') ? host : `tcp://${host}`;
      return new URL(normalized);
    } catch {
      return undefined;
    }
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private readString(record: Record<string, unknown> | null, key: string): string | undefined {
    const v = record?.[key];
    return typeof v === 'string' && v ? v : undefined;
  }

  private readBool(record: Record<string, unknown> | null, key: string): boolean | undefined {
    const v = record?.[key];
    return typeof v === 'boolean' ? v : undefined;
  }
}
