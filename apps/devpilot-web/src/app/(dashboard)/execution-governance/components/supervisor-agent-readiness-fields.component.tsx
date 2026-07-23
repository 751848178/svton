'use client';

import { useTranslations } from 'next-intl';
import { LabeledTupleField, ReasonField, SupervisorField } from './ui-bits';
import {
  formatAgentLifecycleReason,
  formatAgentLifecycleState,
} from '../supervisor-agent-format.utils';
import { formatAgentRuntimeState } from '../utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

/**
 * Agent 就绪度卡片的密集字段网格。
 *
 * 把原先的 `${online}/${stale}/${unknown}`、`${status}:${count} · ...` 等
 * 无标签 slash-tuple / 冒号拼接，全部改为带图例的 LabeledTupleField
 * （每项「标签 + 数值」可读 chip），不丢任何指标。
 *
 * 从 supervisor-agent-readiness-card 抽出以满足 200 行上限。
 */
type SupervisorAgent = ServerExecutionSupervisorSnapshot['agent'];

export function SupervisorAgentReadinessFields({
  agent,
  criticalBlockers,
  warningBlockers,
  taskPullCriticalBlockers,
  taskPullWarningBlockers,
}: {
  agent: SupervisorAgent;
  criticalBlockers: number;
  warningBlockers: number;
  taskPullCriticalBlockers: number;
  taskPullWarningBlockers: number;
}) {
  const t = useTranslations('executionGovernance');
  const preflight = agent.lifecyclePreflight;
  const taskPull = agent.taskPullReadiness;

  return (
    <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
      <SupervisorField
        label={t('fieldExecutor')}
        value={agent.dispatcher.executorEnabled ? t('configured') : t('notConfigured')}
      />
      <SupervisorField
        label={t('fieldDispatcher')}
        value={agent.dispatcher.dispatcherConfigured ? t('configured') : t('notConfigured')}
      />
      <SupervisorField label={t('fieldTimeout')} value={`${agent.dispatcher.timeoutSeconds}s`} />
      <SupervisorField
        label={t('fieldToken')}
        value={agent.dispatcher.tokenConfigured ? t('configured') : t('notConfigured')}
      />
      <SupervisorField
        label={t('fieldHeartbeat')}
        value={agent.runtime.heartbeatEnabled ? t('configured') : t('notConfigured')}
      />
      <SupervisorField
        label={t('fieldHbToken')}
        value={agent.runtime.tokenConfigured ? t('configured') : t('notConfigured')}
      />
      <SupervisorField label={t('servicesSource')} value={String(agent.serviceCapabilityServers)} />
      <SupervisorField label={t('tagsSource')} value={String(agent.tagCapabilityServers)} />
      <SupervisorField label={t('onlineAvailable')} value={String(agent.onlineCapableServers)} />
      <LabeledTupleField
        label={t('fieldRuntime')}
        items={[
          { label: t('legendOnline'), value: agent.runtime.onlineServers },
          { label: t('legendStale'), value: agent.runtime.staleServers },
          { label: t('legendUnknown'), value: agent.runtime.unknownServers },
        ]}
      />
      <LabeledTupleField
        label={t('fieldRuntimeReady')}
        items={[
          { label: t('legendReady'), value: agent.runtimeHealth.readyServers },
          { label: t('legendTotal'), value: agent.runtimeHealth.totalServers },
        ]}
      />
      <LabeledTupleField
        label={t('fieldRuntimeIssues')}
        items={[
          { label: t('legendDegraded'), value: agent.runtimeHealth.degradedServers },
          { label: t('legendStale'), value: agent.runtimeHealth.staleServers },
          { label: t('legendMissing'), value: agent.runtimeHealth.missingHeartbeatServers },
        ]}
      />
      <SupervisorField
        label={t('fieldExpiringSoon')}
        value={String(agent.runtimeHealth.expiringSoonServers)}
      />
      <LabeledTupleField
        label={t('statusDistribution')}
        items={
          agent.statusCounts.length
            ? agent.statusCounts.map((item) => ({
                label: formatAgentRuntimeState(item.status),
                value: item.count,
              }))
            : [{ label: '-', value: '-' }]
        }
      />
      <LabeledTupleField
        label={t('fieldFleetLiveReady')}
        items={[
          { label: t('legendLiveReady'), value: agent.fleet.liveDispatchReadyServers },
          { label: t('legendTotal'), value: agent.fleet.totalServers },
        ]}
      />
      <LabeledTupleField
        label={t('fieldFleetPressure')}
        items={[
          { label: t('legendPressure'), value: agent.fleet.pressureServers },
          { label: t('legendScanned'), value: agent.fleet.scannedJobs },
        ]}
      />
      <ReasonField
        label={t('fieldLifecycle')}
        value={formatAgentLifecycleState(preflight.state)}
        reason={formatAgentLifecycleReason(preflight.reason)}
      />
      <LabeledTupleField
        label={t('fieldPreflightBlockers')}
        items={[
          { label: t('severityCritical'), value: criticalBlockers },
          { label: t('severityWarning'), value: warningBlockers },
        ]}
      />
      <ReasonField
        label={t('fieldTaskPull')}
        value={formatAgentLifecycleState(taskPull.state)}
        reason={formatAgentLifecycleReason(taskPull.reason)}
      />
      <LabeledTupleField
        label={t('fieldPullBlockers')}
        items={[
          { label: t('severityCritical'), value: taskPullCriticalBlockers },
          { label: t('severityWarning'), value: taskPullWarningBlockers },
        ]}
      />
    </div>
  );
}
