/**
 * 发布服务归属环境一致性纯谓词（F383 Slice 8a）。
 *
 * 这是 builder 层的硬保证：DTO 声明的服务 environmentId 必须与发布计划目标
 * environmentId 严格一致；不一致即拦截（不依赖 DB）。
 * 控制器另做 DB 级 ApplicationService/team/project/server 查询。
 *
 * 返回结构化结果，调用方按需翻译为 ForbiddenException / ReleaseDagResult。
 */
export type ReleaseEnvValidationOk = { ok: true };
export type ReleaseEnvValidationErr = {
  ok: false;
  code: "RELEASE_ENVIRONMENT_MISMATCH";
  message: string;
};
export type ReleaseEnvValidation = ReleaseEnvValidationOk | ReleaseEnvValidationErr;

interface ServiceLikeInput {
  applicationServiceId: string;
  environmentId?: string | null;
}

// 谓词：服务声明的环境 === 发布计划目标环境。空/null 环境直接判 mismatch。
export function validateServiceOwnership(
  svc: ServiceLikeInput,
  planEnv: string,
): ReleaseEnvValidation {
  if (!svc.environmentId || svc.environmentId !== planEnv) {
    return {
      ok: false,
      code: "RELEASE_ENVIRONMENT_MISMATCH",
      message: `服务 ${svc.applicationServiceId} 的环境与发布目标环境不一致`,
    };
  }
  return { ok: true };
}
