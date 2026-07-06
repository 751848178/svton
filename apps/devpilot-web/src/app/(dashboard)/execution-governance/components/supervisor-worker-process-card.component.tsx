'use client';

import { useTranslations } from 'next-intl';
import { SupervisorField, StatusBadge } from './ui-bits';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorWorkerProcessCard({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{t('thisProcess')}</h3>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {supervisor.worker.workerId}
          </div>
        </div>
        <StatusBadge status={supervisor.worker.queueWorkerEnabled ? 'running' : 'blocked'} />
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label={t('processingQueue')}
          value={supervisor.worker.processingQueue ? t('yes') : t('no')}
        />
        <SupervisorField
          label={t('cancelToken')}
          value={String(supervisor.worker.runningCancellations)}
        />
        <SupervisorField
          label={t('batchSize')}
          value={String(supervisor.worker.queueBatchSize)}
        />
        <SupervisorField
          label={t('pollInterval')}
          value={`${supervisor.worker.queueIntervalSeconds}s`}
        />
        <SupervisorField
          label={t('lockTtl')}
          value={`${supervisor.worker.queueLockTtlSeconds}s`}
        />
        <SupervisorField
          label={t('heartbeatInterval')}
          value={`${supervisor.worker.queueHeartbeatSeconds}s`}
        />
        <SupervisorField
          label={t('cancelPoll')}
          value={`${supervisor.worker.cancellationPollSeconds}s`}
        />
        <SupervisorField
          label={t('staleRemoteCleanup')}
          value={supervisor.worker.staleRemoteCleanupEnabled ? tc('enabled') : tc('disabled')}
        />
      </div>
      {supervisor.queue.nextQueuedJob ? (
        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t('nextJob')}</span>
          <span> · {supervisor.queue.nextQueuedJob.operationKey}</span>
          <span> · {supervisor.queue.nextQueuedJob.adapterKey}</span>
          <span> · {supervisor.queue.nextQueuedJob.server?.name || t('noServer')}</span>
        </div>
      ) : null}
    </div>
  );
}
