/**
 * 指标数值 Chip
 *
 * 单一职责：把一个数值渲染为「label value suffix」的小色块,按阈值着色。
 * 阈值分段对标阿里云 Gauge:>=80 红、>=50 黄、其余默认(中性)。
 * 数值缺失(null / undefined / 非有限数)时由调用方决定是否渲染,本组件不再兜底。
 *
 * 无业务状态,纯展示。
 */
import { cn } from '@/lib/utils';

/** 阈值归一化为色调,返回 tailwind 类名集合。 */
function toneByThreshold(value: number): {
  text: string;
  bg: string;
} {
  if (value >= 80) {
    return {
      text: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-100 dark:bg-red-950/40',
    };
  }
  if (value >= 50) {
    return {
      text: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-100 dark:bg-amber-950/40',
    };
  }
  return {
    text: 'text-muted-foreground',
    bg: 'bg-muted/60',
  };
}

export interface MetricChipProps {
  label: string;
  value: number;
  suffix?: string;
  /** title 悬停提示;缺省时用「label value suffix」拼接。 */
  title?: string;
}

/** 渲染「label value suffix」小色块,按百分比阈值着色。 */
export function MetricChip({ label, value, suffix, title }: MetricChipProps) {
  const tone = toneByThreshold(value);
  const display = Number.isFinite(value)
    ? `${value.toFixed(value >= 10 ? 0 : 1)}${suffix ?? ''}`
    : '-';
  const hint = title ?? `${label} ${display}`;
  return (
    <span
      title={hint}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
        tone.text,
        tone.bg,
      )}
    >
      <span className="opacity-70">{label}</span>
      <span>{display}</span>
    </span>
  );
}
