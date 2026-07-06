'use client';

import { useTranslations } from 'next-intl';
import { readAgentDispatch } from '../utils-readers';
import { formatAgentDispatchMode, formatConfigured, formatEnabled, shortId } from '../utils';

export function AgentDispatchSummary({ result }: { result?: unknown }) {
  const t = useTranslations('executionGovernance');
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
        <div className="text-yellow-700">
          {t('dispatchBoundary', { value: dispatch.nextExecutorBoundary })}
        </div>
      ) : null}
      {dispatch.responseError ? (
        <div className="max-w-xs truncate text-red-600">
          {t('responseError', { value: dispatch.responseError })}
        </div>
      ) : null}
    </div>
  );
}
