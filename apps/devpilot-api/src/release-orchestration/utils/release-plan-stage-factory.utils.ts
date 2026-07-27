/**
 * 单服务阶段工厂（纯函数）：把一个 ReleaseServiceInput 翻译成阶段节点 + 依赖边 +
 * 副作用/风险摘要。由 release-plan-builder 跨服务编排调用。
 */
import { computeIdempotencyKey, computeStageConfigHash } from "./release-hash.utils";
import type {
  ReleaseDependencyConditionType,
  ReleaseRiskLevel,
  ReleaseStageDefinition,
  ReleaseStageExecutorKind,
  ReleaseStageType,
} from "../types/release-orchestration.types";
import type { ReleaseDependency, ReleaseServiceInput } from "./release-plan-builder.utils";

export interface ServiceStageResult {
  stages: Array<ReleaseStageDefinition & { idempotencyKey: string }>;
  dependencies: ReleaseDependency[];
  sideEffects: string[];
  approvalRequired: Array<{ stageKey: string; reason: string }>;
}

const SCHEMA_MIGRATION_RISK: ReleaseRiskLevel = "high";
const BOOTSTRAP_RISK: ReleaseRiskLevel = "medium";
const BACKFILL_RISK: ReleaseRiskLevel = "high";
const APP_DEPLOY_RISK: ReleaseRiskLevel = "medium";

export interface StageCtx {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
}

export function buildServiceStages(svc: ReleaseServiceInput): ServiceStageResult {
  const stages: ServiceStageResult["stages"] = [];
  const dependencies: ReleaseDependency[] = [];
  const sideEffects: string[] = [];
  const approvalRequired: ServiceStageResult["approvalRequired"] = [];
  const ctx: StageCtx = {
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
        config: { command: svc.migrationCommand, concurrencyKey: `db:${svc.environmentId}` },
      }),
    );
    if (prevKey) dependencies.push(edge(key, prevKey, "succeeded", true));
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
    if (prevKey) dependencies.push(edge(key, prevKey, "succeeded", true));
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
        config: { command: svc.backfillCommand, concurrencyKey: `db:${svc.environmentId}` },
      }),
    );
    const cond: ReleaseDependencyConditionType = isRequired ? "succeeded" : "completed";
    if (prevKey) dependencies.push(edge(key, prevKey, cond, !isRequired));
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
    if (prevKey) dependencies.push(edge(key, prevKey, "succeeded", true));
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

  return { stages, dependencies, sideEffects, approvalRequired };
}

export function makeStage(args: {
  key: string;
  name: string;
  type: ReleaseStageType;
  executorKind: ReleaseStageExecutorKind;
  required: boolean;
  risk: ReleaseRiskLevel;
  ctx: StageCtx;
  config: Record<string, unknown>;
}): ReleaseStageDefinition & { idempotencyKey: string } {
  const configHash = computeStageConfigHash({
    type: args.type,
    ctx: args.ctx,
    config: args.config,
  });
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
    configSnapshot: { ...args.config },
    idempotencyKey: computeIdempotencyKey("__plan__", args.key, configHash),
    concurrencyKey:
      typeof args.config.concurrencyKey === "string"
        ? (args.config.concurrencyKey as string)
        : null,
  };
}

export function edge(
  stageKey: string,
  dependsOnStageKey: string,
  conditionType: ReleaseDependencyConditionType,
  optional: boolean,
): ReleaseDependency {
  return { stageKey, dependsOnStageKey, conditionType, required: !optional };
}
