/**
 * 发布依赖错误文案映射（F383 Item 1）：把依赖错误码 → 英文 reason + 中文 suggestedAction。
 *
 * 单一职责、纯函数：不依赖 Nest 也不依赖 DB。reason 用于日志/排查（机器可读英文），
 * suggestedAction 是面向平台新手的中文处理建议（UI 文案）。自依赖 / parser 级错误
 * 的文案直接在生成点构造（携带有完整上下文），本文件只覆盖需要 DB 探测上下文的
 * TARGET_NOT_SELECTED / TARGET_NOT_FOUND / CROSS_SCOPE 三类。
 */
import type { ReleaseDepErrorCode } from "./release-dep-error.utils";

export interface DepCopyInput {
  /** 声明依赖的归属服务名（UI 文案用）。 */
  serviceName: string;
  toServiceId: string;
  /** 无 scope 探测命中的行（用于 CROSS_SCOPE 的实际归属展示）。 */
  anyRow?: {
    teamId: string;
    projectId: string;
    environmentId: string;
  };
  expectedProjectId: string;
  expectedEnvironmentId: string;
}

export interface DepCopy {
  reason: string;
  suggestedAction: string;
}

export function describeReleaseDepError(
  code: ReleaseDepErrorCode,
  input: DepCopyInput,
): DepCopy {
  const { serviceName, toServiceId, anyRow, expectedProjectId, expectedEnvironmentId } =
    input;
  switch (code) {
    case "RELEASE_DEP_TARGET_NOT_SELECTED":
      return {
        reason: `required dependency target not in release selection: ${toServiceId}`,
        suggestedAction: `服务「${serviceName}」依赖服务「${toServiceId}」，请先将该服务加入本次发布`,
      };
    case "RELEASE_DEP_TARGET_NOT_FOUND":
      return {
        reason: `dependency target service does not exist: ${toServiceId}`,
        suggestedAction: `服务「${serviceName}」的发布依赖指向不存在的服务「${toServiceId}」，请到服务部署配置中修正`,
      };
    case "RELEASE_DEP_CROSS_SCOPE": {
      const where =
        anyRow &&
        (anyRow.projectId !== expectedProjectId ||
          anyRow.environmentId !== expectedEnvironmentId)
          ? `（属于项目 ${anyRow.projectId} / 环境 ${anyRow.environmentId}）`
          : "";
      return {
        reason: `dependency target crosses project/environment: ${toServiceId}`,
        suggestedAction: `服务「${serviceName}」的发布依赖指向跨项目/环境的服务「${toServiceId}」${where}，请到服务部署配置中修正`,
      };
    }
    default:
      return { reason: code, suggestedAction: "请检查服务部署配置" };
  }
}
