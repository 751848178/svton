'use client';

import { useTranslations } from 'next-intl';
import { LabeledTupleField, ReasonField, StatusBadge } from './ui-bits';
import { BlockerList, NextStepList } from './supervisor-section-parts.component';
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
        <ReasonField
          label={t('fieldPreflight')}
          value={formatAgentLifecycleState(preflight.state)}
          reason={formatAgentLifecycleReason(preflight.reason)}
        />
        <LabeledTupleField
          label={t('fieldTarget')}
          items={[
            { label: t('legendCapable'), value: preflight.gates.targetSelection.capableServers },
            {
              label: t('legendOnlineCapable'),
              value: preflight.gates.targetSelection.onlineCapableServers,
            },
          ]}
          reason={formatAgentLifecycleReason(preflight.gates.targetSelection.reason)}
        />
        <LabeledTupleField
          label={t('fieldHeartbeat')}
          items={[
            { label: t('legendReady'), value: preflight.gates.heartbeat.readyServers },
            { label: t('legendTotal'), value: preflight.gates.heartbeat.heartbeatServers },
          ]}
          reason={formatAgentLifecycleReason(preflight.gates.heartbeat.reason)}
        />
        <LabeledTupleField
          label={t('fieldDispatcher')}
          items={[
            { label: t('liveInline'), value: preflight.gates.dispatcher.liveDispatchReadyServers },
          ]}
          reason={formatAgentLifecycleReason(preflight.gates.dispatcher.reason)}
        />
        <LabeledTupleField
          label={t('fieldQueue')}
          items={[
            { label: t('legendQueued'), value: preflight.gates.queueWorker.queuedJobs },
            { label: t('legendRunning'), value: preflight.gates.queueWorker.runningJobs },
            { label: t('legendBlocked'), value: preflight.gates.queueWorker.blockedJobs },
          ]}
          reason={formatAgentLifecycleReason(preflight.gates.queueWorker.reason)}
        />
        <LabeledTupleField
          label={t('fieldPressure')}
          items={[
            { label: t('legendPressure'), value: preflight.pressure.servers },
            { label: t('legendScanned'), value: preflight.pressure.scannedJobs },
          ]}
        />
      </div>

      <BlockerList blockers={preflight.blockers} formatReason={formatAgentLifecycleReason} />
      <NextStepList
        steps={preflight.nextSteps}
        formatAction={formatAgentLifecycleAction}
        formatReason={formatAgentLifecycleReason}
      />
    </div>
  );
}
