/**
 * 发布计划构建器的类型契约（F383 结构约束拆分）。
 * 单一职责：仅声明 builder 输入/输出/中间结构接口，与纯函数实现解耦，
 * 便于 stage-factory / snapshot 等只导入类型而不带入运行时依赖。
 */
import type { ReleaseDependencyConditionType } from "../types/release-orchestration.types";
import type { ReleaseRiskLevel, ReleaseStageDefinition } from "../types/release-orchestration.types";
import type {
  ServiceDependencyEdge,
} from "./release-cross-service-edges.utils";
import type { ReleaseDepWarning } from "./release-dep-error.utils";

/** 单个应用服务在发布计划中的解析输入。 */
export interface ReleaseServiceInput {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId?: string | null;
  serviceName: string;
  workingDirectory?: string;
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
  // P0-2(b)：optional 依赖目标缺失/跨域的结构化警告（不阻断，回传 UI 预览区）。
  dependencyWarnings?: ReleaseDepWarning[];
  // F383 §B：执行器能力预检警告（live 未启用 / authType 不受支持 / 服务器缺失）。
  executorWarnings?: ExecutorPreflightWarningSnapshot[];
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
  warnings: ReleaseDepWarning[];
  executorWarnings: ExecutorPreflightWarningSnapshot[];
}

/** 执行器预检警告的快照形状（与 ReleaseExecutorPreflightWarning 对齐，可序列化）。 */
export interface ExecutorPreflightWarningSnapshot {
  applicationServiceId: string;
  serviceName: string;
  serverId: string;
  reason: string;
  suggestedAction: string;
}
