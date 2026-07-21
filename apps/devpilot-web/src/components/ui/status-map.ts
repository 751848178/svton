/**
 * 全站统一状态色调映射
 *
 * 将业务状态字符串归一化为 6 类语义色调（StatusTone），
 * 供 StatusTag 及其他状态展示组件共用，避免各页面各写一份映射。
 *
 * 单一职责：status 字符串 → StatusTone。未识别的状态一律兜底 'neutral'。
 */

export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

/** 状态（小写）→ 语义色调。 */
export const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // 进行中 / 过渡态（呼吸点）
  queued: 'progress',
  provisioning: 'progress',
  running: 'progress',
  deploying: 'progress',
  processing: 'progress',
  waiting: 'progress',

  // 成功 / 就绪
  approved: 'success',
  success: 'success',
  ready: 'success',
  resolved: 'success',
  active: 'success',
  enabled: 'success',
  completed: 'success',
  healthy: 'success',
  online: 'success',
  available: 'success',
  ok: 'success',

  // 失败 / 告警
  rejected: 'danger',
  failed: 'danger',
  firing: 'danger',
  error: 'danger',
  declined: 'danger',
  offline: 'danger',
  unhealthy: 'danger',
  stopped: 'danger',

  // 等待 / 需注意
  pending: 'warning',
  paused: 'warning',
  warning: 'warning',

  // 信息
  info: 'info',
  pending_review: 'info',

  // 中性 / 终态
  canceled: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  unknown: 'neutral',
  draft: 'neutral',
  archived: 'neutral',
};

/** 取状态的语义色调，大小写不敏感，未知值兜底 'neutral'。 */
export function getStatusTone(status: string): StatusTone {
  return STATUS_TONE_MAP[status.toLowerCase()] ?? 'neutral';
}
