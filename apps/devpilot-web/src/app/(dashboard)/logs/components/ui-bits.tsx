/** 日志域小型展示组件 - 指标卡与徽章。 */

import { StatusTag } from '@/components/ui';

export function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export function LevelBadge({ level }: { level: string }) {
  return (
    <StatusTag
      status={level === 'error' ? 'failed' : level === 'warn' ? 'pending' : 'completed'}
      label={level}
    />
  );
}
