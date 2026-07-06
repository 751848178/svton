import { z } from 'zod';
import { createZodValidate } from '@svton/nestjs-config-schema';

/**
 * 启动期 env 校验 schema。
 *
 * 取代散落在 19+ 处的 `Number(configService.get('X', '60'))` + 手写 `Number.isFinite` 钳制：
 * 启动时一次性校验所有关键 env 的类型与范围，坏配置直接 fail-fast，而不是运行期才暴露。
 *
 * 用 `.passthrough()` 保留未列出的 env（避免误丢 key）。各 service 仍通过 ConfigService 读取，
 * 但读到的值已经过校验。后续可逐步把这些读取点改为读 typed config（本文件可作为单一来源）。
 */
const booleanString = z
  .string()
  .transform((value) => value === 'true' || value === '1')
  .or(z.boolean());

const positiveInt = (min = 1) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((n) => Number.isFinite(n) && n >= min, {
      message: `must be a finite number >= ${min}`,
    });

export const envSchema = z
  .object({
    // ---------- 基础 ----------
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: positiveInt(1).default(3000),
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    ENCRYPTION_KEY: z.string().optional(),

    // ---------- Redis ----------
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: positiveInt(1).default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: positiveInt(0).default(0),

    // ---------- 缓存 ----------
    CACHE_ENABLED: booleanString.default('true'),
    CACHE_TTL: positiveInt(1).default(300),

    // ---------- 日志 ----------
    LOG_LEVEL: z.string().default('debug'),

    // ---------- Webhook ----------
    WEBHOOK_REPLAY_WINDOW_SECONDS: positiveInt(1).default(300),

    // ---------- 监控调度器 ----------
    MONITORING_SCHEDULER_ENABLED: booleanString.default('true'),
    MONITORING_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(60),
    MONITORING_SCHEDULER_BATCH_SIZE: positiveInt(1).default(50),
    ALERT_NOTIFICATION_RETRY_SCHEDULER_ENABLED: booleanString.default('true').optional(),
    ALERT_NOTIFICATION_RETRY_MAX_ATTEMPTS: positiveInt(1).default(5),
    ALERT_NOTIFICATION_RETRY_MIN_AGE_SECONDS: positiveInt(1).default(60),
    ALERT_NOTIFICATION_RETRY_BATCH_SIZE: positiveInt(1).default(50),
    ALERT_ESCALATION_MIN_AGE_SECONDS: positiveInt(1).default(300),
    ALERT_ESCALATION_DEDUPE_WINDOW_MINUTES: positiveInt(1).default(60),
    ALERT_ESCALATION_BATCH_SIZE: positiveInt(1).default(50),

    // ---------- 日志中心调度器 ----------
    LOG_RETENTION_SCHEDULER_ENABLED: booleanString.default('true'),
    LOG_RETENTION_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(3600),
    LOG_RETENTION_SCHEDULER_BATCH_SIZE: positiveInt(1).default(500),
    LOG_RETENTION_SCHEDULER_DRY_RUN: booleanString.default('false'),
    LOG_CENTER_SLS_BACKFILL_SCHEDULER_ENABLED: booleanString.default('true'),
    LOG_CENTER_SLS_BACKFILL_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(300),
    LOG_CENTER_SLS_BACKFILL_SCHEDULER_SCAN_LIMIT: positiveInt(1).default(50),
    LOG_CENTER_SLS_BACKFILL_SCHEDULER_DRY_RUN: booleanString.default('false'),
    LOG_CENTER_SLS_BACKFILL_DEFAULT_INTERVAL_MINUTES: positiveInt(1).default(15),
    LOG_CENTER_SERVER_FOLLOW_SCHEDULER_ENABLED: booleanString.default('true'),
    LOG_CENTER_SERVER_FOLLOW_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(60),
    LOG_CENTER_SERVER_FOLLOW_SCHEDULER_SCAN_LIMIT: positiveInt(1).default(50),
    LOG_CENTER_SERVER_FOLLOW_SCHEDULER_DRY_RUN: booleanString.default('false'),
    LOG_CENTER_SERVER_FOLLOW_DEFAULT_INTERVAL_MINUTES: positiveInt(1).default(5),
    LOG_CENTER_SLS_LIVE_QUERY_ENABLED: booleanString.default('false'),
    LOG_CENTER_SLS_QUERY_TIMEOUT_MS: positiveInt(1).default(10000),
    LOG_CENTER_SLS_QUERY_RETRY_ATTEMPTS: positiveInt(0).default(1),
    LOG_CENTER_SLS_QUERY_RETRY_BASE_DELAY_MS: positiveInt(1).default(200),

    // ---------- Site TLS ----------
    SITE_TLS_PROBE_SCHEDULER_ENABLED: booleanString.default('true'),
    SITE_TLS_PROBE_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(3600),
    SITE_TLS_PROBE_SCHEDULER_BATCH_SIZE: positiveInt(1).default(50),
    SITE_TLS_PROBE_MAX_ATTEMPTS: positiveInt(1).default(3),
    SITE_TLS_PROBE_MIN_INTERVAL_SECONDS: positiveInt(1).default(300),
    SITE_TLS_RENEW_SCHEDULER_ENABLED: booleanString.default('true'),
    SITE_TLS_RENEW_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(3600),
    SITE_TLS_RENEW_SCHEDULER_BATCH_SIZE: positiveInt(1).default(10),
    SITE_TLS_RENEW_SCHEDULER_DRY_RUN: booleanString.default('false'),
    SITE_TLS_RENEW_BEFORE_DAYS: positiveInt(1).default(30),
    SITE_TLS_RENEW_MAX_ATTEMPTS: positiveInt(1).default(3),
    SITE_TLS_RENEW_MIN_INTERVAL_SECONDS: positiveInt(1).default(300),

    // ---------- 部署调度器 ----------
    DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_ENABLED: booleanString.default('true'),
    DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(60),
    DEPLOYMENT_AUTO_ROLLBACK_SCHEDULER_BATCH_SIZE: positiveInt(1).default(50),
    DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_ENABLED: booleanString.default('true'),
    DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(60),
    DEPLOYMENT_POST_ROLLBACK_SMOKE_SCHEDULER_BATCH_SIZE: positiveInt(1).default(50),

    // ---------- 生成器清理调度器 ----------
    PROJECT_ARTIFACT_CLEANUP_SCHEDULER_ENABLED: booleanString.default('true'),
    PROJECT_ARTIFACT_CLEANUP_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(3600),
    PROJECT_ARTIFACT_CLEANUP_SCHEDULER_DRY_RUN: booleanString.default('false'),
    DEVPILOT_GENERATED_PROJECT_ARTIFACT_RETENTION_DAYS: positiveInt(1).default(7),

    // ---------- 资源管控调度器 ----------
    RESOURCE_CONTROL_SCHEDULER_ENABLED: booleanString.default('true'),
    RESOURCE_CONTROL_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(300),
    RESOURCE_CONTROL_STALE_AFTER_SECONDS: positiveInt(1).default(600),
    RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_ENABLED: booleanString.default('true'),
    RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_BATCH_SIZE: positiveInt(1).default(20),
    RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MIN_INTERVAL_SECONDS: positiveInt(1).default(60),
    RESOURCE_CONTROL_SCHEDULE_DOCKER_METRICS_MAX_ATTEMPTS: positiveInt(1).default(3),
    RESOURCE_CONTROL_SCHEDULE_DOCKER_SYNC_ENABLED: booleanString.default('true'),
    RESOURCE_CONTROL_SCHEDULE_SERVER_BATCH_SIZE: positiveInt(1).default(20),
    RESOURCE_CONTROL_CLOUD_INVENTORY_LIVE_ENABLED: booleanString.default('false'),
    RESOURCE_CONTROL_CLOUD_INVENTORY_TIMEOUT_MS: positiveInt(1).default(10000),
    RESOURCE_CONTROL_CLOUD_INVENTORY_RETRY_ATTEMPTS: positiveInt(0).default(1),
    RESOURCE_CONTROL_CLOUD_INVENTORY_RETRY_BASE_DELAY_MS: positiveInt(1).default(200),

    // ---------- 资源请求调度器 ----------
    RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_ENABLED: booleanString.default('true'),
    RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_INTERVAL_SECONDS: positiveInt(1).default(60),
    RESOURCE_REQUEST_PROVISIONING_RETRY_SCHEDULER_BATCH_SIZE: positiveInt(1).default(50),
    RESOURCE_REQUEST_PROVISIONING_RUN_STALE_AFTER_SECONDS: positiveInt(1).default(600),
    RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_ENABLED: booleanString.default('true'),
    RESOURCE_REQUEST_PROVISIONING_RUN_STALE_RECOVERY_BATCH_SIZE: positiveInt(1).default(50),
    RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_ENABLED: booleanString.default('true'),
    RESOURCE_REQUEST_PROVISIONING_QUEUE_WORKER_BATCH_SIZE: positiveInt(1).default(20),
    RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_ENABLED: booleanString.default('true'),
    RESOURCE_REQUEST_PROVISIONING_PROVIDER_STATE_POLLING_BATCH_SIZE: positiveInt(1).default(20),
    RESOURCE_REQUEST_PROVISIONING_HTTP_ENABLED: booleanString.default('false'),
    RESOURCE_REQUEST_PROVISIONING_HTTP_QUEUE_ENABLED: booleanString.default('false'),

    // ---------- Server executor ----------
    SERVER_EXECUTOR_LIVE_ENABLED: booleanString.default('false'),
    SERVER_EXECUTOR_QUEUE_WORKER_ENABLED: booleanString.default('true'),
    SERVER_EXECUTOR_QUEUE_INTERVAL_SECONDS: positiveInt(1).default(5),
    SERVER_EXECUTOR_QUEUE_BATCH_SIZE: positiveInt(1).default(10),
    SERVER_EXECUTOR_QUEUE_HEARTBEAT_SECONDS: positiveInt(1).default(30),
    SERVER_EXECUTOR_QUEUE_LOCK_TTL_SECONDS: positiveInt(1).default(120),
    SERVER_EXECUTOR_QUEUE_RETRY_DELAY_SECONDS: positiveInt(1).default(30),
    SERVER_EXECUTOR_QUEUE_RECOVERY_BATCH_SIZE: positiveInt(1).default(50),
    SERVER_EXECUTOR_LEASE_TTL_SECONDS: positiveInt(1).default(120),
    SERVER_EXECUTOR_CANCEL_POLL_SECONDS: positiveInt(1).default(10),
    SERVER_EXECUTOR_REMOTE_KILL_TIMEOUT_SECONDS: positiveInt(1).default(30),
    SERVER_EXECUTOR_STALE_REMOTE_CLEANUP_ENABLED: booleanString.default('true'),
    SERVER_EXECUTOR_AGENT_ENABLED: booleanString.default('false'),
    SERVER_EXECUTOR_AGENT_TARGET_ENABLED: booleanString.default('false'),
    SERVER_EXECUTOR_AGENT_DISPATCHER_URL: z.string().optional(),
    SERVER_EXECUTOR_AGENT_DISPATCHER_TOKEN: z.string().optional(),
    SERVER_EXECUTOR_AGENT_HEARTBEAT_ENABLED: booleanString.default('false'),
    SERVER_EXECUTOR_AGENT_HEARTBEAT_REQUIRED: booleanString.default('false'),
    SERVER_EXECUTOR_AGENT_HEARTBEAT_TOKEN: z.string().optional(),
    SERVER_EXECUTOR_AGENT_TASK_PULL_ENABLED: booleanString.default('false'),
    SERVER_EXECUTOR_AGENT_TASK_PULL_CONTRACT_ENABLED: booleanString.default('false'),
    SERVER_EXECUTOR_AGENT_TASK_PULL_TOKEN: z.string().optional(),

    // ---------- 日志流会话 ----------
    LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_ACTOR: positiveInt(1).default(5),
    LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_TEAM: positiveInt(1).default(20),
    LOG_STREAM_MAX_ACTIVE_SESSIONS_PER_STREAM: positiveInt(1).default(3),

    // ---------- 其他 ----------
    CORS_ORIGIN: z.string().optional(),
    DEVPILOT_GENERATED_PROJECTS_DIR: z.string().optional(),
  })
  .passthrough();

export type EnvConfig = z.infer<typeof envSchema>;

/** 用于 `ConfigModule.forRoot({ validate })`。 */
export const validateEnv = createZodValidate(envSchema);
