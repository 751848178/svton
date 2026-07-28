/**
 * 发布计划创建阶段的持久化数据映射（F383 结构约束拆分）。
 * 单一职责：把 builder 产出的 ReleaseStageNode 列表映射为 planRepo.persistPlanWithStages
 * 期望的 stage 行形状——纯转换，无副作用，便于单测与复用。
 */
import type { ReleaseStageNode } from "./release-plan-builder.types";

/** persistPlanWithStages 期望的单个 stage 输入形状。 */
export interface PersistStageInput {
  key: string;
  name: string;
  type: string;
  executorKind: string;
  applicationId: string | null;
  applicationServiceId: string | null;
  environmentId: string | null;
  serverId: string | null;
  configSnapshot: Record<string, unknown>;
  configHash: string | null;
  concurrencyKey: string | null;
  riskLevel: string;
  required: boolean;
}

/** 把 builder 的 stage 列表映射为持久层 stage 行输入。 */
export function mapStagesForPersist(stages: ReleaseStageNode[]): PersistStageInput[] {
  return stages.map((stage) => ({
    key: stage.key,
    name: stage.name,
    type: stage.type,
    executorKind: stage.executorKind,
    applicationId: stage.applicationId ?? null,
    applicationServiceId: stage.applicationServiceId ?? null,
    environmentId: stage.environmentId ?? null,
    serverId: stage.serverId ?? null,
    configSnapshot: stage.configSnapshot ?? {},
    configHash: stage.configHash ?? null,
    concurrencyKey: stage.concurrencyKey ?? null,
    riskLevel: stage.riskLevel,
    required: stage.required,
  }));
}
