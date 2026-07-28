/**
 * 发布计划构建器（纯函数）：跨服务编排阶段工厂，校验 DAG，计算 planHash。
 * 不读取 DB、不执行副作用。dry-run 与正式计划共用本函数。
 */
import { computePlanHash } from "./release-hash.utils";
import { validateReleaseDag } from "./release-dag.utils";
import type { ReleaseDagResult } from "./release-dag.utils";
import { validateServiceOwnership } from "./release-env-validation.utils";
import {
  buildServiceStages,
  makeStage as _unusedMakeStage,
} from "./release-plan-stage-factory.utils";
import type {
  ServiceDependencyEdge,
} from "./release-cross-service-edges.utils";
import { resolveCrossServiceEdges } from "./release-cross-service-edges.utils";
import { buildCanonicalPlanSnapshot } from "./release-plan-snapshot.utils";
import type {
  ReleaseRiskLevel,
  ReleaseStageDefinition,
} from "../types/release-orchestration.types";

void _unusedMakeStage;

// 单个应用服务在发布计划中的解析输入
export interface ReleaseServiceInput {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
  serviceName: string;
  preStartCheckCommand?: string;
  migrationCommand?: string;
  initializationCommand?: string;
  deployCommand?: string;
  healthCheckUrl?: string;
  backfillCommand?: string;
  backfillRequired?: boolean;
  // VCS 透传到 application_deploy 阶段 configSnapshot；plan-level 输入覆盖 per-service 值。
  branch?: string;
  commitSha?: string;
  gitRepo?: string;
}

export interface ReleasePlanBuildInput {
  projectId: string;
  environmentId: string;
  name: string;
  branch?: string;
  commitSha?: string;
  gitRepo?: string;
  services: ReleaseServiceInput[];
  // 跨服务依赖边（显式声明，Devpilot 不推断）。Picshare 的 backend-readiness → admin-deploy 在此声明。
  serviceDependencies?: ServiceDependencyEdge[];
}

export interface ReleaseStageNode extends ReleaseStageDefinition {
  idempotencyKey: string;
}

export interface ReleaseDependency {
  stageKey: string;
  dependsOnStageKey: string;
  conditionType: ReleaseDependencyConditionType;
  required: boolean;
}

export interface ReleasePlanPreview {
  stages: ReleaseStageNode[];
  dependencies: ReleaseDependency[];
  planHash: string;
  inputSnapshot: Record<string, unknown>;
  sideEffects: string[];
  riskSummary: Array<{ stageKey: string; risk: ReleaseRiskLevel }>;
  approvalRequired: Array<{ stageKey: string; reason: string }>;
}

import type { ReleaseDependencyConditionType } from "../types/release-orchestration.types";

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
    // 防御性环境一致性（invest-3 §A.2 第二道闸）：控制器已做 DB 级校验，
    // 但 builder 作为纯函数层再断言一次——任何 environmentId 漂移立即拦截，
    // 返回 missing_reference（preview/create → RELEASE_PLAN_INVALID）。
    const ownership = validateServiceOwnership(svc, input.environmentId);
    if (!ownership.ok) {
      return {
        ok: false,
        error: { kind: "missing_reference", message: ownership.message },
      };
    }
    // plan-level 分支/commit/仓库覆盖 per-service 值（发布计划目标是权威）。
    const svcWithVcs: ReleaseServiceInput = {
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
  // 引用不存在的 service/stageType → missing_reference（preview/create 抛 RELEASE_PLAN_INVALID）。
  if (input.serviceDependencies && input.serviceDependencies.length > 0) {
    const knownStageKeys = new Set(stages.map((s) => s.key));
    const resolved = resolveCrossServiceEdges(input.serviceDependencies, knownStageKeys);
    if (!resolved.ok) {
      return {
        ok: false,
        error: { kind: resolved.kind, message: resolved.message },
      };
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
  const canonicalSnapshot = buildCanonicalPlanSnapshot({
    input: { ...input, serviceDependencies: input.serviceDependencies ?? [] },
    stages,
    dependencies,
    approvalRequired,
  });
  const planHash = computePlanHash(canonicalSnapshot);

  // 持久化/返回用的 inputSnapshot：保留可读的服务与依赖图，供审计与诊断；
  // 与 canonicalSnapshot 同源但保留人类可读结构（含 generatedAt，不进 hash）。
  const inputSnapshot: Record<string, unknown> = {
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
    generatedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    value: {
      stages,
      dependencies,
      planHash,
      inputSnapshot,
      sideEffects,
      riskSummary: [],
      approvalRequired,
    },
  };
}
