/**
 * 执行治理域 - Job 摘要展示组件
 *
 * 单一职责：渲染执行目标、Agent 投递、远程执行、清理行摘要。
 */

'use client';

import { useTranslations } from 'next-intl';
import type { ServerExecutionJob, RemoteExecutionCleanup } from '../types';
import { readExecutionTarget, readRemoteExecution } from '../utils-readers';
import { formatAgentSource, formatCleanupReason, formatDate } from '../utils';

export { AgentDispatchSummary } from './job-agent-dispatch-summary.component';

export function ExecutionTargetSummary({ job }: { job: ServerExecutionJob }) {
  const t = useTranslations('executionGovernance');
  const target = readExecutionTarget(job);
  const isAgentTarget = target.transport === 'server_agent';
  const transportClass = isAgentTarget
    ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    : 'bg-muted text-muted-foreground ring-border';

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{t('executionPath')}</span>
      <span className={`rounded-full px-2 py-0.5 font-mono ring-1 ${transportClass}`}>
        {target.transport}
      </span>
      {target.agentRef ? (
        <span className="min-w-0 text-muted-foreground">
          {t('agentRefLabel')} <span className="text-foreground">{target.agentRef.displayName}</span>
          {target.agentRef.displayName !== target.agentRef.capabilityKey ? (
            <span>
              {' '}
              · <span className="font-mono text-foreground">{target.agentRef.capabilityKey}</span>
            </span>
          ) : null}
          <span> · {formatAgentSource(target.agentRef.source)}</span>
          {target.agentRef.status ? <span> · {target.agentRef.status}</span> : null}
        </span>
      ) : isAgentTarget ? (
        <span className="text-yellow-700">{t('agentRefMissing')}</span>
      ) : null}
    </div>
  );
}

export function RemoteExecutionSummary({
  metadata,
}: {
  metadata?: Record<string, unknown> | null;
}) {
  const t = useTranslations('executionGovernance');
  const remoteExecution = readRemoteExecution(metadata);
  if (!remoteExecution) return null;

  return (
    <div className="mt-2 space-y-1 border-l-2 border-indigo-200 pl-2 text-xs">
      {remoteExecution.session ? (
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">
            {t('remotePid', { value: remoteExecution.session.pid })}
          </span>
          <span> · {remoteExecution.session.transport}</span>
          {remoteExecution.session.serverHost ? (
            <span> · {remoteExecution.session.serverHost}</span>
          ) : null}
          {remoteExecution.session.cleanupStrategy ? (
            <span> · {remoteExecution.session.cleanupStrategy}</span>
          ) : null}
        </div>
      ) : null}
      {remoteExecution.cleanup ? (
        <RemoteCleanupLine
          label={t('executionCleanup')}
          cleanup={remoteExecution.cleanup}
        />
      ) : null}
      {remoteExecution.staleCleanup ? (
        <RemoteCleanupLine
          label={t('staleCleanup')}
          cleanup={remoteExecution.staleCleanup}
        />
      ) : null}
      {remoteExecution.updatedAt ? (
        <div className="text-muted-foreground">
          {t('updatedAt', { value: formatDate(remoteExecution.updatedAt) })}
        </div>
      ) : null}
    </div>
  );
}

function RemoteCleanupLine({ label, cleanup }: { label: string; cleanup: RemoteExecutionCleanup }) {
  const t = useTranslations('executionGovernance');
  const succeeded = cleanup.succeeded === true;
  const failed = cleanup.succeeded === false;
  const statusClass = succeeded ? 'text-green-700' : failed ? 'text-red-600' : 'text-yellow-700';
  const statusText = !cleanup.attempted
    ? t('cleanupNotAttempted')
    : succeeded
      ? t('cleanupSucceeded')
      : failed
        ? t('cleanupFailed')
        : t('cleanupAttempted');

  return (
    <div className={statusClass}>
      {label}：{statusText}
      {cleanup.pid ? <span> · PID {cleanup.pid}</span> : null}
      {cleanup.reason ? <span> · {formatCleanupReason(cleanup.reason)}</span> : null}
      {cleanup.error ? <span className="text-red-600"> · {cleanup.error}</span> : null}
    </div>
  );
}
