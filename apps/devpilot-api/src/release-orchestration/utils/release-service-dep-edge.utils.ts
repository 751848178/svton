/**
 * 单条跨服务发布依赖边的校验（F383 Item 1 fail-closed）。纯函数，不读 DB。
 *
 * 从 release-service-deps.utils 拆出以守住 200-LOC 上限。readDeclaredEdge 把一条
 * 原始 JSON 声明边校验为 DeclaredServiceDependencyEdge，或返回结构化 parse error
 * （畸形/缺字段/非法 stage/非法 condition）。服务级校验在 resolver 完成。
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
import type { DeclaredServiceDependencyEdge } from "./release-service-deps.utils";

type EdgeField = "toServiceId" | "fromStageType" | "toStageType" | "conditionType";

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

const STAGE_TYPE_SET = new Set<string>(RELEASE_STAGE_TYPES);
const CONDITION_TYPE_SET = new Set<string>(RELEASE_DEPENDENCY_CONDITION_TYPES);

const EDGE_FIELDS: EdgeField[] = [
  "toServiceId",
  "fromStageType",
  "toStageType",
  "conditionType",
];

// 读取单个声明边（fail-closed）：畸形/字段非法 → 返回结构化 error，
// 不再静默返回 undefined。errors 携带 dependencyIndex（合并数组下标）。
export function readDeclaredEdge(
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
  for (const field of EDGE_FIELDS) {
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
    return invalidStage(index, "fromStageType", fromStageType);
  }
  if (!STAGE_TYPE_SET.has(toStageType)) {
    return invalidStage(index, "toStageType", toStageType);
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
  return {
    toServiceId: fields.toServiceId as string,
    fromStageType: fromStageType as ReleaseStageType,
    toStageType: toStageType as ReleaseStageType,
    conditionType: conditionType as ReleaseDependencyConditionType,
    required: typeof rec.required === "boolean" ? rec.required : true,
    sourceIndex: index,
  };
}

function invalidStage(
  index: number,
  field: "fromStageType" | "toStageType",
  value: string,
): ReleaseDepParseError {
  const zh = field === "fromStageType" ? "上游阶段" : "下游阶段";
  return {
    code: "RELEASE_DEP_INVALID_STAGE_TYPE",
    dependencyIndex: index,
    field,
    invalidValue: value,
    allowedValues: RELEASE_STAGE_TYPES,
    reason: `unsupported ${field}: ${value}`,
    suggestedAction: `${zh}「${value}」不支持，请到服务部署配置中修正`,
  };
}
