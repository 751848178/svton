'use client';

import { useTranslations } from 'next-intl';
import { MetricCard } from '@/components/ui';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorSummary({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  const t = useTranslations('executionGovernance');
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12">
      <MetricCard
        label={t('sumReady')}
        value={supervisor.queue.ready}
      />
      <MetricCard
        label={t('sumScheduled')}
        value={supervisor.queue.scheduled}
      />
      <MetricCard
        label={t('sumRunning')}
        value={supervisor.queue.running}
      />
      <MetricCard
        label={t('sumStale')}
        value={supervisor.queue.staleRunning}
      />
      <MetricCard
        label={t('sumActiveLease')}
        value={supervisor.leases.running}
      />
      <MetricCard
        label={t('sumWorkers')}
        value={supervisor.workers.length}
      />
      <MetricCard
        label={t('sumWorkerOwners')}
        value={supervisor.workerInventory.owners.total}
      />
      <MetricCard
        label={t('sumOwnerStale')}
        value={supervisor.workerInventory.owners.stale}
      />
      <MetricCard
        label={t('sumAgentTargets')}
        value={supervisor.agent.capableServers}
      />
      <MetricCard
        label={t('sumAgentRuntime')}
        value={supervisor.agent.runtime.onlineServers}
      />
      <MetricCard
        label={t('sumAgentStale')}
        value={supervisor.agent.runtime.staleServers}
      />
      <MetricCard
        label={t('sumAgentReady')}
        value={supervisor.agent.jobs.ready}
      />
    </div>
  );
}
