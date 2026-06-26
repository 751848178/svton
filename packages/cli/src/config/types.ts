/**
 * Svton 项目清单（manifest）类型定义。
 *
 * 一个 Svton 项目可以通过两种方式声明自身：
 *  1. 主配置 `svton.config.ts`（类型安全，可编程）
 *  2. 根 `package.json` 里的最小标记 `"svton": { "schema": 1 }`（仅用于快速检测）
 *
 * 即便两者都没有，CLI 也会通过 `detect.ts` 推断出一份默认清单，使项目 day-0 可用。
 */

/** 当前规范版本。manifest 的 `schema` 字段必须等于此值。 */
export const SVTON_SCHEMA_VERSION = 1 as const;

/** 应用类型。 */
export type AppType = 'next' | 'nest' | 'taro' | 'node';

/** 健康探针：用于 `svton info` / `svton doctor` 判断应用是否就绪。 */
export interface AppReadyProbe {
  /** 必须 2xx 才算就绪的 HTTP GET 地址，如 `http://localhost:3101/api/health`。 */
  http?: string;
  /** 超时（毫秒），默认 30000。 */
  timeoutMs?: number;
}

/** 单个应用配置。 */
export interface SvtonAppConfig {
  /** 工作区相对目录，如 `apps/devpilot-api`。 */
  dir: string;
  type: AppType;
  /** 解析出的 dev 端口，如 `3101`。非 HTTP 服务（mobile/desktop）可省略。 */
  port?: number;
  /** ready 探针前缀，如 `http://localhost:3101/api`。 */
  baseURL?: string;
  /** 覆盖 dev 调用；默认走包管理器 / turbo 的 `dev` 脚本。 */
  run?: string;
  /** 必须先就绪的应用（v1 仅信息性，dev 排序仍由 turbo 负责）。 */
  dependsOn?: string[];
  ready?: AppReadyProbe;
}

export interface SvtonEnvConfig {
  /** 相对根目录的 env 文件，按顺序查找。默认 `['.env', '.env.local']`。 */
  files?: string[];
  /** `env check` 用的参考示例文件。默认 `.env.example`。 */
  example?: string;
}

export interface SvtonDatabaseConfig {
  orm: 'prisma';
  /** 包含 `prisma/schema.prisma` 的工作区相对目录，如 `apps/devpilot-api`。 */
  dir: string;
}

export interface SvtonServicesConfig {
  /** compose 文件相对路径，默认 `docker-compose.yml`。 */
  compose?: string;
}

export interface SvtonDockerConfig {
  /** 生产 compose 文件相对路径，默认 `docker-compose.prod.yml`。 */
  prodCompose?: string;
}

export interface SvtonProjectConfig {
  schema: typeof SVTON_SCHEMA_VERSION;
  /** 以稳定名称为 key 的应用映射（名称需与 `dev:<name>` 脚本后缀一致）。 */
  apps: Record<string, SvtonAppConfig>;
  /** 额外需要纳入的工作区包 glob/目录，可选。 */
  packages?: string[];
  env?: SvtonEnvConfig;
  database?: SvtonDatabaseConfig;
  /** 包管理器覆盖；默认从 `packageManager` 字段 / 锁文件探测。 */
  pm?: 'pnpm' | 'npm' | 'yarn';
  services?: SvtonServicesConfig;
  docker?: SvtonDockerConfig;
}
