'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
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
      <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label={t('fieldExecutor')}
          value={agent.dispatcher.executorEnabled ? tc('enabled') : tc('disabled')}
        />
        <SupervisorField
          label={t('fieldDispatcher')}
          value={agent.dispatcher.dispatcherConfigured ? t('configured') : t('notConfigured')}
        />
        <SupervisorField
          label={t('fieldTimeout')}
          value={`${agent.dispatcher.timeoutSeconds}s`}
        />
        <SupervisorField
          label={t('fieldToken')}
          value={agent.dispatcher.tokenConfigured ? t('configured') : t('notConfigured')}
        />
        <SupervisorField
          label={t('fieldHeartbeat')}
          value={agent.runtime.heartbeatEnabled ? tc('enabled') : tc('disabled')}
        />
        <SupervisorField
          label={t('fieldHbToken')}
          value={agent.runtime.tokenConfigured ? t('configured') : t('notConfigured')}
        />
        <SupervisorField
          label={t('servicesSource')}
          value={String(agent.serviceCapabilityServers)}
        />
        <SupervisorField
          label={t('tagsSource')}
          value={String(agent.tagCapabilityServers)}
        />
        <SupervisorField
          label={t('onlineAvailable')}
          value={String(agent.onlineCapableServers)}
        />
        <SupervisorField
          label={t('fieldRuntime')}
          value={`${agent.runtime.onlineServers}/${agent.runtime.staleServers}/${agent.runtime.unknownServers}`}
        />
        <SupervisorField
          label={t('fieldRuntimeReady')}
          value={`${agent.runtimeHealth.readyServers}/${agent.runtimeHealth.totalServers}`}
        />
        <SupervisorField
          label={t('fieldRuntimeIssues')}
          value={`${agent.runtimeHealth.degradedServers}/${agent.runtimeHealth.staleServers}/${agent.runtimeHealth.missingHeartbeatServers}`}
        />
        <SupervisorField
          label={t('fieldExpiringSoon')}
          value={String(agent.runtimeHealth.expiringSoonServers)}
        />
        <SupervisorField
          label={t('statusDistribution')}
          value={
            agent.statusCounts.length
              ? agent.statusCounts.map((item) => `${item.status}:${item.count}`).join(' · ')
              : '-'
          }
        />
        <SupervisorField
          label={t('fieldFleetLiveReady')}
          value={`${agent.fleet.liveDispatchReadyServers}/${agent.fleet.totalServers}`}
        />
        <SupervisorField
          label={t('fieldFleetPressure')}
          value={`${agent.fleet.pressureServers}/${agent.fleet.scannedJobs}`}
        />
        <SupervisorField
          label={t('fieldLifecycle')}
          value={formatAgentLifecycleState(preflight.state)}
        />
        <SupervisorField
          label={t('fieldPreflightBlockers')}
          value={`${criticalBlockers}/${warningBlockers}`}
        />
        <SupervisorField
          label={t('fieldTaskPull')}
          value={formatAgentLifecycleState(taskPull.state)}
        />
        <SupervisorField
          label={t('fieldPullBlockers')}
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
