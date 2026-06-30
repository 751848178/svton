'use client';

import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useLogs } from './hooks/use-logs';
import { LogsStatsSection } from './components/logs-stats-section';
import { StreamManageSection } from './components/stream-manage-section';
import { LogEntriesSection } from './components/log-entries-section';
import { TailPanel } from './components/tail-panel';
import { PolicyPanels } from './components/policy-panels';
import { LogsRunsSection } from './components/logs-runs-section';

export default function LogsPage() {
  const logs = useLogs();
  const { s, t, selectedStream, targetOptions, services } = logs;

  if (s.loading) return <LoadingState text="加载中..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="日志中心"
        description="查看日志流、条目、采集运行和实时 Tail"
      />

      {s.error ? <ErrorBanner message={s.error} /> : null}

      <LogsStatsSection logs={logs} />

      <StreamManageSection logs={logs} />

      <LogEntriesSection logs={logs} />

      <TailPanel logs={logs} />

      <PolicyPanels logs={logs} />

      <LogsRunsSection logs={logs} />
    </div>
  );
}
