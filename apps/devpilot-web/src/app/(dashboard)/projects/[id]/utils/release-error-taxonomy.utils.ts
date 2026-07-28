/**
 * 发布编排 — 错误分类（F383, invest-3 §E.6）
 *
 * 单一职责：把 ApiError(code, message, details) 归一化为面向用户的中文标签 + 处理建议。
 * 区分：flag 关闭、无权限、预览过期(409 RELEASE_PLAN_STALE)、状态不可执行(409)、网络错误、
 * 环境/服务不匹配。
 *
 * CR-3-F3 根因修复（两 sided）：
 * - 后端 GlobalExceptionFilter 现在保留业务字符串 code（RELEASE_PLAN_STALE 等）到响应体。
 * - 前端这里从 err.details.code（HTTP 错误路径下信封体）优先读取，回退到 err.code，
 *   再回退到 HTTP status 数字。旧实现只读 err.code（HTTP-error 路径下是 409 数字），
 *   永远拿不到字符串 code → autoRepreview 不触发。
 */
import { ApiError } from '@svton/api-client';

export type ReleaseErrorKind =
  | 'flag_off'
  | 'rbac'
  | 'preview_stale'
  | 'status_transition'
  | 'network'
  | 'env_mismatch'
  | 'dependency_invalid'
  | 'other';

export interface ReleaseErrorView {
  kind: ReleaseErrorKind;
  /** 中文用户文案。 */
  message: string;
  /** 是否应触发自动重新预览（preview_stale）。 */
  autoRepreview: boolean;
}

// 从 ApiError 提取业务字符串 code：优先 details.code（HTTP-error 路径下信封体），
// 其次 err.code 本身（envelope 路径下已是字符串）。
function extractEnvCode(err: ApiError): unknown {
  const details = err.details as { code?: unknown } | undefined;
  if (typeof details?.code === 'string' && details.code.length > 0) return details.code;
  return err.code;
}

// Item 1：发布依赖校验失败时，后端在响应体的 details[] 携带 RELEASE_DEP_* 明细数组
// （每条含 code/dependencyIndex/suggestedAction 等）。取第一条依赖错误用于 UI 文案。
export interface ReleaseDepDetail {
  code: string;
  dependencyIndex?: number;
  suggestedAction?: string;
  reason?: string;
  toServiceId?: string;
  serviceName?: string;
}
function extractReleaseDepDetail(err: ApiError): ReleaseDepDetail | undefined {
  const details = err.details as unknown;
  // 后端两种形态：details 是 RELEASE_DEP_[] 数组（HttpError 路径），或 details.details 是数组。
  const candidates: unknown[] = Array.isArray(details)
    ? details
    : Array.isArray((details as { details?: unknown })?.details)
      ? ((details as { details: unknown[] }).details)
      : [];
  const dep = candidates.find(
    (c): c is ReleaseDepDetail =>
      typeof c === 'object' && c !== null &&
      typeof (c as ReleaseDepDetail).code === 'string' &&
      (c as ReleaseDepDetail).code.startsWith('RELEASE_DEP_'),
  );
  return dep;
}

/** 由后端信封 code / HTTP 状态 / message 文本推断错误类型。 */
export function classifyReleaseError(err: unknown): ReleaseErrorView {
  if (!(err instanceof ApiError)) {
    return { kind: 'other', message: err instanceof Error ? err.message : String(err), autoRepreview: false };
  }
  const envCode = extractEnvCode(err);
  const code = err.code;
  const msg = err.message || '';

  if (code === 'NETWORK_ERROR') {
    return { kind: 'network', message: '网络错误，请重试', autoRepreview: false };
  }
  // 业务字符串 code（CR-3-F3）：优先判断，覆盖 HTTP-error 路径下 err.code===409 的场景。
  if (envCode === 'RELEASE_PLAN_STALE') {
    return { kind: 'preview_stale', message: '配置已变化，已为你重新预览', autoRepreview: true };
  }
  // Item 1：发布依赖校验失败（fail-closed）。后端把 RELEASE_DEP_* 明细放 details[]，
  // 每条携带面向新手的中文 suggestedAction。优先展示第一条可操作文案。
  if (envCode === 'RELEASE_PLAN_INVALID') {
    const depDetail = extractReleaseDepDetail(err);
    if (depDetail) {
      return {
        kind: 'dependency_invalid',
        message: depDetail.suggestedAction || depDetail.reason || '发布依赖配置有误，请按提示修正',
        autoRepreview: false,
      };
    }
    return { kind: 'env_mismatch', message: msg || '服务与目标环境不一致', autoRepreview: false };
  }
  if (
    envCode === 'RELEASE_ENVIRONMENT_MISMATCH' ||
    envCode === 'RELEASE_SERVICE_NOT_IN_TARGET_ENV'
  ) {
    return { kind: 'env_mismatch', message: msg || '服务与目标环境不一致', autoRepreview: false };
  }
  if (envCode === 'RELEASE_GIT_UNRESOLVABLE') {
    return { kind: 'other', message: msg || '无法解析 git 引用，请检查仓库地址与分支', autoRepreview: false };
  }
  // 文本回退（环境相关关键词）
  if (msg.includes('环境') || msg.includes('environment')) {
    return { kind: 'env_mismatch', message: msg || '服务与目标环境不一致', autoRepreview: false };
  }
  // 回退到 HTTP status / 信封 code 数字
  if (code === 403 || code === 'FORBIDDEN') {
    if (msg.includes('未启用') || msg.includes('flag')) {
      return { kind: 'flag_off', message: '功能未开启', autoRepreview: false };
    }
    return { kind: 'rbac', message: '无权限', autoRepreview: false };
  }
  if (code === 409 || code === 'CONFLICT') {
    // 区分状态迁移冲突与预览过期（上面 envCode 已处理 RELEASE_PLAN_STALE）。
    if (msg.includes('状态') || msg.includes('transition')) {
      return { kind: 'status_transition', message: '状态不可执行', autoRepreview: false };
    }
    return { kind: 'other', message: msg, autoRepreview: false };
  }
  return { kind: 'other', message: msg, autoRepreview: false };
}
