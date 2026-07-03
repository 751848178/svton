import {
  formatAgentBlockingReasons,
  formatAgentRuntimeHealthReason,
  formatAgentRuntimeHealthState,
  formatRuntimeSeconds,
  readAgentFleetStatus,
} from '../supervisor-agent-format.utils';
import { formatAgentRuntimeState, formatAgentSource, formatDate, shortId } from '../utils';
import { StatusBadge } from './ui-bits';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type SupervisorAgent = ServerExecutionSupervisorSnapshot['agent'];

export function SupervisorAgentFleetSection({ agent }: { agent: SupervisorAgent }) {
  return (
    <>
      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">Agent fleet</h4>
        {agent.fleet.items.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">暂无 agent server</div>
        ) : (
          <div className="mt-3 space-y-3">
            {agent.fleet.items.slice(0, 6).map((server) => (
              <div
                key={server.id}
                className="border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">{server.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {server.host}
                    </div>
                  </div>
                  <StatusBadge status={readAgentFleetStatus(server)} />
                </div>
                <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <span>
                    jobs {server.jobs.ready}/{server.jobs.running}/{server.jobs.blocked}
                  </span>
                  <span>pressure {server.jobs.pressure}</span>
                  <span>
                    {server.runtime
                      ? `runtime ${formatAgentRuntimeState(server.runtime.state)}`
                      : 'runtime -'}
                  </span>
                  <span>health {formatAgentRuntimeHealthState(server.runtimeHealth.state)}</span>
                  <span>{formatAgentRuntimeHealthReason(server.runtimeHealth.reason)}</span>
                  <span>seen {formatRuntimeSeconds(server.runtimeHealth.lastSeenAgeSeconds)}</span>
                  <span>expires {formatRuntimeSeconds(server.runtimeHealth.expiresInSeconds)}</span>
                  <span>
                    {server.readiness.blockingReasons.length
                      ? formatAgentBlockingReasons(server.readiness.blockingReasons)
                      : 'ready'}
                  </span>
                </div>
                {server.jobs.nextQueuedJob ? (
                  <div className="mt-2 text-xs text-muted-foreground">
                    next {server.jobs.nextQueuedJob.operationKey} · p
                    {server.jobs.nextQueuedJob.priority}
                  </div>
                ) : null}
                {server.jobs.blockedSample ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    blocked {server.jobs.blockedSample.operationKey} ·{' '}
                    {server.jobs.blockedSample.reason}
                  </div>
                ) : null}
              </div>
            ))}
            {agent.fleet.truncated ? (
              <div className="text-xs text-muted-foreground">fleet truncated</div>
            ) : null}
          </div>
        )}
      </div>

      {agent.samples.length === 0 ? (
        <div className="mt-4 text-xs text-muted-foreground">暂无 agent capability</div>
      ) : (
        <div className="mt-4 space-y-2 border-t pt-3">
          {agent.samples.slice(0, 5).map((server) => (
            <div
              key={server.id}
              className="text-xs text-muted-foreground"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{server.name}</span>
                <span>{server.status}</span>
              </div>
              <div className="mt-1 font-mono">{server.host}</div>
              <div className="mt-1">
                {server.agentRef.displayName} · {formatAgentSource(server.agentRef.source)}
                {server.agentRef.status ? ` · ${server.agentRef.status}` : ''}
              </div>
              {server.runtime ? (
                <div className="mt-1">
                  runtime {formatAgentRuntimeState(server.runtime.state)}
                  {server.runtime.agentId ? ` · ${shortId(server.runtime.agentId)}` : ''}
                  {server.runtime.version ? ` · ${server.runtime.version}` : ''}
                  {server.runtime.lastSeenAt
                    ? ` · seen ${formatDate(server.runtime.lastSeenAt)}`
                    : ''}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
