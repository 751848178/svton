/**
 * 执行任务列表
 *
 * 单一职责：渲染 Server execution job 表格 + 状态筛选 + 取消/重试操作。
 */

import { LoadingState, EmptyState } from '@svton/ui';
import { Metric, StatusBadge } from './ui-bits';
import {
  ExecutionTargetSummary,
  AgentDispatchSummary,
  RemoteExecutionSummary,
} from './job-summaries';
import type { ServerExecutionJob } from '../types';
import type { JobStats } from '../hooks/use-execution-governance';
import { canRetry, canCancel, isStaleRunning, shortId, formatDate } from '../utils';

interface JobListProps {
  jobs: ServerExecutionJob[];
  loading: boolean;
  jobStatus: string;
  onJobStatusChange: (status: string) => void;
  stats: JobStats;
  actingJobId: string;
  onRetry: (job: ServerExecutionJob) => void;
  onCancel: (job: ServerExecutionJob) => void;
}

export function JobList({
  jobs,
  loading,
  jobStatus,
  onJobStatusChange,
  stats,
  actingJobId,
  onRetry,
  onCancel,
}: JobListProps) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">执行任务</h2>
          <p className="text-sm text-muted-foreground">Server executor job history</p>
        </div>
        <label className="block w-44 text-sm">
          <span className="mb-1 block font-medium">状态</span>
          <select
            value={jobStatus}
            onChange={(e) => onJobStatusChange(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="all">全部</option>
            <option value="queued">排队中</option>
            <option value="running">运行中</option>
            <option value="blocked">已阻塞</option>
            <option value="failed">失败</option>
            <option value="cancelled">已取消</option>
            <option value="completed">已完成</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <Metric
          label="任务"
          value={stats.total}
        />
        <Metric
          label="排队中"
          value={stats.queued}
        />
        <Metric
          label="运行中"
          value={stats.running}
        />
        <Metric
          label="锁过期"
          value={stats.stale}
        />
        <Metric
          label="已阻塞"
          value={stats.blocked}
        />
        <Metric
          label="失败"
          value={stats.failed}
        />
      </div>

      {loading ? (
        <LoadingState text="加载中..." />
      ) : jobs.length === 0 ? (
        <EmptyState
          text="暂无执行任务"
          description="Server executor 执行后会在这里出现"
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">服务器</th>
                <th className="px-4 py-3 font-medium">操作</th>
                <th className="px-4 py-3 font-medium">尝试</th>
                <th className="px-4 py-3 font-medium">申请人</th>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="px-4 py-3">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{job.server?.name || '未关联服务器'}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {job.server?.host || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{job.operationKey}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {job.adapterKey} · {job.queueMode}
                    </div>
                    <ExecutionTargetSummary job={job} />
                    <AgentDispatchSummary result={job.result} />
                    {job.error ? (
                      <div className="mt-1 max-w-xs truncate text-xs text-red-600">{job.error}</div>
                    ) : null}
                    {job.cancelRequestedAt ? (
                      <div className="mt-1 text-xs text-yellow-700">已请求取消</div>
                    ) : null}
                    {isStaleRunning(job) ? (
                      <div className="mt-1 text-xs text-red-600">锁租约已过期</div>
                    ) : null}
                    {job.recoveryCount > 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        恢复 {job.recoveryCount} 次
                      </div>
                    ) : null}
                    <RemoteExecutionSummary metadata={job.metadata} />
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      {job.attempt}/{job.maxAttempts}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {job.retryOf ? `retry: ${shortId(job.retryOf.id)}` : 'original'}
                    </div>
                  </td>
                  <td className="px-4 py-3">{job.actor?.name || job.actor?.email || '-'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div>入队：{formatDate(job.queuedAt)}</div>
                    <div>可用：{formatDate(job.availableAt)}</div>
                    <div>心跳：{formatDate(job.lastHeartbeatAt)}</div>
                    <div>锁到：{formatDate(job.lockExpiresAt)}</div>
                    <div>开始：{formatDate(job.startedAt)}</div>
                    <div>结束：{formatDate(job.finishedAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {canRetry(job) ? (
                        <button
                          onClick={() => onRetry(job)}
                          disabled={actingJobId === job.id}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          重试
                        </button>
                      ) : null}
                      {canCancel(job) ? (
                        <button
                          onClick={() => onCancel(job)}
                          disabled={actingJobId === job.id}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                        >
                          取消
                        </button>
                      ) : null}
                      {!canRetry(job) && !canCancel(job) ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
