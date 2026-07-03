import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatAgentLifecycleAction,
  formatAgentLifecycleReason,
  formatAgentLifecycleState,
  readAgentLifecycleStatus,
} from '../supervisor-agent-format.utils';
import { shortId } from '../utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type AgentTaskPullReadiness = ServerExecutionSupervisorSnapshot['agent']['taskPullReadiness'];

export function SupervisorAgentTaskPullSection({ taskPull }: { taskPull: AgentTaskPullReadiness }) {
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-foreground">Task pull readiness</h4>
        <StatusBadge status={readAgentLifecycleStatus(taskPull.state)} />
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="readiness"
          value={`${formatAgentLifecycleState(taskPull.state)} · ${formatAgentLifecycleReason(taskPull.reason)}`}
        />
        <SupervisorField
          label="runtime"
          value={`${taskPull.gates.runtime.readyServers}/${taskPull.gates.runtime.capableServers} · ${formatAgentLifecycleReason(taskPull.gates.runtime.reason)}`}
        />
        <SupervisorField
          label="queue"
          value={`${taskPull.gates.queue.readyJobs}/${taskPull.gates.queue.scheduledJobs}/${taskPull.gates.queue.runningJobs} · ${formatAgentLifecycleReason(taskPull.gates.queue.reason)}`}
        />
        <SupervisorField
          label="contract"
          value={formatAgentLifecycleReason(taskPull.gates.pullContract.reason)}
        />
        <SupervisorField
          label="audit"
          value={`${taskPull.gates.audit.totalRecent}/${taskPull.gates.audit.failedRecent + taskPull.gates.audit.blockedRecent + taskPull.gates.audit.highRiskRecent} · ${formatAgentLifecycleReason(taskPull.gates.audit.reason)}`}
        />
        <SupervisorField
          label="pressure"
          value={`${taskPull.pressure.readyJobs}/${taskPull.pressure.runningJobs}/${taskPull.pressure.blockedJobs}/${taskPull.pressure.failedJobs}`}
        />
      </div>

      {taskPull.samples.nextQueuedJob ? (
        <div className="mt-3 text-xs text-muted-foreground">
          next {shortId(taskPull.samples.nextQueuedJob.id)} ·{' '}
          {taskPull.samples.nextQueuedJob.operationKey}
          {taskPull.samples.nextQueuedJob.server
            ? ` · ${taskPull.samples.nextQueuedJob.server.name}`
            : ''}
        </div>
      ) : null}

      {taskPull.blockers.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {taskPull.blockers.slice(0, 4).map((blocker) => (
            <div
              key={`${blocker.severity}-${blocker.reason}`}
              className="flex flex-wrap justify-between gap-2"
            >
              <span>{formatAgentLifecycleReason(blocker.reason)}</span>
              <span>
                {blocker.severity} · {blocker.count}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {taskPull.nextSteps.length > 0 ? (
        <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          {taskPull.nextSteps.slice(0, 3).map((step) => (
            <div key={step.action}>
              {formatAgentLifecycleAction(step.action)} · {formatAgentLifecycleReason(step.reason)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
