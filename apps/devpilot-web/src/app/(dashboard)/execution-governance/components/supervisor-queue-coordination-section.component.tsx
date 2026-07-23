'use client';

import { useTranslations } from 'next-intl';
import { LabeledTupleField, ReasonField, StatusBadge } from './ui-bits';
import { BlockerList, NextStepList } from './supervisor-section-parts.component';
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
        <ReasonField
          label={t('fieldPreflight')}
          value={formatQueueCoordinationState(coordination.state)}
          reason={formatQueueCoordinationReason(coordination.reason)}
        />
        <ReasonField
          label={t('fieldWorker')}
          value={coordination.gates.worker.enabled ? tc('enabled') : tc('disabled')}
          reason={formatQueueCoordinationReason(coordination.gates.worker.reason)}
        />
        <LabeledTupleField
          label={t('fieldQueue')}
          items={[
            { label: t('legendReady'), value: coordination.gates.queue.readyJobs },
            { label: t('legendScheduled'), value: coordination.gates.queue.scheduledJobs },
            { label: t('legendBlocked'), value: coordination.gates.queue.blockedJobs },
          ]}
          reason={formatQueueCoordinationReason(coordination.gates.queue.reason)}
        />
        <LabeledTupleField
          label={t('fieldOwners')}
          items={[
            { label: t('legendActive'), value: coordination.gates.owners.activeOwners },
            { label: t('legendTotal'), value: coordination.gates.owners.totalOwners },
          ]}
          reason={formatQueueCoordinationReason(coordination.gates.owners.reason)}
        />
        <LabeledTupleField
          label={t('fieldRecovery')}
          items={[
            { label: t('legendStale'), value: coordination.gates.recovery.staleRunningJobs },
            { label: t('legendBatchSize'), value: coordination.gates.recovery.recoveryBatchSize },
          ]}
          reason={formatQueueCoordinationReason(coordination.gates.recovery.reason)}
        />
        <LabeledTupleField
          label={t('fieldPressure')}
          items={[
            { label: t('legendBacklog'), value: coordination.pressure.backlogJobs },
            { label: t('legendRunning'), value: coordination.pressure.runningJobs },
            { label: t('legendBlocked'), value: coordination.pressure.blockedJobs },
          ]}
        />
      </div>

      <BlockerList blockers={coordination.blockers} formatReason={formatQueueCoordinationReason} />
      <NextStepList
        steps={coordination.nextSteps}
        formatAction={formatQueueCoordinationAction}
        formatReason={formatQueueCoordinationReason}
      />
    </div>
  );
}
