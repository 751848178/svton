/** 日志中心统计面板。 */
'use client';
import { useTranslations } from 'next-intl';
import { MetricCard } from '@/components/ui';
import type { useLogs } from '../hooks/use-logs';
type LogsHook = ReturnType<typeof useLogs>;

export function LogsStatsSection({ logs }: { logs: LogsHook }) {
  const t = useTranslations('logs');
  const stats = logs.s.logStats;
  if (!stats) return null;
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <MetricCard
        label={t('logStreams')}
        value={stats.total}
      />
      <MetricCard
        label={t('levelWarning')}
        value={stats.warningCount}
      />
      <MetricCard
        label={t('levelInfo')}
        value={stats.byLevel.filter((l) => l.level === 'info').reduce((s, l) => s + l.count, 0)}
      />
      <MetricCard
        label={t('errorLogs')}
        value={stats.errorCount}
      />
    </div>
  );
}
