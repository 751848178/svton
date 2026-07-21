'use client';

import { useTranslations } from 'next-intl';
import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatQueueCoordinationAction,
  formatQueueCoordinationReason,
  formatQueueCoordinationState,
  readQueueCoordinationStatus,
} from '../supervisor-worker-format.utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type QueueCoordinationPreflight = ServerExecutionSupervisorSnapshot['queueCoordinationPreflight'];

export function SupervisorQueueCoordinationSection({
  coordination,
}: {
  coordination: QueueCoordinationPreflight;
}) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-foreground">{t('secQueueCoordination')}</h4>
        <StatusBadge status={readQueueCoordinationStatus(coordination.state)} />
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label={t('fieldPreflight')}
          value={`${formatQueueCoordinationState(coordination.state)} · ${formatQueueCoordinationReason(coordination.reason)}`}
        />
        <SupervisorField
          label={t('fieldWorker')}
          value={`${coordination.gates.worker.enabled ? tc('enabled') : tc('disabled')} · ${formatQueueCoordinationReason(coordination.gates.worker.reason)}`}
        />
        <SupervisorField
          label={t('fieldQueue')}
          value={`${coordination.gates.queue.readyJobs}/${coordination.gates.queue.scheduledJobs}/${coordination.gates.queue.blockedJobs} · ${formatQueueCoordinationReason(coordination.gates.queue.reason)}`}
        />
        <SupervisorField
          label={t('fieldOwners')}
          value={`${coordination.gates.owners.activeOwners}/${coordination.gates.owners.totalOwners} · ${formatQueueCoordinationReason(coordination.gates.owners.reason)}`}
        />
        <SupervisorField
          label={t('fieldRecovery')}
          value={`${coordination.gates.recovery.staleRunningJobs}/${coordination.gates.recovery.recoveryBatchSize} · ${formatQueueCoordinationReason(coordination.gates.recovery.reason)}`}
        />
        <SupervisorField
          label={t('fieldPressure')}
          value={`${coordination.pressure.backlogJobs}/${coordination.pressure.runningJobs}/${coordination.pressure.blockedJobs}`}
        />
      </div>

      {coordination.blockers.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {coordination.blockers.slice(0, 4).map((blocker) => (
            <div
              key={`${blocker.severity}-${blocker.reason}`}
              className="flex flex-wrap justify-between gap-2"
            >
              <span>{formatQueueCoordinationReason(blocker.reason)}</span>
              <span>
                {blocker.severity} · {blocker.count}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {coordination.nextSteps.length > 0 ? (
        <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          {coordination.nextSteps.slice(0, 3).map((step) => (
            <div key={`${step.action}-${step.reason}`}>
              {formatQueueCoordinationAction(step.action)} ·{' '}
              {formatQueueCoordinationReason(step.reason)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
