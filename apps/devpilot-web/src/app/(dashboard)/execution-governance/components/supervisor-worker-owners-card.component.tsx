'use client';

import { useTranslations } from 'next-intl';
import { SupervisorExecutionAuditSection } from './supervisor-execution-audit-section.component';
import { SupervisorQueueCoordinationSection } from './supervisor-queue-coordination-section.component';
import { SupervisorRemoteOrphanSection } from './supervisor-remote-orphan-section.component';
import { SupervisorWorkerOwnerSamples } from './supervisor-worker-owner-samples.component';
import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatWorkerInventoryReason,
  formatWorkerInventoryState,
  readWorkerInventoryStatus,
} from '../supervisor-worker-format.utils';
import { shortId } from '../utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorWorkerOwnersCard({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  const inventory = supervisor.workerInventory;

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Worker inventory</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {inventory.owners.active}/{inventory.owners.total} active owners
          </div>
        </div>
        <StatusBadge status={readWorkerInventoryStatus(inventory.status.state)} />
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="current"
          value={shortId(inventory.current.workerId)}
        />
        <SupervisorField
          label="state"
          value={formatWorkerInventoryState(inventory.status.state)}
        />
        <SupervisorField
          label="reason"
          value={formatWorkerInventoryReason(inventory.status.reason)}
        />
        <SupervisorField
          label="queue worker"
          value={inventory.current.queueWorkerEnabled ? tc('enabled') : tc('disabled')}
        />
        <SupervisorField
          label="ready/scheduled"
          value={`${inventory.queue.ready}/${inventory.queue.scheduled}`}
        />
        <SupervisorField
          label="running/stale"
          value={`${inventory.queue.running}/${inventory.queue.staleRunning}`}
        />
        <SupervisorField
          label="owned jobs"
          value={`${inventory.owners.ownedRunningJobs}/${inventory.owners.ownedStaleJobs}`}
        />
        <SupervisorField
          label="unowned"
          value={String(inventory.queue.unownedRunning)}
        />
      </div>

      <SupervisorQueueCoordinationSection coordination={supervisor.queueCoordinationPreflight} />
      <SupervisorRemoteOrphanSection
        orphanGovernance={supervisor.remoteOrphanGovernancePreflight}
      />
      <SupervisorExecutionAuditSection auditVisibility={supervisor.executionAuditVisibility} />
      <SupervisorWorkerOwnerSamples inventory={inventory} />
    </div>
  );
}
