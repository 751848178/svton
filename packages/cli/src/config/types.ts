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

export interface SvtonDockerHealthcheck {
  /** 健康检查 HTTP 路径(追加到容器内 baseURL)。默认从 app.ready.http 自动推导。 */
  path?: string;
  interval?: string; // 默认 '15s'
  timeout?: string; // 默认 '5s'
  retries?: number; // 默认 10
  startPeriod?: string; // 默认 '30s'
}

export interface SvtonDockerImageConfig {
  /** runtime 基础镜像 tag,默认 '20-alpine'。 */
  nodeVersion?: string;
  /** pnpm 版本;默认读根 packageManager,回退 '8.12.0'。 */
  pnpmVersion?: string;
  /** 镜像 tag 策略:'sha'(git 短 sha,默认)|'version'(package.json 版本)|'latest'。 */
  tagPolicy?: 'sha' | 'version' | 'latest';
  /** registry 前缀(如 'ghcr.io/myorg');设了才允许 --push。 */
  registry?: string;
}

export interface SvtonDockerDbConfig {
  /** 引擎,默认 'mysql'(有 backend 时)。 */
  engine?: 'mysql' | 'postgres';
  /** 镜像 tag(不含引擎前缀),默认 '8.0' / '16-alpine'。 */
  version?: string;
  /** 绑定主机,默认 '127.0.0.1'(仅本机可达)。 */
  bindHost?: string;
  /** 主机端口,默认 3306 / 5432。 */
  port?: number;
  /** compose profile 门控,默认 'db'。 */
  profile?: string;
  /** false=用外部托管 DB(移除 db 服务),默认 true。 */
  enabled?: boolean;
  /** DB 启动参数(command:),默认 twgg 调参集。 */
  commandArgs?: string[];
  /** 宿主机数据卷挂载路径;不设=Docker 命名卷(mysql_data)。如 '/data/twgg/mysql'。 */
  volumePath?: string;
}

export interface SvtonDockerRedisConfig {
  version?: string; // 默认 '7-alpine'
  bindHost?: string; // 默认 '127.0.0.1'
  port?: number; // 默认 6379
  enabled?: boolean; // 默认 true
  /** 宿主机数据卷挂载路径;不设=Docker 命名卷(redis_data)。如 '/data/twgg/redis'。 */
  volumePath?: string;
}

export interface SvtonDockerMobileConfig {
  /** 是否生成 mobile(taro h5)nginx 静态服务,默认 false(opt-in)。 */
  enabled?: boolean;
  /** nginx 监听端口,默认 10086。 */
  port?: number;
}

export interface SvtonDockerLoggingConfig {
  driver?: 'json-file' | 'local'; // 默认 'json-file'
  maxSize?: string; // 默认 '10m'
  maxFile?: number; // 默认 3
}

export interface SvtonDockerAppOverride {
  /** 覆盖容器端口映射,默认取 app.port。 */
  port?: number;
  healthcheck?: SvtonDockerHealthcheck;
  /** 关闭该 app 的自动健康检查。 */
  healthcheckDisabled?: boolean;
  /** 显式 depends_on(带 service_healthy),默认从 app.dependsOn 推。 */
  dependsOn?: string[];
}

export interface SvtonDockerConfig {
  /** 生产 compose 文件相对路径,默认 'docker-compose.prod.yml'。 */
  prodCompose?: string;
  /** 用单根多阶段 Dockerfile(twgg 模式,默认 true)还是 per-app。 */
  rootDockerfile?: boolean;
  /** 根 Dockerfile 路径(rootDockerfile=true 时),默认 'Dockerfile'。 */
  dockerfilePath?: string;
  /** 是否生成宿主机 nginx 反向代理参考配置(单域名 /api→backend),默认 true。 */
  hostNginxExample?: boolean;

  image?: SvtonDockerImageConfig;
  db?: SvtonDockerDbConfig;
  redis?: SvtonDockerRedisConfig;
  mobile?: SvtonDockerMobileConfig;
  logging?: SvtonDockerLoggingConfig;
  /** 所有服务重启策略,默认 'unless-stopped'。 */
  restart?: 'unless-stopped' | 'always' | 'on-failure' | 'no';
  /** 按 manifest.apps 名称索引的 per-app 覆盖。 */
  apps?: Record<string, SvtonDockerAppOverride>;
  /** 额外 build arg(注入每次构建)。 */
  buildArgs?: Record<string, string>;
  /** 串行构建各 app 镜像(一次只 build 一个),降低峰值内存,适合小内存服务器。默认 false。 */
  serial?: boolean;
  /** 额外 env_file(除 .env 外 compose 加载)。 */
  envFiles?: string[];
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
