/**
 * 服务发布依赖边解析（F383 Item 1 fail-closed）。纯函数，不读 DB。
 *
 * 从 deployConfig.releaseDependencies（顶层 + deployment 子层）解析该服务声明的出向跨服务
 * 依赖边。每条边只声明下游（toServiceId/toStageType）+ 上游阶段（fromStageType）+ 条件/必需；
 * fromServiceId 隐式为所属 ApplicationService，杜绝客户端伪造。
 *
 * Item 1 fail-closed：畸形 / 缺字段 / 非法 stage / 非法 condition / 冲突重复 全部以
 * ReleaseDepParseError 结构化返回，调用方升级为 HTTP 400。服务级校验（自依赖/未选/不存在/
 * 跨域）在 ReleaseDependencyResolverService 完成（需 DB）。
 */
import type {
  ReleaseDependencyConditionType,
  ReleaseStageType,
} from "../types/release-orchestration.types";
import {
  RELEASE_DEPENDENCY_CONDITION_TYPES,
  RELEASE_STAGE_TYPES,
} from "../types/release-orchestration.types";
import type { ReleaseDepParseError } from "./release-dep-error.utils";

// deployConfig.releaseDependencies 数组里的一条声明边（从下游视角看自己依赖谁，
// 故只填下游 = toServiceId/toStageType，fromServiceId 由所属服务填充）。
// sourceIndex：该边在合并数组（顶层 + deployment 子层）中的原始 0-based 下标，
// 与 parser errors 的 dependencyIndex 同源（CR B1）——resolver 用它把服务级错误
// （自依赖/未选/不存在/跨域）的报告下标对齐用户在配置里看到的真实位置。
export interface DeclaredServiceDependencyEdge {
  toServiceId: string;
  fromStageType: ReleaseStageType;
  toStageType: ReleaseStageType;
  conditionType: ReleaseDependencyConditionType;
  required?: boolean;
  sourceIndex: number;
}

type EdgeField = "toServiceId" | "fromStageType" | "toStageType" | "conditionType";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const STAGE_TYPE_SET = new Set<string>(RELEASE_STAGE_TYPES);
const CONDITION_TYPE_SET = new Set<string>(RELEASE_DEPENDENCY_CONDITION_TYPES);

// 读取单个声明边（Item 1 fail-closed）：畸形/字段非法 → 返回结构化 error，
// 不再静默返回 undefined。errors 携带 dependencyIndex（合并数组下标）。
function readDeclaredEdge(
  raw: unknown,
  index: number,
): DeclaredServiceDependencyEdge | ReleaseDepParseError {
  const rec = asRecord(raw);
  if (!rec) {
    return {
      code: "RELEASE_DEP_MALFORMED",
      dependencyIndex: index,
      invalidValue: raw,
      reason: "dependency entry is not a JSON object",
      suggestedAction: "请在服务部署配置中修正该依赖项（必须是合法对象）",
    };
  }
  const fields: Record<EdgeField, string | undefined> = {
    toServiceId: readString(rec.toServiceId),
    fromStageType: readString(rec.fromStageType),
    toStageType: readString(rec.toStageType),
    conditionType: readString(rec.conditionType),
  };
  for (const field of [
    "toServiceId",
    "fromStageType",
    "toStageType",
    "conditionType",
  ] as EdgeField[]) {
    if (!fields[field]) {
      return {
        code: "RELEASE_DEP_MISSING_FIELD",
        dependencyIndex: index,
        field,
        reason: `missing required field ${field}`,
        suggestedAction: `请在服务部署配置中补全该依赖项的 ${field} 字段`,
      };
    }
  }
  const fromStageType = fields.fromStageType as string;
  const toStageType = fields.toStageType as string;
  const conditionType = fields.conditionType as string;
  if (!STAGE_TYPE_SET.has(fromStageType)) {
    return {
      code: "RELEASE_DEP_INVALID_STAGE_TYPE",
      dependencyIndex: index,
      field: "fromStageType",
      invalidValue: fromStageType,
      allowedValues: RELEASE_STAGE_TYPES,
      reason: `unsupported fromStageType: ${fromStageType}`,
      suggestedAction: `上游阶段「${fromStageType}」不支持，请到服务部署配置中修正`,
    };
  }
  if (!STAGE_TYPE_SET.has(toStageType)) {
    return {
      code: "RELEASE_DEP_INVALID_STAGE_TYPE",
      dependencyIndex: index,
      field: "toStageType",
      invalidValue: toStageType,
      allowedValues: RELEASE_STAGE_TYPES,
      reason: `unsupported toStageType: ${toStageType}`,
      suggestedAction: `下游阶段「${toStageType}」不支持，请到服务部署配置中修正`,
    };
  }
  if (!CONDITION_TYPE_SET.has(conditionType)) {
    return {
      code: "RELEASE_DEP_INVALID_CONDITION_TYPE",
      dependencyIndex: index,
      field: "conditionType",
      invalidValue: conditionType,
      allowedValues: RELEASE_DEPENDENCY_CONDITION_TYPES,
      reason: `unsupported conditionType: ${conditionType}`,
      suggestedAction: `条件类型「${conditionType}」不支持，请到服务部署配置中修正`,
    };
  }
  const required = typeof rec.required === "boolean" ? rec.required : true;
  return {
    toServiceId: fields.toServiceId as string,
    fromStageType: fromStageType as ReleaseStageType,
    toStageType: toStageType as ReleaseStageType,
    conditionType: conditionType as ReleaseDependencyConditionType,
    required,
    sourceIndex: index,
  };
}

export interface ReleaseDependencyParseResult {
  edges: DeclaredServiceDependencyEdge[];
  errors: ReleaseDepParseError[];
}

// 读取该服务声明的所有跨服务发布依赖边（出向）。从 deployConfig.releaseDependencies
// 数组读取（顶层 + deployment 子层，与命令字段同源），解析并做去重冲突检测。
//
// Item 1 fail-closed：畸形/缺字段/非法 stage/非法 condition/重复且相互冲突的依赖，
// 全部以 errors[] 返回，调用方必须升级为 HTTP 400 阻断。完全相同的重复条目（键与字段
// 都一致）允许去重（视为冗余声明，非冲突）。
export function readServiceReleaseDependencies(
  deployConfig: unknown,
): ReleaseDependencyParseResult {
  const top = asRecord(deployConfig);
  if (!top) return { edges: [], errors: [] };
  const arrays: unknown[] = [];
  const topArr = Array.isArray(top.releaseDependencies)
    ? top.releaseDependencies
    : null;
  if (topArr) arrays.push(...topArr);
  const deployment = asRecord(top.deployment);
  if (deployment && Array.isArray(deployment.releaseDependencies)) {
    arrays.push(...deployment.releaseDependencies);
  }
  const edges: DeclaredServiceDependencyEdge[] = [];
  const errors: ReleaseDepParseError[] = [];
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
      const sameRequired = (prev.edge.required ?? true) === (edge.required ?? true);
      if (!sameRequired) {
        const differingFields = ["required"];
        errors.push({
          code: "RELEASE_DEP_DUPLICATE_CONFLICT",
          dependencyIndex: idx,
          conflictWithIndex: prev.index,
          differingFields,
          toServiceId: edge.toServiceId,
          reason: `duplicate dependency key with conflicting fields: ${differingFields.join(",")}`,
          suggestedAction: `该依赖与第 ${prev.index + 1} 条声明了相同的依赖键但字段冲突（${differingFields.join("、")}），请统一配置`,
        });
      }
      return;
    }
    seen.set(key, { index: idx, edge });
    edges.push(edge);
  });
  return { edges, errors };
}
