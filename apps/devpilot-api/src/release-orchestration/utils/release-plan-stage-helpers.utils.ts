/**
 * 阶段工厂低层助手：阶段节点构造、依赖边构造、风险级别常量。
 * 由 release-plan-stage-factory 调用，保持单职责（解析 vs 构造分离）。
 */
import { computeIdempotencyKey, computeStageConfigHash } from "./release-hash.utils";
import type {
  ReleaseDependencyConditionType,
  ReleaseRiskLevel,
  ReleaseStageDefinition,
  ReleaseStageExecutorKind,
  ReleaseStageType,
} from "../types/release-orchestration.types";
import type { ReleaseDependency } from "./release-plan-builder.utils";

export const SCHEMA_MIGRATION_RISK: ReleaseRiskLevel = "high";
export const BOOTSTRAP_RISK: ReleaseRiskLevel = "medium";
export const BACKFILL_RISK: ReleaseRiskLevel = "high";
export const APP_DEPLOY_RISK: ReleaseRiskLevel = "medium";

export interface StageCtx {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
}

// 构造阶段节点：计算 configHash + idempotencyKey（preview 用 "__plan__" 占位，持久化时重算）。
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

// 构造依赖边。optional=true → required=false。
export function edge(
  stageKey: string,
  dependsOnStageKey: string,
  conditionType: ReleaseDependencyConditionType,
  optional: boolean,
): ReleaseDependency {
  return { stageKey, dependsOnStageKey, conditionType, required: !optional };
}
