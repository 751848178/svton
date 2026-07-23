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
import { shortId } from '../utils';
import { humanizeOperationKey } from '../utils-labels';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type AgentTaskPullReadiness = ServerExecutionSupervisorSnapshot['agent']['taskPullReadiness'];

export function SupervisorAgentTaskPullSection({ taskPull }: { taskPull: AgentTaskPullReadiness }) {
  const t = useTranslations('executionGovernance');
  const failedBlocked =
    taskPull.gates.audit.failedRecent + taskPull.gates.audit.blockedRecent + taskPull.gates.audit.highRiskRecent;
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-foreground">{t('secTaskPullReadiness')}</h4>
        <StatusBadge status={readAgentLifecycleStatus(taskPull.state)} />
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <ReasonField
          label={t('fieldReadiness')}
          value={formatAgentLifecycleState(taskPull.state)}
          reason={formatAgentLifecycleReason(taskPull.reason)}
        />
        <LabeledTupleField
          label={t('fieldRuntime')}
          items={[
            { label: t('legendReady'), value: taskPull.gates.runtime.readyServers },
            { label: t('legendCapable'), value: taskPull.gates.runtime.capableServers },
          ]}
          reason={formatAgentLifecycleReason(taskPull.gates.runtime.reason)}
        />
        <LabeledTupleField
          label={t('fieldQueue')}
          items={[
            { label: t('legendReady'), value: taskPull.gates.queue.readyJobs },
            { label: t('legendScheduled'), value: taskPull.gates.queue.scheduledJobs },
            { label: t('legendRunning'), value: taskPull.gates.queue.runningJobs },
          ]}
          reason={formatAgentLifecycleReason(taskPull.gates.queue.reason)}
        />
        <ReasonField
          label={t('fieldContract')}
          value={formatAgentLifecycleReason(taskPull.gates.pullContract.reason)}
        />
        <LabeledTupleField
          label={t('fieldAudit')}
          items={[
            { label: t('legendRecent'), value: taskPull.gates.audit.totalRecent },
            { label: t('legendFailed'), value: failedBlocked },
          ]}
          reason={formatAgentLifecycleReason(taskPull.gates.audit.reason)}
        />
        <LabeledTupleField
          label={t('fieldPressure')}
          items={[
            { label: t('legendReady'), value: taskPull.pressure.readyJobs },
            { label: t('legendRunning'), value: taskPull.pressure.runningJobs },
            { label: t('legendBlocked'), value: taskPull.pressure.blockedJobs },
            { label: t('legendFailed'), value: taskPull.pressure.failedJobs },
          ]}
        />
      </div>

      {taskPull.samples.nextQueuedJob ? (
        <div className="mt-3 text-xs text-muted-foreground">
          {t('taskPullNextJob', {
            id: shortId(taskPull.samples.nextQueuedJob.id),
            operationKey: humanizeOperationKey(taskPull.samples.nextQueuedJob.operationKey),
          })}
          {taskPull.samples.nextQueuedJob.server
            ? ` · ${taskPull.samples.nextQueuedJob.server.name}`
            : ''}
        </div>
      ) : null}

      <BlockerList blockers={taskPull.blockers} formatReason={formatAgentLifecycleReason} />
      <NextStepList
        steps={taskPull.nextSteps}
        formatAction={formatAgentLifecycleAction}
        formatReason={formatAgentLifecycleReason}
      />
    </div>
  );
}
