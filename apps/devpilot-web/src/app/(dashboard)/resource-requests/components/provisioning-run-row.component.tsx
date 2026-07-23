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
        <div className="flex flex-wrap items-center gap-1">
          {getRunStatusBadge(run.status)}
          {run.queueMode === 'queued' ? (
            <span className="text-xs text-muted-foreground">{t('queueRun')}</span>
          ) : null}
        </div>
        {run.recoveredAt ? (
          <div className="mt-1 text-xs text-red-700">{t('recovered')}</div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <div>{getRunTriggerLabel(run.trigger)}</div>
        <div className="text-xs text-muted-foreground">
          {[run.mode, run.boundary].filter(Boolean).join(' · ') || '-'}
          {run.autoRetry ? ` · ${t('autoRetry')}` : ''}
        </div>
        {run.replayOfRunId ? (
          <div className="text-xs text-muted-foreground">{t('source', { id: shortId(run.replayOfRunId) })}</div>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <div className="text-xs text-muted-foreground">{t('executorLabel')}</div>
        <div
          className="max-w-[180px] truncate font-medium"
          title={run.executorKey || undefined}
        >
          {run.executorKey || '-'}
        </div>
      </td>
      <td className="px-3 py-3">
        <div>
          {run.attempt ?? 0} / {run.maxAttempts ?? 1}
        </div>
        <div className="text-xs text-muted-foreground">
          {run.retryable ? t('retryable') : t('notRetryable')}
          {Boolean(run.replayAttemptsCount)
            ? ` · ${t('replayedTimes', { count: run.replayAttemptsCount || 0 })}`
            : ''}
          {Boolean(run.recoveryCount)
            ? ` · ${t('recoveredTimes', { count: run.recoveryCount || 0 })}`
            : ''}
        </div>
      </td>
      <td className="px-3 py-3">
        <div
          className="max-w-[180px] truncate"
          title={run.providerRunId || undefined}
        >
          {run.providerRunId || '-'}
        </div>
      </td>
      <td className="px-3 py-3">
        <div>{formatDateTime(run.startedAt)}</div>
        <div className="text-xs text-muted-foreground">{formatDateTime(run.finishedAt)}</div>
        {run.queuedAt ? (
          <div className="text-xs text-muted-foreground">{t('enqueuedAt', { time: formatDateTime(run.queuedAt) })}</div>
        ) : null}
        {run.recoveredAt ? (
          <div className="text-xs text-muted-foreground">{t('recoveredAt', { time: formatDateTime(run.recoveredAt) })}</div>
        ) : null}
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

/**
 * 运行摘要：优先展示 error / recoveryReason（运维最关心）。
 * 否则用友好标签（参数/结果）+ 字段名列表（muted 次要）替代原先的 `params: <keys>` 原始拼接。
 */
function ProvisioningRunSummary({ run }: { run: ResourceProvisioningRun }) {
  const t = useTranslations('resourceRequests');

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

  const paramsKeys = summarizeRecord(run.params);
  const resultKeys = summarizeRecord(run.result);
  return (
    <div className="max-w-[220px] space-y-0.5 text-xs">
      <div>
        <span className="font-medium text-foreground">{t('paramsLabel')}: </span>
        <span className="text-muted-foreground">{paramsKeys}</span>
      </div>
      <div>
        <span className="font-medium text-foreground">{t('resultLabel')}: </span>
        <span className="text-muted-foreground">{resultKeys}</span>
      </div>
    </div>
  );
}
