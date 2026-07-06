'use client';

import { useTranslations } from 'next-intl';
import type { ServerExecutionJob } from '../types';
import { canCancel, canRetry, formatDate, isStaleRunning, shortId } from '../utils';
import {
  AgentDispatchSummary,
  ExecutionTargetSummary,
  RemoteExecutionSummary,
} from './job-summaries';
import { StatusBadge } from './ui-bits';

interface JobTableRowProps {
  job: ServerExecutionJob;
  actingJobId: string;
  onRetry: (job: ServerExecutionJob) => void;
  onCancel: (job: ServerExecutionJob) => void;
}

export function JobTableRow({ job, actingJobId, onRetry, onCancel }: JobTableRowProps) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  const retryable = canRetry(job);
  const cancellable = canCancel(job);

  return (
    <tr>
      <td className="px-4 py-3">
        <StatusBadge status={job.status} />
      </td>
      <td className="px-4 py-3">
        <div className="font-medium">{job.server?.name || t('noServer')}</div>
        <div className="font-mono text-xs text-muted-foreground">{job.server?.host || '-'}</div>
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
          <div className="mt-1 text-xs text-yellow-700">{t('cancelRequested')}</div>
        ) : null}
        {isStaleRunning(job) ? (
          <div className="mt-1 text-xs text-red-600">{t('leaseExpired')}</div>
        ) : null}
        {job.recoveryCount > 0 ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {t('recoveryCount', { count: job.recoveryCount })}
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
        <div>{t('timeQueued', { value: formatDate(job.queuedAt) })}</div>
        <div>{t('timeAvailable', { value: formatDate(job.availableAt) })}</div>
        <div>{t('timeHeartbeat', { value: formatDate(job.lastHeartbeatAt) })}</div>
        <div>{t('timeLockExpires', { value: formatDate(job.lockExpiresAt) })}</div>
        <div>{t('timeStarted', { value: formatDate(job.startedAt) })}</div>
        <div>{t('timeFinished', { value: formatDate(job.finishedAt) })}</div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {retryable ? (
            <button
              onClick={() => onRetry(job)}
              disabled={actingJobId === job.id}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {tc('retry')}
            </button>
          ) : null}
          {cancellable ? (
            <button
              onClick={() => onCancel(job)}
              disabled={actingJobId === job.id}
              className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
            >
              {tc('cancel')}
            </button>
          ) : null}
          {!retryable && !cancellable ? (
            <span className="text-xs text-muted-foreground">-</span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
