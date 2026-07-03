import { SupervisorField } from './ui-bits';
import {
  formatAgentRuntimeHealthReason,
  formatAgentRuntimeHealthState,
  formatRuntimeSeconds,
} from '../supervisor-agent-format.utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type SupervisorAgent = ServerExecutionSupervisorSnapshot['agent'];

export function SupervisorAgentJobsHealthSection({ agent }: { agent: SupervisorAgent }) {
  return (
    <>
      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">Agent jobs</h4>
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <SupervisorField
            label="ready/scheduled"
            value={`${agent.jobs.ready}/${agent.jobs.scheduled}`}
          />
          <SupervisorField
            label="running/stale"
            value={`${agent.jobs.running}/${agent.jobs.staleRunning}`}
          />
          <SupervisorField
            label="blocked/failed"
            value={`${agent.jobs.blocked}/${agent.jobs.failed}`}
          />
          <SupervisorField
            label="cancelled"
            value={String(agent.jobs.cancelled)}
          />
        </div>
      </div>

      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">Runtime health</h4>
        {agent.runtimeHealth.samples.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">runtime ready</div>
        ) : (
          <div className="mt-2 space-y-2">
            {agent.runtimeHealth.samples.slice(0, 4).map((server) => (
              <div
                key={server.id}
                className="text-xs text-muted-foreground"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{server.name}</span>
                  <span>{formatAgentRuntimeHealthState(server.health.state)}</span>
                </div>
                <div className="mt-1 font-mono">{server.host}</div>
                <div className="mt-1">
                  {formatAgentRuntimeHealthReason(server.health.reason)}
                  {server.health.lastSeenAgeSeconds !== undefined
                    ? ` · seen ${formatRuntimeSeconds(server.health.lastSeenAgeSeconds)} ago`
                    : ''}
                  {server.health.expiresInSeconds !== undefined
                    ? ` · expires ${formatRuntimeSeconds(server.health.expiresInSeconds)}`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
