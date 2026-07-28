/**
 * 发布计划 inputSnapshot 装配纯函数（F383 结构约束拆分）。
 * 单一职责：把 builder 的解析输入 + 阶段/依赖/审批快照归一为可审计、人类可读的
 * inputSnapshot（与 canonicalSnapshot 同源但保留结构 + generatedAt，不进 planHash）。
 */
import type { ReleaseDependency } from "./release-plan-builder.types";
import type { ReleaseStageNode } from "./release-plan-builder.types";
import type { ReleasePlanBuildInput } from "./release-plan-builder.types";
import type { ReleaseDepWarning } from "./release-dep-error.utils";

interface BuildInputSnapshotArgs {
  input: ReleasePlanBuildInput;
  stages: ReleaseStageNode[];
  dependencies: ReleaseDependency[];
  approvalRequired: Array<{ stageKey: string; reason: string }>;
  dependencyWarnings: ReleaseDepWarning[];
}

/** 装配持久化/返回用的 inputSnapshot（保留服务与依赖图，供审计与诊断）。 */
export function buildInputSnapshot(args: BuildInputSnapshotArgs): Record<string, unknown> {
  const { input, stages, dependencies, approvalRequired, dependencyWarnings } = args;
  return {
    projectId: input.projectId,
    environmentId: input.environmentId,
    name: input.name,
    branch: input.branch ?? null,
    commitSha: input.commitSha ?? null,
    gitRepo: input.gitRepo ?? null,
    services: input.services,
    serviceDependencies: input.serviceDependencies ?? [],
    stages: stages.map((s) => ({
      key: s.key,
      type: s.type,
      executorKind: s.executorKind,
      required: s.required,
      riskLevel: s.riskLevel,
      configHash: s.configHash ?? null,
      concurrencyKey: s.concurrencyKey ?? null,
    })),
    dependencies,
    approvalRequired,
    dependencyWarnings,
    generatedAt: new Date().toISOString(),
  };
}
