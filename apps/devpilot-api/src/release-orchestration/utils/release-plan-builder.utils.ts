/**
 * 发布计划构建器（纯函数）：跨服务编排阶段工厂，校验 DAG，计算 planHash。
 * 不读取 DB、不执行副作用。dry-run 与正式计划共用本函数。
 */
import { computePlanHash } from "./release-hash.utils";
import { validateReleaseDag } from "./release-dag.utils";
import type { ReleaseDagResult } from "./release-dag.utils";
import {
  buildServiceStages,
  makeStage as _unusedMakeStage,
} from "./release-plan-stage-factory.utils";
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
  const stages: ReleaseStageNode[] = [];
  const dependencies: ReleaseDependency[] = [];
  const sideEffects: string[] = [];
  const approvalRequired: ReleasePlanPreview["approvalRequired"] = [];

  for (const svc of input.services) {
    const result = buildServiceStages(svc);
    stages.push(...result.stages);
    dependencies.push(...result.dependencies);
    sideEffects.push(...result.sideEffects);
    approvalRequired.push(...result.approvalRequired);
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

  const dag = validateReleaseDag(
    stages.map((s) => ({ key: s.key, name: s.name })),
    dependencies.map((d) => ({ from: d.dependsOnStageKey, to: d.stageKey })),
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
      riskSummary: [],
      approvalRequired,
    },
  };
}

// 排除生成时间等易变量，保证 planHash 稳定
function stripVolatile(snapshot: Record<string, unknown>): Record<string, unknown> {
  const { generatedAt: _omit, ...rest } = snapshot;
  void _omit;
  return rest as Record<string, unknown>;
}
