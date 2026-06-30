/** 供给运行 Supervisor 面板。 */
'use client';

import { LoadingState } from '@svton/ui';
import type { ResourceProvisioningRunSupervisor } from '../types';
import { formatDateTime, shortId } from '../badges';

export function ProvisioningRunSupervisorPanel({
  supervisor,
  error,
  recovering,
  processingQueued,
  onRecover,
  onProcessNext,
}: {
  supervisor: ResourceProvisioningRunSupervisor | null;
  error: string;
  recovering: boolean;
  processingQueued: boolean;
  onRecover: () => void;
  onProcessNext: () => void;
}) {
  const counts = supervisor?.counts;
  const scheduler = supervisor?.scheduler;
  const queuedSample = supervisor?.samples.queued[0];
  const staleSample = supervisor?.samples.staleRunning[0];

  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">交付运行治理</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {supervisor ? `刷新 ${formatDateTime(supervisor.generatedAt)}` : '暂无运行治理摘要'}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onProcessNext}
            disabled={processingQueued || !supervisor || (counts?.queued ?? 0) === 0}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent disabled:opacity-50"
          >
            {processingQueued ? '处理中' : '处理下一条队列'}
          </button>
          <button
            onClick={onRecover}
            disabled={recovering || !supervisor}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent disabled:opacity-50"
          >
            {recovering ? '恢复中' : '恢复超时运行'}
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}

      <div className="mt-4 grid gap-3 md:grid-cols-7">
        {[
          ['队列中', counts?.queued ?? '-'],
          ['运行中', counts?.running ?? '-'],
          ['超时', counts?.staleRunning ?? '-'],
          ['已计划', counts?.planned ?? '-'],
          ['已阻断', counts?.blocked ?? '-'],
          ['失败', counts?.failed ?? '-'],
          ['完成', counts?.completed ?? '-'],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded border px-3 py-2"
          >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {supervisor && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded border px-2 py-1">
            自动补偿 {scheduler?.autoRetryEnabled ? '开启' : '关闭'}
          </span>
          <span className="rounded border px-2 py-1">
            僵尸恢复 {scheduler?.staleRecoveryEnabled ? '开启' : '关闭'}
          </span>
          <span className="rounded border px-2 py-1">
            队列开关 {scheduler?.queueingEnabled ? '开启' : '关闭'}
          </span>
          <span className="rounded border px-2 py-1">阈值 {supervisor.staleAfterSeconds}s</span>
          {queuedSample && (
            <span className="rounded border px-2 py-1">
              最早队列 {shortId(queuedSample.id)} ·{' '}
              {formatDateTime(queuedSample.availableAt || queuedSample.queuedAt)}
            </span>
          )}
          {staleSample && (
            <span className="rounded border px-2 py-1">
              最早超时 {shortId(staleSample.id)} · {formatDateTime(staleSample.startedAt)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
