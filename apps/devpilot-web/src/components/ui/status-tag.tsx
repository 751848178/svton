/**
 * 状态标签
 *
 * 将业务状态字符串映射为带语义颜色的 @svton/ui Tag。
 * 替代各页面重复定义的 statusClasses / riskClasses 颜色映射表。
 *
 * 单一职责：状态 → 颜色 映射 + 渲染。无业务逻辑。
 */

import { Tag, type TagProps } from '@svton/ui';

export type StatusTone = TagProps['color'];

/** 通用状态 → 色调映射（running/active → green, failed/error → red, pending → orange）。 */
const DEFAULT_STATUS_TONE: Record<string, StatusTone> = {
  // 成功 / 进行中
  active: 'green',
  running: 'green',
  healthy: 'green',
  online: 'green',
  available: 'green',
  completed: 'green',
  approved: 'green',
  success: 'green',
  enabled: 'green',
  ok: 'green',

  // 失败 / 异常
  failed: 'red',
  error: 'red',
  rejected: 'red',
  declined: 'red',
  offline: 'red',
  unhealthy: 'red',
  stopped: 'red',
  disabled: 'red',

  // 等待 / 过渡
  pending: 'orange',
  waiting: 'orange',
  processing: 'orange',
  provisioning: 'orange',
  queued: 'orange',
  warning: 'orange',

  // 中性
  draft: 'default',
  disabled_state: 'default',
  archived: 'default',
  inactive: 'default',

  // 信息
  info: 'blue',
  pending_review: 'cyan',
};

/** 风险等级 → 色调映射。 */
const RISK_TONE: Record<string, StatusTone> = {
  critical: 'red',
  high: 'red',
  medium: 'orange',
  low: 'cyan',
  info: 'blue',
};

export interface StatusTagProps {
  /** 原始状态值（不区分大小写）。 */
  status: string;
  /** 显示文本，默认用原值。 */
  label?: string;
  /** 是否按风险等级映射颜色（critical/high/medium/low）。 */
  variant?: 'status' | 'risk';
  className?: string;
}

/** 渲染状态标签，自动匹配语义颜色，未匹配时回退 default。 */
export function StatusTag({ status, label, variant = 'status', className }: StatusTagProps) {
  const table = variant === 'risk' ? RISK_TONE : DEFAULT_STATUS_TONE;
  const key = status.toLowerCase();
  const tone = table[key] ?? 'default';
  return (
    <Tag
      color={tone}
      className={className}
    >
      {label ?? status}
    </Tag>
  );
}
