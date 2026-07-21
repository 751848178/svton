/**
 * 状态标签
 *
 * 将业务状态字符串映射为带语义颜色的 @svton/ui Tag。
 * 替代各页面重复定义的 statusClasses / riskClasses 颜色映射表。
 *
 * - variant="status"（默认）：经 @/components/ui/status-map 的
 *   STATUS_TONE_MAP 归一化为 6 类语义色调；progress 态附带呼吸点。
 * - variant="risk"：按风险等级（critical/high/medium/low）映射，保持历史行为。
 *
 * 单一职责：状态 → 颜色 映射 + 渲染。无业务逻辑。
 */

import { Tag, type TagProps } from '@svton/ui';
import { getStatusTone, type StatusTone as StatusMapTone } from './status-map';

export type StatusTone = TagProps['color'];

/** StatusTone（status-map）→ Tag 颜色。 */
const TONE_TO_TAG_COLOR: Record<StatusMapTone, NonNullable<TagProps['color']>> = {
  neutral: 'default',
  info: 'blue',
  progress: 'cyan',
  success: 'green',
  warning: 'orange',
  danger: 'red',
};

/** 风险等级 → 色调映射。 */
const RISK_TONE: Record<string, StatusTone> = {
  critical: 'red',
  high: 'red',
  medium: 'orange',
  low: 'cyan',
  info: 'blue',
};

/** progress 态呼吸点。 */
function PulseDot() {
  return (
    <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-500 opacity-60" />
      <span className="relative inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-600" />
    </span>
  );
}

export interface StatusTagProps {
  /** 原始状态值（不区分大小写）；缺省时按 neutral 渲染。 */
  status?: string;
  /** 显示文本，默认用原值。 */
  label?: string;
  /** 是否按风险等级映射颜色（critical/high/medium/low）。 */
  variant?: 'status' | 'risk';
  className?: string;
}

/** 渲染状态标签，自动匹配语义颜色，未匹配时回退 default。 */
export function StatusTag({ status, label, variant = 'status', className }: StatusTagProps) {
  if (variant === 'risk') {
    const tone = RISK_TONE[(status ?? '').toLowerCase()] ?? 'default';
    return (
      <Tag color={tone} className={className}>
        {label ?? status}
      </Tag>
    );
  }

  const tone = getStatusTone(status ?? '');
  return (
    <Tag
      color={TONE_TO_TAG_COLOR[tone]}
      icon={tone === 'progress' ? <PulseDot /> : undefined}
      className={className}
    >
      {label ?? status}
    </Tag>
  );
}
