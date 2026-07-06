import { useTranslations } from 'next-intl';
import type { ResourceProvisioningRun, ResourceRequest } from '../types';
import {
  canReconcileProviderProvisioningRun,
  canReplayProvisioningRun,
  formatDateTime,
  getRunStatusBadge,
  getRunTriggerLabel,
  shortId,
  summarizeRecord,
} from '../badges';

interface ProvisioningRunRowProps {
  request: ResourceRequest;
  run: ResourceProvisioningRun;
  replayingRunId: string | null;
  reconcilingRunId: string | null;
  onReplay: (run: ResourceProvisioningRun) => void;
  onReconcile: (run: ResourceProvisioningRun) => void;
}

export function ProvisioningRunRow({
  request,
  run,
  replayingRunId,
  reconcilingRunId,
  onReplay,
  onReconcile,
}: ProvisioningRunRowProps) {
  const t = useTranslations('resourceRequests');
  const canReplay = canReplayProvisioningRun(request, run);
  const canReconcile = canReconcileProviderProvisioningRun(request, run);

  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        {getRunStatusBadge(run.status)}
        {run.autoRetry && <div className="mt-1 text-xs text-muted-foreground">{t('autoRetry')}</div>}
        {run.recoveredAt && <div className="mt-1 text-xs text-red-700">{t('recovered')}</div>}
        {run.queueMode === 'queued' && (
          <div className="mt-1 text-xs text-muted-foreground">{t('queueRun')}</div>
        )}
      </td>
      <td className="px-3 py-3">
        <div>{getRunTriggerLabel(run.trigger)}</div>
        <div className="text-xs text-muted-foreground">
          {run.mode || '-'} · {run.boundary || '-'}
        </div>
        {run.replayOfRunId && (
          <div className="text-xs text-muted-foreground">{t('source', { id: shortId(run.replayOfRunId) })}</div>
        )}
      </td>
      <td className="px-3 py-3">
        <div>{run.executorKey || '-'}</div>
        <div className="text-xs text-muted-foreground">{run.adapterKey || '-'}</div>
        {run.authAdapterKey && (
          <div className="text-xs text-muted-foreground">{run.authAdapterKey}</div>
        )}
      </td>
      <td className="px-3 py-3">
        <div>
          {run.attempt ?? 0} / {run.maxAttempts ?? 1}
        </div>
        <div className="text-xs text-muted-foreground">{run.retryable ? t('retryable') : t('notRetryable')}</div>
        {Boolean(run.replayAttemptsCount) && (
          <div className="text-xs text-muted-foreground">{t('replayedTimes', { count: run.replayAttemptsCount || 0 })}</div>
        )}
        {Boolean(run.recoveryCount) && (
          <div className="text-xs text-muted-foreground">{t('recoveredTimes', { count: run.recoveryCount || 0 })}</div>
        )}
      </td>
      <td className="px-3 py-3">
        <div
          className="max-w-[180px] truncate"
          title={run.providerRunId || undefined}
        >
          {run.providerRunId || '-'}
        </div>
        <code
          className="block max-w-[220px] truncate text-xs text-muted-foreground"
          title={run.idempotencyKey || undefined}
        >
          {run.idempotencyKey || '-'}
        </code>
      </td>
      <td className="px-3 py-3">
        <div>{formatDateTime(run.startedAt)}</div>
        <div className="text-xs text-muted-foreground">{formatDateTime(run.finishedAt)}</div>
        {run.queuedAt && (
          <div className="text-xs text-muted-foreground">{t('enqueuedAt', { time: formatDateTime(run.queuedAt) })}</div>
        )}
        {run.availableAt && (
          <div className="text-xs text-muted-foreground">
            {t('availableAt', { time: formatDateTime(run.availableAt) })}
          </div>
        )}
        {run.recoveredAt && (
          <div className="text-xs text-muted-foreground">
            {t('recoveredAt', { time: formatDateTime(run.recoveredAt) })}
          </div>
        )}
      </td>
      <td className="px-3 py-3">
        <ProvisioningRunSummary run={run} />
      </td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          {canReplay && (
            <button
              onClick={() => onReplay(run)}
              disabled={replayingRunId === run.id}
              className="px-2 py-1 text-xs rounded border hover:bg-accent disabled:opacity-50"
            >
              {replayingRunId === run.id ? t('replaying') : t('replay')}
            </button>
          )}
          {canReconcile && (
            <button
              onClick={() => onReconcile(run)}
              disabled={reconcilingRunId === run.id}
              className="px-2 py-1 text-xs rounded border hover:bg-accent disabled:opacity-50"
            >
              {reconcilingRunId === run.id ? t('reconciling') : t('reconcile')}
            </button>
          )}
          {!canReplay && !canReconcile ? (
            <span className="text-xs text-muted-foreground">-</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

function ProvisioningRunSummary({ run }: { run: ResourceProvisioningRun }) {
  if (run.recoveryReason) {
    return (
      <div
        className="max-w-[220px] text-red-700"
        title={run.recoveryReason}
      >
        {run.recoveryReason}
      </div>
    );
  }

  if (run.error) {
    return (
      <div
        className="max-w-[220px] text-destructive"
        title={run.error}
      >
        {run.error}
      </div>
    );
  }

  return (
    <div className="text-muted-foreground">
      params: {summarizeRecord(run.params)}
      <br />
      result: {summarizeRecord(run.result)}
    </div>
  );
}
