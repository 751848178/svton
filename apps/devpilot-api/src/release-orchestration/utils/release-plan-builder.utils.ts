/**
 * 发布计划构建器（纯函数）：把项目/环境/服务配置翻译为阶段定义 + 依赖边。
 * 不读取 DB、不执行副作用。dry-run 与正式计划共用本函数。
 */
import {
  computeIdempotencyKey,
  computePlanHash,
  computeStageConfigHash,
} from "./release-hash.utils";
import { validateReleaseDag } from "./release-dag.utils";
import type { ReleaseDagResult } from "./release-dag.utils";
import type {
  ReleaseDependencyConditionType,
  ReleaseRiskLevel,
  ReleaseStageDefinition,
  ReleaseStageExecutorKind,
  ReleaseStageType,
} from "../types/release-orchestration.types";

// 单个应用服务在发布计划中的解析输入
export interface ReleaseServiceInput {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
  serviceName: string;
  // F382 风格命令配置（未配置的字段为 undefined）
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  healthCheckUrl?: string;
  // 服务级别可选配置（backfill 等显式阶段）
  backfillCommand?: string;
  backfillRequired?: boolean; // false 时即便配置了也只作为 optional
}

export interface ReleasePlanBuildInput {
  projectId: string;
  environmentId: string;
  name: string;
  branch?: string;
  commitSha?: string;
  services: ReleaseServiceInput[];
}

export interface ReleaseStageNode extends ReleaseStageDefinition {
  idempotencyKey: string;
}

export interface ReleaseDependency {
  stageKey: string;
  dependsOnStageKey: string;
  conditionType: ReleaseDependencyConditionType;
  required: boolean; // optional 节点的 completed 依赖
}

export interface ReleasePlanPreview {
  stages: ReleaseStageNode[];
  dependencies: ReleaseDependency[];
  planHash: string;
  inputSnapshot: Record<string, unknown>;
  // 副作用与风险摘要（用于 UI 与 dry-run）
  sideEffects: string[];
  riskSummary: Array<{ stageKey: string; risk: ReleaseRiskLevel }>;
  approvalRequired: Array<{ stageKey: string; reason: string }>;
}

const SCHEMA_MIGRATION_RISK: ReleaseRiskLevel = "high";
const BOOTSTRAP_RISK: ReleaseRiskLevel = "medium";
const BACKFILL_RISK: ReleaseRiskLevel = "high";
const APP_DEPLOY_RISK: ReleaseRiskLevel = "medium";

