/** 供给运行记录弹窗 - 展示运行历史、重放、provider 对账。 */
'use client';

import { LoadingState } from '@svton/ui';
import { Modal, ErrorBanner } from '@/components/ui';
import type { ResourceRequest, ResourceProvisioningRun } from '../types';
import {
  getRunStatusBadge,
  getRunTriggerLabel,
  formatDateTime,
  summarizeRecord,
  shortId,
  canReplayProvisioningRun,
} from '../badges';

export function ProvisioningRunsModal({
  request,
  runs,
  loading,
  error,
  replayingRunId,
  onReplay,
  onClose,
}: {
  request: ResourceRequest;
  runs: ResourceProvisioningRun[];
  loading: boolean;
  error: string;
  replayingRunId: string | null;
  onReplay: (run: ResourceProvisioningRun) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-background rounded-lg shadow-lg w-full max-w-5xl p-6 max-h-[88vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">交付运行记录</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {request.title} · {request.resourceType?.name || '资源'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm rounded border hover:bg-accent"
          >
            关闭
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">加载运行记录...</div>
        ) : runs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            暂无外部交付运行记录
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">状态</th>
                  <th className="px-3 py-2 text-left font-medium">触发/模式</th>
                  <th className="px-3 py-2 text-left font-medium">Adapter</th>
                  <th className="px-3 py-2 text-left font-medium">尝试</th>
                  <th className="px-3 py-2 text-left font-medium">Provider</th>
                  <th className="px-3 py-2 text-left font-medium">时间</th>
                  <th className="px-3 py-2 text-left font-medium">摘要</th>
                  <th className="px-3 py-2 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    className="align-top"
                  >
                    <td className="px-3 py-3">
                      {getRunStatusBadge(run.status)}
                      {run.autoRetry && (
                        <div className="mt-1 text-xs text-muted-foreground">自动补偿</div>
                      )}
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
                        <div className="text-xs text-muted-foreground">
                          源 {shortId(run.replayOfRunId)}
                        </div>
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
                      <div className="text-xs text-muted-foreground">
                        {run.retryable ? '可重试' : '不可重试'}
                      </div>
                      {Boolean(run.replayAttemptsCount) && (
                        <div className="text-xs text-muted-foreground">
                          已重放 {run.replayAttemptsCount} 次
                        </div>
                      )}
                      {Boolean(run.recoveryCount) && (
                        <div className="text-xs text-muted-foreground">
                          恢复 {run.recoveryCount} 次
                        </div>
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
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(run.finishedAt)}
                      </div>
                      {run.queuedAt && (
                        <div className="text-xs text-muted-foreground">
                          入队 {formatDateTime(run.queuedAt)}
                        </div>
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
                      {run.recoveryReason ? (
                        <div
                          className="max-w-[220px] text-red-700"
                          title={run.recoveryReason}
                        >
                          {run.recoveryReason}
                        </div>
                      ) : run.error ? (
                        <div
                          className="max-w-[220px] text-destructive"
                          title={run.error}
                        >
                          {run.error}
                        </div>
                      ) : (
                        <div className="text-muted-foreground">
                          params: {summarizeRecord(run.params)}
                          <br />
                          result: {summarizeRecord(run.result)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canReplayProvisioningRun(request, run) ? (
                        <button
                          onClick={() => onReplay(run)}
                          disabled={replayingRunId === run.id}
                          className="px-2 py-1 text-xs rounded border hover:bg-accent disabled:opacity-50"
                        >
                          {replayingRunId === run.id ? '重放中' : '重放'}
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
