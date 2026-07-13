/**
 * 执行任务列表
 *
 * 单一职责：渲染 Server execution job 表格 + 状态筛选 + 取消/重试操作。
 */

'use client';

import { useTranslations } from 'next-intl';
import { LoadingState, EmptyState } from '@svton/ui';
import { Metric } from './ui-bits';
import { JobTableRow } from './job-table-row.component';
import type { ServerExecutionJob } from '../types';
import type { JobStats } from '../hooks/use-execution-governance';

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
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t('jobListTitle')}</h2>
          <p className="text-sm text-muted-foreground">Server executor job history</p>
        </div>
        <label className="block w-44 text-sm">
          <span className="mb-1 block font-medium">{tc('status')}</span>
          <select
            value={jobStatus}
            onChange={(e) => onJobStatusChange(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="all">{tc('all')}</option>
            <option value="queued">{t('statusQueued')}</option>
            <option value="running">{t('statusRunning')}</option>
            <option value="blocked">{t('statusBlocked')}</option>
            <option value="failed">{tc('failed')}</option>
            <option value="cancelled">{t('statusCancelled')}</option>
            <option value="completed">{t('statusCompleted')}</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <Metric
          label={t('metricJobs')}
          value={stats.total}
        />
        <Metric
          label={t('statusQueued')}
          value={stats.queued}
        />
        <Metric
          label={t('statusRunning')}
          value={stats.running}
        />
        <Metric
          label={t('metricStale')}
          value={stats.stale}
        />
        <Metric
          label={t('statusBlocked')}
          value={stats.blocked}
        />
        <Metric
          label={tc('failed')}
          value={stats.failed}
        />
      </div>

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : jobs.length === 0 ? (
        <EmptyState
          text={t('noJobs')}
          description={t('noJobsHint')}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">{tc('status')}</th>
                <th className="px-4 py-3 font-medium">{t('colServer')}</th>
                <th className="px-4 py-3 font-medium">{t('colExecutor')}</th>
                <th className="px-4 py-3 font-medium">{t('colAttempt')}</th>
                <th className="px-4 py-3 font-medium">{t('colApplicant')}</th>
                <th className="px-4 py-3 font-medium">{tc('createdAt')}</th>
                <th className="px-4 py-3 font-medium">{tc('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <JobTableRow
                  key={job.id}
                  job={job}
                  actingJobId={actingJobId}
                  onRetry={onRetry}
                  onCancel={onCancel}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
