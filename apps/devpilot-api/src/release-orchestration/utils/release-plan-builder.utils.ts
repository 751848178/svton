/**
 * 发布计划构建器（纯函数，F383）：跨服务编排阶段工厂，校验 DAG，计算 planHash。
 * 不读取 DB、不执行副作用。dry-run 与正式计划共用本函数。
 * 类型契约见 release-plan-builder.types；inputSnapshot 装配见 release-plan-input-snapshot。
 */
import { computePlanHash } from "./release-hash.utils";
import { validateReleaseDag } from "./release-dag.utils";
import type { ReleaseDagResult } from "./release-dag.utils";
import { validateServiceOwnership } from "./release-env-validation.utils";
import { buildServiceStages, makeStage as _unusedMakeStage } from "./release-plan-stage-factory.utils";
import { resolveCrossServiceEdges } from "./release-cross-service-edges.utils";
import { buildCanonicalPlanSnapshot } from "./release-plan-snapshot.utils";
import { buildInputSnapshot } from "./release-plan-input-snapshot.utils";
import type {
  ReleasePlanBuildInput,
  ReleaseStageNode,
  ReleaseDependency,
  ReleasePlanPreview,
} from "./release-plan-builder.types";

// 重新导出类型，保持 `from "./release-plan-builder.utils"` 的既有导入路径稳定。
export type {
  ReleaseServiceInput,
  ReleasePlanBuildInput,
  ReleaseStageNode,
  ReleaseDependency,
  ReleasePlanPreview,
  ExecutorPreflightWarningSnapshot,
} from "./release-plan-builder.types";

void _unusedMakeStage;

export function buildReleasePlan(
  input: ReleasePlanBuildInput,
): ReleaseDagResult<ReleasePlanPreview> {
  // CR-3-F1：空 services 防御——DTO 层已 @ArrayMinSize(1)，但 builder 作为纯函数层
  // 再断言一次（preview/create 直接调用时也拦截）。空计划被执行会"成功"为 no-op。
  if (!input.services || input.services.length === 0) {
    return {
      ok: false,
      error: { kind: "missing_reference", message: "至少选择一个应用服务" },
    };
  }
  const stages: ReleaseStageNode[] = [];
  const dependencies: ReleaseDependency[] = [];
  const sideEffects: string[] = [];
  const approvalRequired: ReleasePlanPreview["approvalRequired"] = [];

  for (const svc of input.services) {
    // 防御性环境一致性（invest-3 §A.2 第二道闸）：控制器已做 DB 级校验，builder 再断言一次。
    const ownership = validateServiceOwnership(svc, input.environmentId);
    if (!ownership.ok) {
      return { ok: false, error: { kind: "missing_reference", message: ownership.message } };
    }
    // plan-level 分支/commit/仓库覆盖 per-service 值（发布计划目标是权威）。
    const svcWithVcs: ReleasePlanBuildInput["services"][number] = {
      ...svc,
      branch: input.branch ?? svc.branch,
      commitSha: input.commitSha ?? svc.commitSha,
      gitRepo: input.gitRepo ?? svc.gitRepo,
    };
    const result = buildServiceStages(svcWithVcs);
    stages.push(...result.stages);
    dependencies.push(...result.dependencies);
    sideEffects.push(...result.sideEffects);
    approvalRequired.push(...result.approvalRequired);
  }

  // 跨服务依赖边：在所有 per-service 阶段收集完毕后叠加。
  if (input.serviceDependencies && input.serviceDependencies.length > 0) {
    const knownStageKeys = new Set(stages.map((s) => s.key));
    const resolved = resolveCrossServiceEdges(input.serviceDependencies, knownStageKeys);
    if (!resolved.ok) {
      return { ok: false, error: { kind: resolved.kind, message: resolved.message } };
    }
    dependencies.push(...resolved.edges);
  }

  const dag = validateReleaseDag(
    stages.map((s) => ({ key: s.key, name: s.name })),
    dependencies.map((d) => ({ from: d.dependsOnStageKey, to: d.stageKey })),
  );
  if (!dag.ok) return dag;

  // P0-2：planHash 绑定依赖图。canonical snapshot 覆盖会影响实际执行的全部输入
  // （含 serviceDependencies 与解析后的 stages/dependencies），顺序无关、不含易变字段。
  // P0-2(b)：warnings 也纳入 hash——optional 警告变化 → planHash 改变 → STALE 阻断陈旧创建。
  const dependencyWarnings = input.dependencyWarnings ?? [];
  const canonicalSnapshot = buildCanonicalPlanSnapshot({
    input: { ...input, serviceDependencies: input.serviceDependencies ?? [] },
    stages,
    dependencies,
    approvalRequired,
    dependencyWarnings,
  });
  const planHash = computePlanHash(canonicalSnapshot);

  return {
    ok: true,
    value: {
      stages,
      dependencies,
      planHash,
      inputSnapshot: buildInputSnapshot({
        input, stages, dependencies, approvalRequired, dependencyWarnings,
      }),
      sideEffects,
      riskSummary: [],
      approvalRequired,
      warnings: dependencyWarnings,
      executorWarnings: input.executorWarnings ?? [],
    },
  };
}
