/**
 * 执行治理域 - 小型展示组件
 *
 * 单一职责：Supervisor 字段、状态徽章。
 * 指标卡统一使用全局 MetricCard(@/components/ui),本地不再重复实现。
 */

import { StatusTag } from '@/components/ui';
import { statusLabels } from '../constants';

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
