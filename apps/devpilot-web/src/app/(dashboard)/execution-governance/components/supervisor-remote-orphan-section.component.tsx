'use client';

import { useTranslations } from 'next-intl';
import { SupervisorField, StatusBadge } from './ui-bits';
import {
  formatRemoteOrphanAction,
  formatRemoteOrphanReason,
  formatRemoteOrphanState,
  readRemoteOrphanStatus,
} from '../supervisor-orphan-audit-format.utils';
import { formatDate, shortId } from '../utils';
import type { ServerExecutionSupervisorSnapshot } from '../supervisor';

type RemoteOrphanGovernancePreflight =
  ServerExecutionSupervisorSnapshot['remoteOrphanGovernancePreflight'];

export function SupervisorRemoteOrphanSection({
  orphanGovernance,
}: {
  orphanGovernance: RemoteOrphanGovernancePreflight;
}) {
  const t = useTranslations('executionGovernance');
  const tc = useTranslations('common');
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-foreground">{t('secRemoteOrphan')}</h4>
        <StatusBadge status={readRemoteOrphanStatus(orphanGovernance.state)} />
      </div>
      <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <SupervisorField
          label={t('fieldPreflight')}
          value={`${formatRemoteOrphanState(orphanGovernance.state)} · ${formatRemoteOrphanReason(orphanGovernance.reason)}`}
        />
        <SupervisorField
          label={t('fieldRemoteSession')}
          value={`${orphanGovernance.gates.remoteSession.recoverableRemoteSessions}/${orphanGovernance.gates.remoteSession.scannedJobs} · ${formatRemoteOrphanReason(orphanGovernance.gates.remoteSession.reason)}`}
        />
        <SupervisorField
          label={t('fieldCleanup')}
          value={`${orphanGovernance.gates.cleanup.enabled ? tc('enabled') : tc('disabled')} · ${orphanGovernance.gates.cleanup.cleanupAttempted}/${orphanGovernance.gates.cleanup.cleanupSucceeded}/${orphanGovernance.gates.cleanup.cleanupFailed}`}
        />
        <SupervisorField
          label={t('fieldOwners')}
          value={`${orphanGovernance.gates.owners.activeOwners}/${orphanGovernance.gates.owners.staleOwners}/${orphanGovernance.gates.owners.expiredOwners} · ${formatRemoteOrphanReason(orphanGovernance.gates.owners.reason)}`}
        />
        <SupervisorField
          label={t('fieldRecovery')}
          value={`${orphanGovernance.gates.recovery.staleRunningJobs}/${orphanGovernance.gates.recovery.scannedJobs}/${orphanGovernance.gates.recovery.unscannedStaleJobs} · ${formatRemoteOrphanReason(orphanGovernance.gates.recovery.reason)}`}
        />
        <SupervisorField
          label={t('fieldRisk')}
          value={`${orphanGovernance.risk.missingRemoteSessions}/${orphanGovernance.risk.invalidRemoteSessions}/${orphanGovernance.risk.cleanupFailed}`}
        />
      </div>

      {orphanGovernance.blockers.length > 0 ? (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {orphanGovernance.blockers.slice(0, 4).map((blocker) => (
            <div
              key={`${blocker.severity}-${blocker.reason}`}
              className="flex flex-wrap justify-between gap-2"
            >
              <span>{formatRemoteOrphanReason(blocker.reason)}</span>
              <span>
                {blocker.severity} · {blocker.count}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {orphanGovernance.nextSteps.length > 0 ? (
        <div className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          {orphanGovernance.nextSteps.slice(0, 3).map((step) => (
            <div key={`${step.action}-${step.reason}`}>
              {formatRemoteOrphanAction(step.action)} · {formatRemoteOrphanReason(step.reason)}
            </div>
          ))}
        </div>
      ) : null}

      {orphanGovernance.samples.length > 0 ? (
        <div className="mt-3 space-y-2 border-t pt-2 text-xs text-muted-foreground">
          {orphanGovernance.samples.slice(0, 2).map((sample) => (
            <div key={sample.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {sample.operationKey} · {sample.server?.name || t('noServer')}
                </span>
                <span className="font-mono">{shortId(sample.id)}</span>
              </div>
              <div className="mt-1">
                {t('orphanSampleMeta', {
                  pid: sample.remoteSession?.pid || '-',
                  owner: sample.lockOwner ? shortId(sample.lockOwner) : t('noOwner'),
                  expires: sample.lockExpiresAt ? formatDate(sample.lockExpiresAt) : '-',
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
