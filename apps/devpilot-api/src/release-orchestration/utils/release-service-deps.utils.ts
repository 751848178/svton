/**
 * 服务发布依赖边解析（F383 Item 1 fail-closed + P0-2）。纯函数，不读 DB。
 *
 * 从 deployConfig.releaseDependencies（顶层 + deployment 子层）合并声明边，逐条
 * 校验（见 release-service-dep-edge.utils）并做去重冲突检测。每条边只声明下游
 * （toServiceId/toStageType）+ 上游阶段 + 条件/必需；fromServiceId 隐式为所属服务。
 *
 * fail-closed：畸形/缺字段/非法 stage/非法 condition/冲突重复/非数组（P0-2a）全部以
 * ReleaseDepParseError 结构化返回，调用方升级为 HTTP 400。服务级校验（自依赖/未选/
 * 不存在/跨域）在 ReleaseDependencyResolverService 完成（需 DB）。
 */
import type {
  ReleaseDependencyConditionType,
  ReleaseStageType,
} from "../types/release-orchestration.types";
import type { ReleaseDepParseError } from "./release-dep-error.utils";
import {
  asRecord,
  readDeclaredEdge,
} from "./release-service-dep-edge.utils";

// 声明边（下游视角）。sourceIndex = 合并数组下标，与 parser errors 的 dependencyIndex
// 同源（CR B1），resolver 用其对齐服务级错误到用户配置里的真实位置。
export interface DeclaredServiceDependencyEdge {
  toServiceId: string;
  fromStageType: ReleaseStageType;
  toStageType: ReleaseStageType;
  conditionType: ReleaseDependencyConditionType;
  required?: boolean;
  sourceIndex: number;
}

export interface ReleaseDependencyParseResult {
  edges: DeclaredServiceDependencyEdge[];
  errors: ReleaseDepParseError[];
}

// 读取该服务声明的所有跨服务发布依赖边（顶层 + deployment 子层，与命令字段同源），
// 逐条校验并去重。完全相同的重复条目允许去重（视为冗余声明，非冲突）。
//
// P0-2(a)：releaseDependencies「存在但非数组」（字符串/对象等）不再静默忽略——
// 返回 INVALID_FIELD_TYPE 结构化错误，preview/create 均阻断。字段缺失仍视为无依赖。
export function readServiceReleaseDependencies(
  deployConfig: unknown,
): ReleaseDependencyParseResult {
  const top = asRecord(deployConfig);
  if (!top) return { edges: [], errors: [] };
  const arrays: unknown[] = [];
  const errors: ReleaseDepParseError[] = [];
  const deployment = asRecord(top.deployment);

  pushDeps(top, "顶层", arrays, errors);
  if (deployment) pushDeps(deployment, "deployment 子层", arrays, errors);

  const edges: DeclaredServiceDependencyEdge[] = [];
  const seen = new Map<
    string,
    { index: number; edge: DeclaredServiceDependencyEdge }
  >();
  arrays.forEach((raw, idx) => {
    const outcome = readDeclaredEdge(raw, idx);
    if ("code" in outcome) {
      errors.push(outcome);
      return;
    }
    const edge = outcome;
    const key = `${edge.toServiceId}|${edge.fromStageType}|${edge.toStageType}|${edge.conditionType}`;
    const prev = seen.get(key);
    if (prev) {
      if ((prev.edge.required ?? true) !== (edge.required ?? true)) {
        errors.push({
          code: "RELEASE_DEP_DUPLICATE_CONFLICT",
          dependencyIndex: idx,
          conflictWithIndex: prev.index,
          differingFields: ["required"],
          toServiceId: edge.toServiceId,
          reason: "duplicate dependency key with conflicting fields: required",
          suggestedAction: `该依赖与第 ${prev.index + 1} 条声明了相同的依赖键但字段冲突（required），请统一配置`,
        });
      }
      return;
    }
    seen.set(key, { index: idx, edge });
    edges.push(edge);
  });
  return { edges, errors };
}

// P0-2(a)：releaseDependencies 字段存在但非数组 → 结构化错误（fail-closed）。
// layer 用于在中文建议里指出问题出在顶层还是 deployment 子层。
function invalidFieldTypeError(
  invalidValue: unknown,
  layer: string,
): ReleaseDepParseError {
  const got = typeof invalidValue;
  return {
    code: "RELEASE_DEP_INVALID_FIELD_TYPE",
    dependencyIndex: 0,
    field: "releaseDependencies",
    invalidValue,
    reason: `${layer} releaseDependencies must be an array, got ${got}`,
    suggestedAction: `服务部署配置的${layer} releaseDependencies 必须是数组（当前为 ${got}），请改为依赖项数组或删除该字段`,
  };
}

// 把一层（顶层或 deployment 子层）的 releaseDependencies 合并进 arrays；
// 字段缺失 → 忽略；存在但非数组 → push INVALID_FIELD_TYPE 错误（fail-closed）。
function pushDeps(
  rec: Record<string, unknown>,
  layer: string,
  arrays: unknown[],
  errors: ReleaseDepParseError[],
) {
  if (!("releaseDependencies" in rec)) return;
  const deps = rec.releaseDependencies;
  if (Array.isArray(deps)) arrays.push(...deps);
  else errors.push(invalidFieldTypeError(deps, layer));
}
