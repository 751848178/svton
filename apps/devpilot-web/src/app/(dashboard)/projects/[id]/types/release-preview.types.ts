/** 项目详情域 - 发布预览契约类型（F383）。
 *  单一职责：预览阶段的阶段节点、依赖警告、执行器预检警告、计划预览聚合。 */

/** 预览阶段的节点视图。 */
export interface ReleaseStagePreview {
  key: string;
  name: string;
  type: string;
  executorKind: string;
  required: boolean;
  riskLevel: string;
  configHash?: string | null;
  concurrencyKey?: string | null;
  /** builder 写入的 Git 版本，便于向导预览展示。 */
  branch?: string | null;
  commitSha?: string | null;
  gitRepo?: string | null;
  applicationServiceName?: string | null;
}

/** P0-2(b)：optional 依赖目标缺失/跨域的非阻断警告（预览区展示，不阻止创建）。 */
export interface ReleaseDepWarning {
  code: string;
  applicationServiceId: string;
  serviceName: string;
  dependencyIndex: number;
  toServiceId: string;
  reason: string;
  suggestedAction: string;
}

/** 执行器预检警告（与后端 ExecutorPreflightWarningSnapshot 对齐）。 */
export interface ReleaseExecutorPreflightWarning {
  applicationServiceId: string;
  serviceName: string;
  serverId: string;
  reason: string;
  suggestedAction: string;
}

/** 发布计划预览聚合（preview/create 返回）。 */
export interface ReleasePlanPreview {
  stages: ReleaseStagePreview[];
  dependencies: Array<{
    stageKey: string;
    dependsOnStageKey: string;
    conditionType: string;
    required: boolean;
  }>;
  planHash: string;
  sideEffects: string[];
  riskSummary: Array<{ stageKey: string; risk: string }>;
  approvalRequired: Array<{ stageKey: string; reason: string }>;
  /** optional 依赖警告（后端 P0-2b 回传；旧后端可能不带该字段，消费方需容错）。 */
  warnings?: ReleaseDepWarning[];
  /** F383 §B — 执行器能力预检警告（live 未启用 / authType 不受支持 / 服务器缺失）。 */
  executorWarnings?: ReleaseExecutorPreflightWarning[];
}
