'use client';

import { useTranslations } from 'next-intl';
import { MetricCard } from '@/components/ui';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

/**
 * Supervisor 12 项指标汇总。
 *
 * 把原先 xl:grid-cols-12 的扁平 12 卡墙，按主题拆为 4 个集群
 * （队列 / 租约 / Worker / Agent），每个集群带小标题 + 2~3 列布局，
 * 不丢失任何指标，仅改善可读性与密度。
 */
export function SupervisorSummary({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  const t = useTranslations('executionGovernance');
  return (
    <div className="space-y-4">
      <SummaryCluster heading={t('groupQueue')}>
        <MetricCard label={t('sumReady')} value={supervisor.queue.ready} />
        <MetricCard label={t('sumScheduled')} value={supervisor.queue.scheduled} />
        <MetricCard label={t('sumRunning')} value={supervisor.queue.running} />
        <MetricCard label={t('sumStale')} value={supervisor.queue.staleRunning} />
      </SummaryCluster>
      <SummaryCluster heading={t('groupLease')}>
        <MetricCard label={t('sumActiveLease')} value={supervisor.leases.running} />
      </SummaryCluster>
      <SummaryCluster heading={t('groupWorker')}>
        <MetricCard label={t('sumWorkers')} value={supervisor.workers.length} />
        <MetricCard label={t('sumWorkerOwners')} value={supervisor.workerInventory.owners.total} />
        <MetricCard label={t('sumOwnerStale')} value={supervisor.workerInventory.owners.stale} />
      </SummaryCluster>
      <SummaryCluster heading={t('groupAgent')}>
        <MetricCard label={t('sumAgentTargets')} value={supervisor.agent.capableServers} />
        <MetricCard label={t('sumAgentRuntime')} value={supervisor.agent.runtime.onlineServers} />
        <MetricCard label={t('sumAgentStale')} value={supervisor.agent.runtime.staleServers} />
        <MetricCard label={t('sumAgentReady')} value={supervisor.agent.jobs.ready} />
      </SummaryCluster>
    </div>
  );
}

function SummaryCluster({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium text-muted-foreground">{heading}</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </div>
  );
}
