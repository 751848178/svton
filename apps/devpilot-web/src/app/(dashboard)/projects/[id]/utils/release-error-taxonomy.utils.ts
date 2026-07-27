/**
 * 发布编排 — 错误分类（F383, invest-3 §E.6）
 *
 * 单一职责：把 ApiError(code, message) 归一化为面向用户的中文标签 + 处理建议。
 * 区分：flag 关闭、无权限、预览过期(409 RELEASE_PLAN_STALE)、状态不可执行(409)、网络错误。
 */
import { ApiError } from '@svton/api-client';

export type ReleaseErrorKind =
  | 'flag_off'
  | 'rbac'
  | 'preview_stale'
  | 'status_transition'
  | 'network'
  | 'env_mismatch'
  | 'other';

export interface ReleaseErrorView {
  kind: ReleaseErrorKind;
  /** 中文用户文案。 */
  message: string;
  /** 是否应触发自动重新预览（preview_stale）。 */
  autoRepreview: boolean;
}

/** 由后端信封 code / HTTP 状态 / message 文本推断错误类型。 */
export function classifyReleaseError(err: unknown): ReleaseErrorView {
  if (!(err instanceof ApiError)) {
    return { kind: 'other', message: err instanceof Error ? err.message : String(err), autoRepreview: false };
  }
  const code = err.code;
  const msg = err.message || '';

  if (code === 'NETWORK_ERROR') {
    return { kind: 'network', message: '网络错误，请重试', autoRepreview: false };
  }
  // 信封 code（字符串）优先判断。
  if (code === 'RELEASE_PLAN_STALE') {
    return { kind: 'preview_stale', message: '配置已变化，已为你重新预览', autoRepreview: true };
  }
  if (code === 'RELEASE_PLAN_INVALID' || msg.includes('环境') || msg.includes('environment')) {
    return { kind: 'env_mismatch', message: msg || '服务与目标环境不一致', autoRepreview: false };
  }
  if (code === 403 || code === 'FORBIDDEN' || code === 403) {
    if (msg.includes('未启用') || msg.includes('flag')) {
      return { kind: 'flag_off', message: '功能未开启', autoRepreview: false };
    }
    return { kind: 'rbac', message: '无权限', autoRepreview: false };
  }
  if (code === 409 || code === 'CONFLICT') {
    // 区分状态迁移冲突与预览过期（上面已处理 RELEASE_PLAN_STALE）。
    if (msg.includes('状态') || msg.includes('transition')) {
      return { kind: 'status_transition', message: '状态不可执行', autoRepreview: false };
    }
    return { kind: 'other', message: msg, autoRepreview: false };
  }
  return { kind: 'other', message: msg, autoRepreview: false };
}
