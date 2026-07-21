'use client';

import { useTranslations } from 'next-intl';
import { formatNullableRuntimeSeconds } from '../supervisor-orphan-audit-format.utils';
import { formatWorkerInventoryState } from '../supervisor-worker-format.utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type WorkerInventory = ServerExecutionSupervisorSnapshot['workerInventory'];

export function SupervisorWorkerOwnerSamples({ inventory }: { inventory: WorkerInventory }) {
  const t = useTranslations('executionGovernance');
  if (inventory.owners.samples.length === 0) {
    return <div className="mt-4 text-muted-foreground">{t('noRunningJobOwner')}</div>;
  }

  return (
    <div className="mt-4 space-y-3">
      {inventory.owners.samples.map((worker) => (
        <div
          key={worker.lockOwner}
          className="border-b pb-3 last:border-b-0 last:pb-0"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="break-all font-mono text-xs">{worker.lockOwner}</div>
            <div className="text-xs text-muted-foreground">
              {t('ownerJobsSummary', { active: worker.activeJobs, stale: worker.staleJobs })}
            </div>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {worker.sampleJob.operationKey} · {worker.sampleJob.server?.name || t('noServer')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatWorkerInventoryState(worker.status)} ·{' '}
            {t('ownerHeartbeatSummary', {
              seen: formatNullableRuntimeSeconds(worker.lastHeartbeatAgeSeconds),
              expires: formatNullableRuntimeSeconds(worker.lockExpiresInSeconds),
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
