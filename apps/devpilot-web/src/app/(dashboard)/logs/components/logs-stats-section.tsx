/** 日志中心统计面板。 */
'use client';
import { MetricCard } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
type LogsHook = ReturnType<typeof useLogs>;

export function LogsStatsSection({ logs }: { logs: LogsHook }) {
  const stats = logs.s.logStats;
  if (!stats) return null;
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard
        label="日志流"
        value={stats.total}
      />
      <MetricCard
        label="警告"
        value={stats.warningCount}
      />
      <MetricCard
        label="信息"
        value={stats.byLevel.filter((l) => l.level === 'info').reduce((s, l) => s + l.count, 0)}
      />
      <MetricCard
        label="错误日志"
        value={stats.errorCount}
      />
    </div>
  );
}
