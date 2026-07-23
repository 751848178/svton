/**
 * 执行治理域 - 小型展示组件
 *
 * 单一职责：Supervisor 字段、状态徽章、带图例的多值字段、原因字段。
 * 指标卡统一使用全局 MetricCard(@/components/ui),本地不再重复实现。
 */

import { StatusTag } from '@/components/ui';
import { statusLabels } from '../constants';
import type { ReactNode } from 'react';

export function SupervisorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <StatusTag
      status={status}
      label={statusLabels[status] || status}
    />
  );
}

/** 单项标签 + 数值的内联 chip，用于把 `a/b/c` slash-tuple 展开为可读子项。 */
export function LabeledValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </span>
  );
}

/**
 * 带图例的多值字段：把原先 `${a}/${b}/${c}` 的 slash-tuple 展开为
 * 「标签 + 数值」chip 序列，每项可读、可扫。
 * 可选 reason 单独降到 muted 小字行，不再与主值用 ` · ` 拼接。
 */
export function LabeledTupleField({
  label,
  items,
  reason,
}: {
  label: string;
  items: { label: string; value: ReactNode }[];
  reason?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {items.map((item) => (
          <LabeledValue key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      {reason ? <div className="mt-0.5 text-xs text-muted-foreground">{reason}</div> : null}
    </div>
  );
}

/**
 * 主值 + 原因的字段：主值用正常字重，原因单独降到 muted 小字行，
 * 不再与主值用 ` · ` 拼在同一行淹没语义。
 */
export function ReasonField({
  label,
  value,
  reason,
}: {
  label: string;
  value: ReactNode;
  reason?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
      {reason ? <div className="mt-0.5 text-xs text-muted-foreground">{reason}</div> : null}
    </div>
  );
}
