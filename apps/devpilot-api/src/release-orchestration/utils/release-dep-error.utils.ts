/**
 * 发布依赖校验错误码、结构化错误载荷与 HTTP 信封（F383 Item 1 fail-closed）。
 *
 * 单一职责：定义「发布依赖解析」阶段的结构化错误类型，并提供统一的 BadRequestException
 * 信封构造器。所有 9 类错误（畸形/缺字段/非法 stage/非法 condition/自依赖/冲突重复/未选服务/
 * 服务不存在/跨域引用）都通过同一组类型表达，供 access service 填充上下文后抛出，控制器透传。
 *
 * 设计要点（invest-dep 报告 §"Proposed design"）：
 * - 错误码为字符串字面量联合（machine-readable），UI 据此路由渲染。
 * - 每个 ReleaseDepError 携带 7 个 Item 1 要求字段：
 *   applicationServiceId / serviceName / dependencyIndex / field / invalidValue / reason / suggestedAction。
 * - HTTP 信封外层 code = "RELEASE_PLAN_INVALID"，details[] 携带具体 RELEASE_DEP_* 错误码，
 *   与现有 release-plan.service.ts 的 RELEASE_PLAN_INVALID 信封一致，前端 release-error-taxonomy
 *   复用同一路径。
 */
import { BadRequestException } from "@nestjs/common";

export type ReleaseDepErrorCode =
  | "RELEASE_DEP_MALFORMED"
  | "RELEASE_DEP_MISSING_FIELD"
  | "RELEASE_DEP_INVALID_STAGE_TYPE"
  | "RELEASE_DEP_INVALID_CONDITION_TYPE"
  | "RELEASE_DEP_SELF_DEPENDENCY"
  | "RELEASE_DEP_DUPLICATE_CONFLICT"
  | "RELEASE_DEP_TARGET_NOT_SELECTED"
  | "RELEASE_DEP_TARGET_NOT_FOUND"
  | "RELEASE_DEP_CROSS_SCOPE";

// Item 1 要求的结构化错误载荷（用于 UI 展示）。
export interface ReleaseDepError {
  code: ReleaseDepErrorCode;
  applicationServiceId: string;
  serviceName: string;
  /** 合并后的声明边数组下标（0-based），跨顶层 + deployment 两层连续编号。 */
  dependencyIndex: number;
  field?: "toServiceId" | "fromStageType" | "toStageType" | "conditionType";
  invalidValue?: unknown;
  allowedValues?: readonly string[];
  toServiceId?: string;
  conflictWithIndex?: number;
  differingFields?: string[];
  /** 机器可读的英文原因（日志/排查用）。 */
  reason: string;
  /** 面向平台新手的中文处理建议（UI 文案）。 */
  suggestedAction: string;
}

// parser 层返回的未带服务上下文的错误（仅含 index + 字段级信息）。
// 调用方（access service）负责补齐 applicationServiceId / serviceName。
export type ReleaseDepParseError = Omit<
  ReleaseDepError,
  "applicationServiceId" | "serviceName"
>;

// 供 UI 文案构造：把字段名翻译为中文。
export function fieldNameZh(
  field: "toServiceId" | "fromStageType" | "toStageType" | "conditionType",
): string {
  switch (field) {
    case "toServiceId":
      return "下游服务";
    case "fromStageType":
      return "上游阶段";
    case "toStageType":
      return "下游阶段";
    case "conditionType":
      return "条件类型";
  }
}

// 把一组错误包成 Nest BadRequestException，沿用 RELEASE_PLAN_INVALID 信封约定。
// 外层 code 故意统一为 RELEASE_PLAN_INVALID（前端 release-error-taxonomy 已识别），
// details[] 携带 RELEASE_DEP_* 具体码，供 UI 二级分类。
export function releaseDepErrorsToException(
  errors: ReleaseDepError[],
): BadRequestException {
  return new BadRequestException({
    code: "RELEASE_PLAN_INVALID",
    message: `发布依赖校验失败（${errors.length} 处）`,
    details: errors,
  });
}
