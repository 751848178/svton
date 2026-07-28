/**
 * 发布计划规范化快照（P0-2）：把会影响实际执行图的所有输入，归一化为稳定、可审计、
 * 顺序无关的 canonical 结构，供 planHash 计算。
 *
 * 旧实现的 planHash 只 hash {projectId, environmentId, name, branch, commitSha,
 * gitRepo, services, generatedAt}，遗漏了 serviceDependencies 与解析后的
 * stages/dependencies。结果是「无跨服务边」与「有跨服务边」产生相同 planHash，
 * 用户可预览一种依赖、再在创建时提交另一种而不触发 RELEASE_PLAN_STALE。
 *
 * 本快照覆盖：project/environment；VCS（branch/commitSha/gitRepo）；规范化服务集
 * （仅选择器，不含原始 shell）；服务端解析的跨服务依赖；最终 stages（含 configHash，
 * 后者已覆盖 command/concurrencyKey/runPolicy/VCS）；最终 dependencies；风险/required/
 * 审批要求。声明顺序不同 → 规范化后相同 → hash 相同。
 *
 * 不含：generatedAt、随机 id、planId、idempotencyKey（planId 占位导致易变）。
 * 不含明文秘密：快照内 services 只含选择器字段，命令经由 stage.configHash 间接覆盖。
 */
import type { ReleaseServiceInput, ReleaseStageNode, ReleaseDependency } from "./release-plan-builder.utils";
import type { ServiceDependencyEdge } from "./release-cross-service-edges.utils";

interface SnapshotInput {
  input: {
    projectId: string;
    environmentId: string;
    name: string;
    branch?: string | null;
    commitSha?: string | null;
    gitRepo?: string | null;
    services: ReleaseServiceInput[];
    serviceDependencies?: ServiceDependencyEdge[];
  };
  stages: ReleaseStageNode[];
  dependencies: ReleaseDependency[];
  approvalRequired: Array<{ stageKey: string; reason: string }>;
}

// 规范化服务选择器：只取影响执行的字段，丢弃原始 shell 命令（由 stage.configHash 覆盖）。
interface NormalizedService {
  applicationId: string;
  applicationServiceId: string;
  environmentId: string;
  serverId: string | null;
  serviceName: string;
  backfillRequired: boolean;
}

interface NormalizedServiceDependency {
  fromServiceId: string;
  fromStageType: string;
  toServiceId: string;
  toStageType: string;
  conditionType: string;
  required: boolean;
}

interface NormalizedStage {
  key: string;
  type: string;
  executorKind: string;
  required: boolean;
  riskLevel: string;
  configHash: string;
  concurrencyKey: string | null;
}

interface NormalizedDependency {
  stageKey: string;
  dependsOnStageKey: string;
  conditionType: string;
  required: boolean;
}

// 比较器：稳定排序，使数组顺序不影响 hash。
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// 构建规范化、顺序无关的 plan snapshot。纯函数。
export function buildCanonicalPlanSnapshot({
  input,
  stages,
  dependencies,
  approvalRequired,
}: SnapshotInput): Record<string, unknown> {
  const services: NormalizedService[] = input.services
    .map((s) => ({
      applicationId: s.applicationId,
      applicationServiceId: s.applicationServiceId,
      environmentId: s.environmentId,
      serverId: s.serverId ?? null,
      serviceName: s.serviceName,
      backfillRequired: s.backfillRequired === true,
    }))
    .sort((a, b) =>
      cmp(a.applicationServiceId, b.applicationServiceId) ||
      cmp(a.environmentId, b.environmentId),
    );

  const serviceDependencies: NormalizedServiceDependency[] = (input.serviceDependencies ?? [])
    .map((d) => ({
      fromServiceId: d.fromServiceId,
      fromStageType: d.fromStageType,
      toServiceId: d.toServiceId,
      toStageType: d.toStageType,
      conditionType: d.conditionType,
      required: d.required ?? true,
    }))
    .sort((a, b) =>
      cmp(a.fromServiceId, b.fromServiceId) ||
      cmp(a.fromStageType, b.fromStageType) ||
      cmp(a.toServiceId, b.toServiceId) ||
      cmp(a.toStageType, b.toStageType) ||
      cmp(a.conditionType, b.conditionType),
    );

  const normalizedStages: NormalizedStage[] = stages
    .map((s) => ({
      key: s.key,
      type: s.type,
      executorKind: s.executorKind,
      required: s.required,
      riskLevel: s.riskLevel,
      configHash: s.configHash ?? "",
      concurrencyKey: s.concurrencyKey ?? null,
    }))
    .sort((a, b) => cmp(a.key, b.key));

  const normalizedDeps: NormalizedDependency[] = dependencies
    .map((d) => ({
      stageKey: d.stageKey,
      dependsOnStageKey: d.dependsOnStageKey,
      conditionType: d.conditionType,
      required: d.required,
    }))
    .sort((a, b) =>
      cmp(a.stageKey, b.stageKey) || cmp(a.dependsOnStageKey, b.dependsOnStageKey),
    );

  const approval = [...approvalRequired].sort((a, b) => cmp(a.stageKey, b.stageKey));

  return {
    v: 2,
    projectId: input.projectId,
    environmentId: input.environmentId,
    name: input.name,
    branch: input.branch ?? null,
    commitSha: input.commitSha ?? null,
    gitRepo: input.gitRepo ?? null,
    services,
    serviceDependencies,
    stages: normalizedStages,
    dependencies: normalizedDeps,
    approvalRequired: approval,
  };
}
