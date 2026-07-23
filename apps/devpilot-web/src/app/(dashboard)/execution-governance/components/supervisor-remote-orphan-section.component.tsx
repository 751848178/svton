'use client';

import { useTranslations } from 'next-intl';
import { LabeledTupleField, ReasonField, StatusBadge } from './ui-bits';
import { BlockerList, NextStepList } from './supervisor-section-parts.component';
import {
  formatRemoteOrphanAction,
  formatRemoteOrphanReason,
  formatRemoteOrphanState,
  readRemoteOrphanStatus,
} from '../supervisor-orphan-audit-format.utils';
import { formatDate, shortId } from '../utils';
import { humanizeOperationKey } from '../utils-labels';
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
        <ReasonField
          label={t('fieldPreflight')}
          value={formatRemoteOrphanState(orphanGovernance.state)}
          reason={formatRemoteOrphanReason(orphanGovernance.reason)}
        />
        <LabeledTupleField
          label={t('fieldRemoteSession')}
          items={[
            {
              label: t('legendRecoverable'),
              value: orphanGovernance.gates.remoteSession.recoverableRemoteSessions,
            },
            { label: t('legendScanned'), value: orphanGovernance.gates.remoteSession.scannedJobs },
          ]}
          reason={formatRemoteOrphanReason(orphanGovernance.gates.remoteSession.reason)}
        />
        <LabeledTupleField
          label={t('fieldCleanup')}
          items={[
            {
              label: t('legendAttempted'),
              value: orphanGovernance.gates.cleanup.cleanupAttempted,
            },
            {
              label: t('legendSucceeded'),
              value: orphanGovernance.gates.cleanup.cleanupSucceeded,
            },
            { label: t('legendFailed'), value: orphanGovernance.gates.cleanup.cleanupFailed },
          ]}
          reason={
            orphanGovernance.gates.cleanup.enabled ? tc('enabled') : tc('disabled')
          }
        />
        <LabeledTupleField
          label={t('fieldOwners')}
          items={[
            { label: t('legendActive'), value: orphanGovernance.gates.owners.activeOwners },
            { label: t('legendStale'), value: orphanGovernance.gates.owners.staleOwners },
            { label: t('legendExpired'), value: orphanGovernance.gates.owners.expiredOwners },
          ]}
          reason={formatRemoteOrphanReason(orphanGovernance.gates.owners.reason)}
        />
        <LabeledTupleField
          label={t('fieldRecovery')}
          items={[
            { label: t('legendStale'), value: orphanGovernance.gates.recovery.staleRunningJobs },
            { label: t('legendScanned'), value: orphanGovernance.gates.recovery.scannedJobs },
            { label: t('legendUnscanned'), value: orphanGovernance.gates.recovery.unscannedStaleJobs },
          ]}
          reason={formatRemoteOrphanReason(orphanGovernance.gates.recovery.reason)}
        />
        <LabeledTupleField
          label={t('fieldRisk')}
          items={[
            { label: t('legendMissing'), value: orphanGovernance.risk.missingRemoteSessions },
            { label: t('legendInvalid'), value: orphanGovernance.risk.invalidRemoteSessions },
            { label: t('legendFailed'), value: orphanGovernance.risk.cleanupFailed },
          ]}
        />
      </div>

      <BlockerList blockers={orphanGovernance.blockers} formatReason={formatRemoteOrphanReason} />
      <NextStepList
        steps={orphanGovernance.nextSteps}
        formatAction={formatRemoteOrphanAction}
        formatReason={formatRemoteOrphanReason}
      />

      {orphanGovernance.samples.length > 0 ? (
        <div className="mt-3 space-y-2 border-t pt-2 text-xs text-muted-foreground">
          {orphanGovernance.samples.slice(0, 2).map((sample) => (
            <div key={sample.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {humanizeOperationKey(sample.operationKey)} ·{' '}
                  {sample.server?.name || t('noServer')}
                </span>
                <span className="font-mono text-muted-foreground">
                  {t('sampleShortId', { id: shortId(sample.id) })}
                </span>
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
