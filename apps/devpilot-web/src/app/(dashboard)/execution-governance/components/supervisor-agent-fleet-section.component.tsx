'use client';

import { useTranslations } from 'next-intl';
import {
  formatAgentBlockingReasons,
  formatAgentRuntimeHealthReason,
  formatAgentRuntimeHealthState,
  formatRuntimeSeconds,
  readAgentFleetStatus,
} from '../supervisor-agent-format.utils';
import { formatAgentRuntimeState, formatDate } from '../utils';
import { humanizeOperationKey, mutedShortId } from '../utils-labels';
import { StatusBadge } from './ui-bits';
import { SupervisorAgentSamples } from './supervisor-agent-samples.component';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type SupervisorAgent = ServerExecutionSupervisorSnapshot['agent'];

export function SupervisorAgentFleetSection({ agent }: { agent: SupervisorAgent }) {
  const t = useTranslations('executionGovernance');
  return (
    <>
      <div className="mt-4 border-t pt-3">
        <h4 className="text-xs font-medium text-foreground">{t('secAgentFleet')}</h4>
        {agent.fleet.items.length === 0 ? (
          <div className="mt-2 text-xs text-muted-foreground">{t('noAgentServer')}</div>
        ) : (
          <div className="mt-3 space-y-3">
            {agent.fleet.items.slice(0, 6).map((server) => (
              <FleetServerRow key={server.id} server={server} />
            ))}
            {agent.fleet.truncated ? (
              <div className="text-xs text-muted-foreground">{t('fleetTruncated')}</div>
            ) : null}
          </div>
        )}
      </div>
      <SupervisorAgentSamples agent={agent} />
    </>
  );
}

type FleetServer = ServerExecutionSupervisorSnapshot['agent']['fleet']['items'][number];

function FleetServerRow({ server }: { server: FleetServer }) {
  const t = useTranslations('executionGovernance');
  return (
    <div className="border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-foreground">{server.name}</div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{server.host}</div>
        </div>
        <StatusBadge status={readAgentFleetStatus(server)} />
      </div>
      <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
        <span>
          {t('fleetJobsLegend', {
            ready: server.jobs.ready,
            running: server.jobs.running,
            blocked: server.jobs.blocked,
          })}
        </span>
        <span>{t('fleetPressure', { value: server.jobs.pressure })}</span>
        <span>
          {server.runtime
            ? t('fleetRuntime', { value: formatAgentRuntimeState(server.runtime.state) })
            : t('fleetRuntimeNone')}
        </span>
        <span>
          {t('fleetHealth', { value: formatAgentRuntimeHealthState(server.runtimeHealth.state) })}
        </span>
        <span>{formatAgentRuntimeHealthReason(server.runtimeHealth.reason)}</span>
        <span>{t('fleetSeen', { value: formatRuntimeSeconds(server.runtimeHealth.lastSeenAgeSeconds) })}</span>
        <span>{t('fleetExpires', { value: formatRuntimeSeconds(server.runtimeHealth.expiresInSeconds) })}</span>
        <span>
          {server.readiness.blockingReasons.length
            ? formatAgentBlockingReasons(server.readiness.blockingReasons)
            : t('fleetReady')}
        </span>
      </div>
      {server.jobs.nextQueuedJob ? (
        <div className="mt-2 text-xs text-muted-foreground">
          {t('opKeyNext', { operation: humanizeOperationKey(server.jobs.nextQueuedJob.operationKey) })}{' '}
          · {t('legendPriority')} {server.jobs.nextQueuedJob.priority}
        </div>
      ) : null}
      {server.jobs.runningProgress?.taskPullProgress ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {t('opKeyProgress', {
            operation: humanizeOperationKey(server.jobs.runningProgress.operationKey),
          })}{' '}
          · {formatTaskPullProgress(server.jobs.runningProgress.taskPullProgress)}
        </div>
      ) : null}
      {server.jobs.blockedSample ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {t('opKeyBlocked', {
            operation: humanizeOperationKey(server.jobs.blockedSample.operationKey),
          })}{' '}
          · {server.jobs.blockedSample.reason}
        </div>
      ) : null}
    </div>
  );
}

function formatTaskPullProgress(progress: {
  updatedAt: string;
  agentId: string;
  runnerId?: string;
  stepKey?: string;
  message?: string;
  percent?: number;
}) {
  const details = [
    progress.message || progress.stepKey,
    progress.percent !== undefined ? `${progress.percent}%` : undefined,
    mutedShortId(progress.agentId),
  ].filter(Boolean);
  return details.length ? details.join(' · ') : formatDate(progress.updatedAt);
}
