/**
 * 全站统一状态色调映射
 *
 * 将业务状态字符串归一化为 5 类语义色调（StatusTone），
 * 供 StatusTag 及其他状态展示组件共用，避免各页面各写一份映射。
 *
 * 颜色语义（对标 N3 卡片，docs/devpilot/ux-findings.md）：
 * - 🟢 success   绿 = 就绪（active/completed/healthy/success/ready/resolved/...）
 * - 🔵 progress  蓝 = 进行中（running/pending/deploying/queued/provisioning/...）
 * - 🔴 danger    红 = 异常（failed/blocked/error/rejected/firing/offline/...）
 * - ⚪ neutral   灰 = 终止（canceled/archived/inactive/disabled/unknown/draft/...）
 * - 🟠 warning   橙 = 软信号（仅 alert-severity warning/insufficient_data/stale/paused）
 *
 * 注：`info` 色调（纯蓝、无呼吸点）保留给"信息性"语义，如日志 level=info；
 * 与 `progress`（蓝 + 呼吸点）区分，避免误把信息态渲染成进行中。
 *
 * 单一职责：status 字符串 → StatusTone。未识别的状态一律兜底 'neutral'。
 */

export type StatusTone =
  | 'neutral' // 灰 - 终止/中性
  | 'info' // 蓝 - 进行中（progress 别名，保留兼容）
  | 'progress' // 蓝 - 进行中
  | 'success' // 绿 - 就绪
  | 'warning' // 橙 - 软信号
  | 'danger'; // 红 - 异常

/** 状态（小写）→ 语义色调。 */
export const STATUS_TONE_MAP: Record<string, StatusTone> = {
  // 🟢 就绪 / 成功 / 健康
  active: 'success',
  available: 'success',
  completed: 'success',
  enabled: 'success',
  healthy: 'success',
  online: 'success',
  ok: 'success',
  ready: 'success',
  resolved: 'success',
  success: 'success',
  succeeded: 'success',
  synced: 'success',
  sent: 'success',
  delivered: 'success',
  accepted: 'success',
  approved: 'success',
  collected: 'success',
  released: 'success',

  // 🔵 进行中 / 过渡态（呼吸点）
  running: 'progress',
  pending: 'progress',
  pending_review: 'progress',
  queued: 'progress',
  provisioning: 'progress',
  deploying: 'progress',
  processing: 'progress',
  waiting: 'progress',
  planned: 'progress',
  received: 'progress',
  acknowledged: 'progress',
  created: 'progress',

  // 🔵 信息性（纯蓝无呼吸点，日志 level=info 等非"进行中"信息态）
  info: 'info',

  // 🔴 异常 / 失败 / 告警 / 阻断
  failed: 'danger',
  blocked: 'danger',
  error: 'danger',
  rejected: 'danger',
  declined: 'danger',
  firing: 'danger',
  fatal: 'danger',
  offline: 'danger',
  unhealthy: 'danger',
  stopped: 'danger',
  breached: 'danger',
  revoked: 'danger',

  // 🟠 软信号 / 需注意（可恢复中间态）
  paused: 'warning',
  warning: 'warning',
  insufficient_data: 'warning',
  stale: 'warning',
  maintenance: 'warning',
  full: 'warning',

  // ⚪ 终止 / 中性 / 未决
  canceled: 'neutral',
  cancelled: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  archived: 'neutral',
  unknown: 'neutral',
  draft: 'neutral',
  skipped: 'neutral',
  suppressed: 'neutral',
  expired: 'neutral',
  no_data: 'neutral',
  ignored: 'neutral',
  partial: 'neutral',
  trace: 'neutral',
  debug: 'neutral',
};

/** 取状态的语义色调，大小写不敏感，未知值兜底 'neutral'。 */
export function getStatusTone(status: string): StatusTone {
  return STATUS_TONE_MAP[status.toLowerCase()] ?? 'neutral';
}
