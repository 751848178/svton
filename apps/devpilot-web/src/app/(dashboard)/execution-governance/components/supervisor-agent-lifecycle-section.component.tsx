'use client';

import { useTranslations } from 'next-intl';
import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatAgentLifecycleAction,
  formatAgentLifecycleReason,
  formatAgentLifecycleState,
  readAgentLifecycleStatus,
} from '../supervisor-agent-format.utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type AgentLifecyclePreflight = ServerExecutionSupervisorSnapshot['agent']['lifecyclePreflight'];

export function SupervisorAgentLifecycleSection({
  preflight,
}: {
  preflight: AgentLifecyclePreflight;
}) {
  const t = useTranslations('executionGovernance');
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-foreground">{t('secRuntimeLifecycle')}</h4>
        <StatusBadge status={readAgentLifecycleStatus(preflight.state)} />
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label={t('fieldPreflight')}
          value={`${formatAgentLifecycleState(preflight.state)} · ${formatAgentLifecycleReason(preflight.reason)}`}
        />
        <SupervisorField
          label={t('fieldTarget')}
          value={`${preflight.gates.targetSelection.capableServers}/${preflight.gates.targetSelection.onlineCapableServers} · ${formatAgentLifecycleReason(preflight.gates.targetSelection.reason)}`}
        />
        <SupervisorField
          label={t('fieldHeartbeat')}
          value={`${preflight.gates.heartbeat.readyServers}/${preflight.gates.heartbeat.heartbeatServers} · ${formatAgentLifecycleReason(preflight.gates.heartbeat.reason)}`}
        />
        <SupervisorField
          label={t('fieldDispatcher')}
          value={`${preflight.gates.dispatcher.liveDispatchReadyServers} 实时 · ${formatAgentLifecycleReason(preflight.gates.dispatcher.reason)}`}
        />
        <SupervisorField
          label={t('fieldQueue')}
          value={`${preflight.gates.queueWorker.queuedJobs}/${preflight.gates.queueWorker.runningJobs}/${preflight.gates.queueWorker.blockedJobs} · ${formatAgentLifecycleReason(preflight.gates.queueWorker.reason)}`}
        />
        <SupervisorField
          label={t('fieldPressure')}
          value={`${preflight.pressure.servers}/${preflight.pressure.scannedJobs}`}
        />
      </div>

      {preflight.blockers.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {preflight.blockers.slice(0, 4).map((blocker) => (
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

      {preflight.nextSteps.length > 0 ? (
        <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          {preflight.nextSteps.slice(0, 3).map((step) => (
            <div key={step.action}>
              {formatAgentLifecycleAction(step.action)} · {formatAgentLifecycleReason(step.reason)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
