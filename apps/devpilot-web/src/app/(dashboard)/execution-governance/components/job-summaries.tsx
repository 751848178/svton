/**
 * 执行治理域 - Job 摘要展示组件
 *
 * 单一职责：渲染执行目标、Agent 投递、远程执行、清理行摘要。
 */

import type { ServerExecutionJob, RemoteExecutionCleanup } from '../types';
import { readExecutionTarget, readAgentDispatch, readRemoteExecution } from '../utils-readers';
import {
  formatAgentSource,
  formatAgentDispatchMode,
  formatEnabled,
  formatConfigured,
  formatCleanupReason,
  shortId,
  formatDate,
} from '../utils';

export function ExecutionTargetSummary({ job }: { job: ServerExecutionJob }) {
  const target = readExecutionTarget(job);
  const isAgentTarget = target.transport === 'server_agent';
  const transportClass = isAgentTarget
    ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
    : 'bg-muted text-muted-foreground ring-border';

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">执行路径</span>
      <span className={`rounded-full px-2 py-0.5 font-mono ring-1 ${transportClass}`}>
        {target.transport}
      </span>
      {target.agentRef ? (
        <span className="min-w-0 text-muted-foreground">
          agent: <span className="text-foreground">{target.agentRef.displayName}</span>
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
        <span className="text-yellow-700">agentRef 缺失</span>
      ) : null}
    </div>
  );
}

export function AgentDispatchSummary({ result }: { result?: unknown }) {
  const dispatch = readAgentDispatch(result);
  if (!dispatch) return null;

  const statusClass =
    dispatch.mode === 'agent_dispatch'
      ? dispatch.executed
        ? 'text-green-700'
        : 'text-yellow-700'
      : dispatch.mode === 'agent_dispatch_failed'
        ? 'text-red-600'
        : 'text-yellow-700';

  return (
    <div className="mt-2 space-y-1 border-l-2 border-violet-200 pl-2 text-xs">
      <div className={statusClass}>
        <span className="font-medium text-foreground">Agent dispatch</span>
        <span> · {formatAgentDispatchMode(dispatch.mode)}</span>
        {dispatch.responseStatus ? <span> · {dispatch.responseStatus}</span> : null}
        {dispatch.agentRunId ? <span> · run {shortId(dispatch.agentRunId)}</span> : null}
      </div>
      <div className="text-muted-foreground">
        <span>executor {formatEnabled(dispatch.agentExecutorEnabled)}</span>
        <span> · dispatcher {formatConfigured(dispatch.dispatcherConfigured)}</span>
        {dispatch.dispatcher ? (
          <span>
            {' '}
            · <span className="font-mono text-foreground">{dispatch.dispatcher}</span>
          </span>
        ) : null}
      </div>
      {dispatch.dispatchId || dispatch.serverExecutionJobId || dispatch.retryAttempt ? (
        <div className="text-muted-foreground">
          {dispatch.dispatchId ? (
            <span>
              dispatch <span className="font-mono text-foreground">{dispatch.dispatchId}</span>
            </span>
          ) : null}
          {dispatch.serverExecutionJobId ? (
            <span>
              {' '}
              · job{' '}
              <span className="font-mono text-foreground">
                {shortId(dispatch.serverExecutionJobId)}
              </span>
            </span>
          ) : null}
          {dispatch.serverExecutionLeaseId ? (
            <span>
              {' '}
              · lease{' '}
              <span className="font-mono text-foreground">
                {shortId(dispatch.serverExecutionLeaseId)}
              </span>
            </span>
          ) : null}
          {dispatch.retryAttempt ? (
            <span>
              {' '}
              · attempt {dispatch.retryAttempt}
              {dispatch.maxAttempts ? `/${dispatch.maxAttempts}` : ''}
            </span>
          ) : null}
        </div>
      ) : null}
      {dispatch.idempotencyKey ? (
        <div className="max-w-xs truncate text-muted-foreground">
          idempotency: <span className="font-mono text-foreground">{dispatch.idempotencyKey}</span>
        </div>
      ) : null}
      {dispatch.nextExecutorBoundary ? (
        <div className="text-yellow-700">边界：{dispatch.nextExecutorBoundary}</div>
      ) : null}
      {dispatch.responseError ? (
        <div className="max-w-xs truncate text-red-600">响应错误：{dispatch.responseError}</div>
      ) : null}
    </div>
  );
}

export function RemoteExecutionSummary({
  metadata,
}: {
  metadata?: Record<string, unknown> | null;
}) {
  const remoteExecution = readRemoteExecution(metadata);
  if (!remoteExecution) return null;

  return (
    <div className="mt-2 space-y-1 border-l-2 border-indigo-200 pl-2 text-xs">
      {remoteExecution.session ? (
        <div className="text-muted-foreground">
          <span className="font-medium text-foreground">
            远端 PID {remoteExecution.session.pid}
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
          label="执行期清理"
          cleanup={remoteExecution.cleanup}
        />
      ) : null}
      {remoteExecution.staleCleanup ? (
        <RemoteCleanupLine
          label="追偿清理"
          cleanup={remoteExecution.staleCleanup}
        />
      ) : null}
      {remoteExecution.updatedAt ? (
        <div className="text-muted-foreground">更新：{formatDate(remoteExecution.updatedAt)}</div>
      ) : null}
    </div>
  );
}

function RemoteCleanupLine({ label, cleanup }: { label: string; cleanup: RemoteExecutionCleanup }) {
  const succeeded = cleanup.succeeded === true;
  const failed = cleanup.succeeded === false;
  const statusClass = succeeded ? 'text-green-700' : failed ? 'text-red-600' : 'text-yellow-700';
  const statusText =
    cleanup.attempted === false ? '未尝试' : succeeded ? '成功' : failed ? '失败' : '已尝试';

  return (
    <div className={statusClass}>
      {label}：{statusText}
      {cleanup.pid ? <span> · PID {cleanup.pid}</span> : null}
      {cleanup.reason ? <span> · {formatCleanupReason(cleanup.reason)}</span> : null}
      {cleanup.error ? <span className="text-red-600"> · {cleanup.error}</span> : null}
    </div>
  );
}
