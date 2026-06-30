/**
 * 执行治理域 - 小型展示组件
 *
 * 单一职责：指标、Supervisor 字段、状态徽章。
 */

import { StatusTag } from '@/components/ui';
import { statusLabels, statusClasses } from '../constants';

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

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

export { statusClasses };
