'use client';

import { useTranslations } from 'next-intl';
import { SupervisorAgentFleetSection } from './supervisor-agent-fleet-section.component';
import { SupervisorAgentJobsHealthSection } from './supervisor-agent-jobs-health-section.component';
import { SupervisorAgentLifecycleSection } from './supervisor-agent-lifecycle-section.component';
import { SupervisorAgentTaskPullSection } from './supervisor-agent-task-pull-section.component';
import { SupervisorAgentReadinessFields } from './supervisor-agent-readiness-fields.component';
import { StatusBadge } from './ui-bits';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

export function SupervisorAgentReadinessCard({
  supervisor,
}: {
  supervisor: ServerExecutionSupervisorSnapshot;
}) {
  const t = useTranslations('executionGovernance');
  const agent = supervisor.agent;
  const preflight = agent.lifecyclePreflight;
  const taskPull = agent.taskPullReadiness;
  const criticalBlockers = preflight.blockers.filter((b) => b.severity === 'critical').length;
  const warningBlockers = preflight.blockers.filter((b) => b.severity === 'warning').length;
  const taskPullCriticalBlockers = taskPull.blockers.filter(
    (b) => b.severity === 'critical',
  ).length;
  const taskPullWarningBlockers = taskPull.blockers.filter((b) => b.severity === 'warning').length;

  return (
    <div className="rounded-lg border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-medium">{t('agentReadiness')}</h3>
          <div className="mt-1 text-xs text-muted-foreground">
            {t('agentServersSummary', {
              capable: agent.capableServers,
              total: agent.totalServers,
            })}
          </div>
        </div>
        <StatusBadge status={agent.targetSelectionEnabled ? 'running' : 'blocked'} />
      </div>
      <SupervisorAgentReadinessFields
        agent={agent}
        criticalBlockers={criticalBlockers}
        warningBlockers={warningBlockers}
        taskPullCriticalBlockers={taskPullCriticalBlockers}
        taskPullWarningBlockers={taskPullWarningBlockers}
      />
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
