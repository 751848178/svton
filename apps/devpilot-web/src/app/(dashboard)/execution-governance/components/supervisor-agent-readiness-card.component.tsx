import { SupervisorAgentFleetSection } from './supervisor-agent-fleet-section.component';
import { SupervisorAgentJobsHealthSection } from './supervisor-agent-jobs-health-section.component';
import { SupervisorAgentLifecycleSection } from './supervisor-agent-lifecycle-section.component';
import { SupervisorAgentTaskPullSection } from './supervisor-agent-task-pull-section.component';
import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatAgentLifecycleReason,
  formatAgentLifecycleState,
} from '../supervisor-agent-format.utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorAgentReadinessCard({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  const agent = supervisor.agent;
  const preflight = agent.lifecyclePreflight;
  const taskPull = agent.taskPullReadiness;
  const criticalBlockers = preflight.blockers.filter(
    (blocker) => blocker.severity === 'critical',
  ).length;
  const warningBlockers = preflight.blockers.filter(
    (blocker) => blocker.severity === 'warning',
  ).length;
  const taskPullCriticalBlockers = taskPull.blockers.filter(
    (blocker) => blocker.severity === 'critical',
  ).length;
  const taskPullWarningBlockers = taskPull.blockers.filter(
    (blocker) => blocker.severity === 'warning',
  ).length;

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">Agent readiness</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {agent.capableServers}/{agent.totalServers} servers
          </div>
        </div>
        <StatusBadge status={agent.targetSelectionEnabled ? 'running' : 'blocked'} />
      </div>
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label="executor"
          value={agent.dispatcher.executorEnabled ? '开启' : '关闭'}
        />
        <SupervisorField
          label="dispatcher"
          value={agent.dispatcher.dispatcherConfigured ? '已配置' : '未配置'}
        />
        <SupervisorField
          label="timeout"
          value={`${agent.dispatcher.timeoutSeconds}s`}
        />
        <SupervisorField
          label="token"
          value={agent.dispatcher.tokenConfigured ? '已配置' : '未配置'}
        />
        <SupervisorField
          label="heartbeat"
          value={agent.runtime.heartbeatEnabled ? '开启' : '关闭'}
        />
        <SupervisorField
          label="hb token"
          value={agent.runtime.tokenConfigured ? '已配置' : '未配置'}
        />
        <SupervisorField
          label="services 来源"
          value={String(agent.serviceCapabilityServers)}
        />
        <SupervisorField
          label="tags 来源"
          value={String(agent.tagCapabilityServers)}
        />
        <SupervisorField
          label="在线可用"
          value={String(agent.onlineCapableServers)}
        />
        <SupervisorField
          label="runtime"
          value={`${agent.runtime.onlineServers}/${agent.runtime.staleServers}/${agent.runtime.unknownServers}`}
        />
        <SupervisorField
          label="runtime ready"
          value={`${agent.runtimeHealth.readyServers}/${agent.runtimeHealth.totalServers}`}
        />
        <SupervisorField
          label="runtime issues"
          value={`${agent.runtimeHealth.degradedServers}/${agent.runtimeHealth.staleServers}/${agent.runtimeHealth.missingHeartbeatServers}`}
        />
        <SupervisorField
          label="expiring soon"
          value={String(agent.runtimeHealth.expiringSoonServers)}
        />
        <SupervisorField
          label="状态分布"
          value={
            agent.statusCounts.length
              ? agent.statusCounts.map((item) => `${item.status}:${item.count}`).join(' · ')
              : '-'
          }
        />
        <SupervisorField
          label="fleet live-ready"
          value={`${agent.fleet.liveDispatchReadyServers}/${agent.fleet.totalServers}`}
        />
        <SupervisorField
          label="fleet pressure"
          value={`${agent.fleet.pressureServers}/${agent.fleet.scannedJobs}`}
        />
        <SupervisorField
          label="lifecycle"
          value={formatAgentLifecycleState(preflight.state)}
        />
        <SupervisorField
          label="preflight blockers"
          value={`${criticalBlockers}/${warningBlockers}`}
        />
        <SupervisorField
          label="task pull"
          value={formatAgentLifecycleState(taskPull.state)}
        />
        <SupervisorField
          label="pull blockers"
          value={`${taskPullCriticalBlockers}/${taskPullWarningBlockers}`}
        />
      </div>
      {agent.dispatcher.dispatcherUrl ? (
        <div className="mt-3 break-all font-mono text-xs text-muted-foreground">
          {agent.dispatcher.dispatcherUrl}
        </div>
      ) : null}

      <SupervisorAgentLifecycleSection preflight={preflight} />
      <SupervisorAgentTaskPullSection taskPull={taskPull} />
      <SupervisorAgentJobsHealthSection agent={agent} />
      <SupervisorAgentFleetSection agent={agent} />
    </div>
  );
}
