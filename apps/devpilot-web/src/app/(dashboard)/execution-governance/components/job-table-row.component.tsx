'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ServerExecutionJob } from '../types';
import { canCancel, canRetry, formatDate, formatJsonDetail, isStaleRunning, shortId } from '../utils';
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
  const [expanded, setExpanded] = useState(false);
  const retryable = canRetry(job);
  const cancellable = canCancel(job);

  return (
    <>
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
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 block max-w-xs truncate text-left text-xs text-red-600 underline-offset-2 hover:underline"
            >
              {job.error}
            </button>
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
            {job.retryOf ? t('retryOfId', { id: shortId(job.retryOf.id) }) : t('originalJob')}
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
            <button
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="min-h-11 rounded-md border px-3 text-xs hover:bg-accent"
            >
              {expanded ? t('collapse') : t('detailToggle')}
            </button>
            {retryable ? (
              <button
                onClick={() => onRetry(job)}
                disabled={actingJobId === job.id}
                className="min-h-11 rounded-md border px-3 text-xs hover:bg-accent disabled:opacity-50"
              >
                {tc('retry')}
              </button>
            ) : null}
            {cancellable ? (
              <button
                onClick={() => onCancel(job)}
                disabled={actingJobId === job.id}
                className="min-h-11 rounded-md border px-3 text-xs hover:bg-accent disabled:opacity-50"
              >
                {tc('cancel')}
              </button>
            ) : null}
          </div>
        </td>
      </tr>
      {expanded ? (
        <tr className="bg-muted/30">
          <td
            colSpan={7}
            className="px-4 py-4"
          >
            <div className="space-y-4 text-xs">
              {job.error ? (
                <div>
                  <div className="font-medium text-foreground">{t('detailError')}</div>
                  <pre className="mt-1 whitespace-pre-wrap break-all rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                    {job.error}
                  </pre>
                </div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground">{t('detailParams')}</div>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 font-mono text-muted-foreground">
                    {formatJsonDetail(job.inputSnapshot)}
                  </pre>
                </div>
                <div>
                  <div className="font-medium text-foreground">{t('detailMetadata')}</div>
                  <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-3 font-mono text-muted-foreground">
                    {formatJsonDetail(job.metadata)}
                  </pre>
                </div>
              </div>
              {retryable ? (
                <div>
                  <button
                    onClick={() => onRetry(job)}
                    disabled={actingJobId === job.id}
                    className="min-h-11 rounded-md border px-3 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    {tc('retry')}
                  </button>
                </div>
              ) : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
