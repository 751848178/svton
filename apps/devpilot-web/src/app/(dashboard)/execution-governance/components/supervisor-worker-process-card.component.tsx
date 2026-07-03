import { SupervisorField, StatusBadge } from './ui-bits';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorWorkerProcessCard({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">本进程</h3>
          <div className="mt-1 font-mono text-xs text-muted-foreground">
            {supervisor.worker.workerId}
          </div>
        </div>
        <StatusBadge status={supervisor.worker.queueWorkerEnabled ? 'running' : 'blocked'} />
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="处理队列"
          value={supervisor.worker.processingQueue ? '是' : '否'}
        />
        <SupervisorField
          label="取消令牌"
          value={String(supervisor.worker.runningCancellations)}
        />
        <SupervisorField
          label="批量大小"
          value={String(supervisor.worker.queueBatchSize)}
        />
        <SupervisorField
          label="轮询间隔"
          value={`${supervisor.worker.queueIntervalSeconds}s`}
        />
        <SupervisorField
          label="锁 TTL"
          value={`${supervisor.worker.queueLockTtlSeconds}s`}
        />
        <SupervisorField
          label="心跳间隔"
          value={`${supervisor.worker.queueHeartbeatSeconds}s`}
        />
        <SupervisorField
          label="取消轮询"
          value={`${supervisor.worker.cancellationPollSeconds}s`}
        />
        <SupervisorField
          label="远端追偿"
          value={supervisor.worker.staleRemoteCleanupEnabled ? '开启' : '关闭'}
        />
      </div>
      {supervisor.queue.nextQueuedJob ? (
        <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">下一任务</span>
          <span> · {supervisor.queue.nextQueuedJob.operationKey}</span>
          <span> · {supervisor.queue.nextQueuedJob.adapterKey}</span>
          <span> · {supervisor.queue.nextQueuedJob.server?.name || '未关联服务器'}</span>
        </div>
      ) : null}
    </div>
  );
}
