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
  const canReplay = canReplayProvisioningRun(request, run);
  const canReconcile = canReconcileProviderProvisioningRun(request, run);

  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        {getRunStatusBadge(run.status)}
        {run.autoRetry && <div className="mt-1 text-xs text-muted-foreground">自动补偿</div>}
        {run.recoveredAt && <div className="mt-1 text-xs text-red-700">已恢复</div>}
        {run.queueMode === 'queued' && (
          <div className="mt-1 text-xs text-muted-foreground">队列运行</div>
        )}
      </td>
      <td className="px-3 py-3">
        <div>{getRunTriggerLabel(run.trigger)}</div>
        <div className="text-xs text-muted-foreground">
          {run.mode || '-'} · {run.boundary || '-'}
        </div>
        {run.replayOfRunId && (
          <div className="text-xs text-muted-foreground">源 {shortId(run.replayOfRunId)}</div>
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
        <div className="text-xs text-muted-foreground">{run.retryable ? '可重试' : '不可重试'}</div>
        {Boolean(run.replayAttemptsCount) && (
          <div className="text-xs text-muted-foreground">已重放 {run.replayAttemptsCount} 次</div>
        )}
        {Boolean(run.recoveryCount) && (
          <div className="text-xs text-muted-foreground">恢复 {run.recoveryCount} 次</div>
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
          <div className="text-xs text-muted-foreground">入队 {formatDateTime(run.queuedAt)}</div>
        )}
        {run.availableAt && (
          <div className="text-xs text-muted-foreground">
            可用 {formatDateTime(run.availableAt)}
          </div>
        )}
        {run.recoveredAt && (
          <div className="text-xs text-muted-foreground">
            恢复 {formatDateTime(run.recoveredAt)}
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
              {replayingRunId === run.id ? '重放中' : '重放'}
            </button>
          )}
          {canReconcile && (
            <button
              onClick={() => onReconcile(run)}
              disabled={reconcilingRunId === run.id}
              className="px-2 py-1 text-xs rounded border hover:bg-accent disabled:opacity-50"
            >
              {reconcilingRunId === run.id ? '对账中' : '对账'}
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