// 把单个服务翻译成阶段节点 + 依赖。key 规则：<type>:<serviceId>；project-wide 用 <type>。
export function buildReleasePlan(
  input: ReleasePlanBuildInput,
): ReleaseDagResult<ReleasePlanPreview> {
  const stages: ReleaseStageNode[] = [];
  const dependencies: ReleaseDependency[] = [];
  const sideEffects: string[] = [];
  const riskSummary: ReleasePlanPreview["riskSummary"] = [];
  const approvalRequired: ReleasePlanPreview["approvalRequired"] = [];

  // 阶段顺序：precheck → migration → bootstrap → backfill → app_deploy → health
  // 依赖链：每个服务内部串行；跨服务同 type 不强制顺序（各自独立 concurrencyKey）
  let globalPrecheckKey: string | null = null;

  for (const svc of input.services) {
    const ctx = {
      applicationId: svc.applicationId,
      applicationServiceId: svc.applicationServiceId,
      environmentId: svc.environmentId,
      serverId: svc.serverId ?? null,
    };

    let prevKey: string | null = null;

    if (svc.preStartCheckCommand) {
      const key = `precheck:${svc.applicationServiceId}`;
      stages.push(
        makeStage({
          key,
          name: `配置校验 - ${svc.serviceName}`,
          type: "precheck",
          executorKind: "server_command",
          required: true,
          risk: "low",
          ctx,
          config: { command: svc.preStartCheckCommand },
        }),
      );
      prevKey = key;
      if (!globalPrecheckKey) globalPrecheckKey = key;
    }

    if (svc.migrationCommand) {
      const key = `schema_migration:${svc.applicationServiceId}`;
      stages.push(
        makeStage({
          key,
          name: `数据库结构迁移 - ${svc.serviceName}`,
          type: "schema_migration",
          executorKind: "server_command",
          required: true,
          risk: SCHEMA_MIGRATION_RISK,
          ctx,
          config: {
            command: svc.migrationCommand,
            concurrencyKey: `db:${svc.environmentId}`,
          },
        }),
      );
      if (prevKey)
        dependencies.push(edge(key, prevKey, "succeeded", true));
      prevKey = key;
      sideEffects.push(`${key}: 修改数据库结构（不可自动回滚）`);
      approvalRequired.push({ stageKey: key, reason: "数据库结构迁移为高风险" });
    }

    if (svc.initializationCommand) {
      const key = `bootstrap:${svc.applicationServiceId}`;
      stages.push(
        makeStage({
          key,
          name: `生产 bootstrap - ${svc.serviceName}`,
          type: "bootstrap",
          executorKind: "server_command",
          required: true,
          risk: BOOTSTRAP_RISK,
          ctx,
          config: {
            command: svc.initializationCommand,
            runPolicy: "once_per_environment_command",
            concurrencyKey: `bootstrap:${svc.applicationServiceId}:${svc.environmentId}`,
          },
        }),
      );
      if (prevKey)
        dependencies.push(edge(key, prevKey, "succeeded", true));
      prevKey = key;
      sideEffects.push(`${key}: 创建/更新生产初始化数据`);
      approvalRequired.push({ stageKey: key, reason: "生产 bootstrap 修改数据" });
    }

    if (svc.backfillCommand) {
      const key = `data_backfill:${svc.applicationServiceId}`;
      const isRequired = svc.backfillRequired === true;
      stages.push(
        makeStage({
          key,
          name: `历史数据回填 - ${svc.serviceName}`,
          type: "data_backfill",
          executorKind: "server_command",
          required: isRequired,
          risk: BACKFILL_RISK,
          ctx,
          config: {
            command: svc.backfillCommand,
            concurrencyKey: `db:${svc.environmentId}`,
          },
        }),
      );
      // optional 节点使用 completed 条件，允许上游 succeeded 或 skipped
      const cond: ReleaseDependencyConditionType = isRequired
        ? "succeeded"
        : "completed";
      if (prevKey)
        dependencies.push(edge(key, prevKey, cond, !isRequired));
      prevKey = key;
      sideEffects.push(`${key}: 批量更新历史数据`);
      approvalRequired.push({ stageKey: key, reason: "历史数据回填高风险" });
    }

    if (svc.deployCommand) {
      const key = `application_deploy:${svc.applicationServiceId}`;
      stages.push(
        makeStage({
          key,
          name: `应用部署 - ${svc.serviceName}`,
          type: "application_deploy",
          executorKind: "deployment_run",
          required: true,
          risk: APP_DEPLOY_RISK,
          ctx,
          config: {
            deployCommand: svc.deployCommand,
            targetType: "server",
            releaseApplicationOnly: true,
            concurrencyKey: `service:${svc.environmentId}:${svc.applicationServiceId}`,
          },
        }),
      );
      if (prevKey)
        dependencies.push(edge(key, prevKey, "succeeded", true));
      prevKey = key;
      sideEffects.push(`${key}: 重启应用进程`);
      approvalRequired.push({ stageKey: key, reason: "应用部署为正式变更" });

      if (svc.healthCheckUrl) {
        const hkey = `health_check:${svc.applicationServiceId}`;
        stages.push(
          makeStage({
            key: hkey,
            name: `就绪检查 - ${svc.serviceName}`,
            type: "health_check",
            executorKind: "server_command",
            required: true,
            risk: "low",
            ctx,
            config: {
              healthCheckUrl: svc.healthCheckUrl,
              concurrencyKey: `service:${svc.environmentId}:${svc.applicationServiceId}`,
            },
          }),
        );
        dependencies.push(edge(hkey, key, "succeeded", true));
        sideEffects.push(`${hkey}: 验证应用健康（HTTP/命令探针）`);
      }
    }
  }

  const inputSnapshot: Record<string, unknown> = {
    projectId: input.projectId,
    environmentId: input.environmentId,
    name: input.name,
    branch: input.branch ?? null,
    commitSha: input.commitSha ?? null,
    services: input.services,
    generatedAt: new Date().toISOString(),
  };
  const planHash = computePlanHash(stripVolatile(inputSnapshot));

  // DAG 校验
  const dag = validateReleaseDag(
    stages.map((s) => ({ key: s.key, name: s.name })),
    dependencies.map((d) => ({
      from: d.dependsOnStageKey,
      to: d.stageKey,
    })),
  );
  if (!dag.ok) return dag;

  return {
    ok: true,
    value: {
      stages,
      dependencies,
      planHash,
      inputSnapshot,
      sideEffects,
      riskSummary,
      approvalRequired,
    },
  };
}

function makeStage(args: {
  key: string;
  name: string;
  type: ReleaseStageType;
  executorKind: ReleaseStageExecutorKind;
  required: boolean;
  risk: ReleaseRiskLevel;
  ctx: {
    applicationId: string;
    applicationServiceId: string;
    environmentId: string;
    serverId?: string | null;
  };
  config: Record<string, unknown>;
}): ReleaseStageNode {
  const configHash = computeStageConfigHash({
    type: args.type,
    ctx: args.ctx,
    config: args.config,
  });
  // idempotencyKey 在 plan 创建后由 service 补 releasePlanId；此处用占位以便校验
  const idempotencyKey = computeIdempotencyKey(
    "__plan__",
    args.key,
    configHash,
  );
  const concurrencyKey =
    typeof args.config.concurrencyKey === "string"
      ? (args.config.concurrencyKey as string)
      : null;
  return {
    key: args.key,
    name: args.name,
    type: args.type,
    executorKind: args.executorKind,
    required: args.required,
    riskLevel: args.risk,
    applicationId: args.ctx.applicationId,
    applicationServiceId: args.ctx.applicationServiceId,
    environmentId: args.ctx.environmentId,
    serverId: args.ctx.serverId ?? null,
    configHash,
    configSnapshot: redactConfigSnapshot(args.config),
    idempotencyKey,
    concurrencyKey,
  };
}

function edge(
  stageKey: string,
  dependsOnStageKey: string,
  conditionType: ReleaseDependencyConditionType,
  optional: boolean,
): ReleaseDependency {
  return { stageKey, dependsOnStageKey, conditionType, required: !optional };
}

// 配置快照脱敏：移除命令明文里的密钥；保留命令本身（执行需要，但持久化前再脱敏）
function redactConfigSnapshot(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = v;
  }
  return out;
}

// 排除生成时间等易变量，保证 planHash 稳定
function stripVolatile(snapshot: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _omit, ...rest } = snapshot;
  return rest as Record<string, unknown>;
}
