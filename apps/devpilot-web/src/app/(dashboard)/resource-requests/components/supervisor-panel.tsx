/** 供给运行 Supervisor 面板。 */
'use client';

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import type { ResourceProvisioningRunSupervisor } from '../types';
import { formatDateTime, shortId } from '../badges';

export function ProvisioningRunSupervisorPanel({
  supervisor,
  error,
  recovering,
  processingQueued,
  onRecover,
  onProcessNext,
}: {
  supervisor: ResourceProvisioningRunSupervisor | null;
  error: string;
  recovering: boolean;
  processingQueued: boolean;
  onRecover: () => void;
  onProcessNext: () => void;
}) {
  const t = useTranslations('resourceRequests');
  const counts = supervisor?.counts;
  const scheduler = supervisor?.scheduler;
  const queuedSample = supervisor?.samples.queued[0];
  const staleSample = supervisor?.samples.staleRunning[0];

  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('deliveryGovernance')}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {supervisor ? t('refreshedAt', { time: formatDateTime(supervisor.generatedAt) }) : t('noGovernanceSummary')}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onProcessNext}
            disabled={processingQueued || !supervisor || (counts?.queued ?? 0) === 0}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent disabled:opacity-50"
          >
            {processingQueued ? t('processing') : t('processNextQueued')}
          </button>
          <button
            onClick={onRecover}
            disabled={recovering || !supervisor}
            className="px-3 py-1.5 text-xs rounded border hover:bg-accent disabled:opacity-50"
          >
            {recovering ? t('recovering') : t('recoverStaleRun')}
          </button>
        </div>
      </div>

      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}

      <div className="mt-4 grid gap-3 md:grid-cols-7">
        {[
          [t('queued'), counts?.queued ?? '-'],
          [t('running'), counts?.running ?? '-'],
          [t('timeout'), counts?.staleRunning ?? '-'],
          [t('planned'), counts?.planned ?? '-'],
          [t('blocked'), counts?.blocked ?? '-'],
          [t('failed'), counts?.failed ?? '-'],
          [t('completed'), counts?.completed ?? '-'],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded border px-3 py-2"
          >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {supervisor && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded border px-2 py-1">
            {t('autoRetrySwitch', { state: scheduler?.autoRetryEnabled ? t('on') : t('off') })}
          </span>
          <span className="rounded border px-2 py-1">
            {t('staleRecoverySwitch', { state: scheduler?.staleRecoveryEnabled ? t('on') : t('off') })}
          </span>
          <span className="rounded border px-2 py-1">
            {t('queueSwitch', { state: scheduler?.queueingEnabled ? t('on') : t('off') })}
          </span>
          <span className="rounded border px-2 py-1">{t('thresholdSeconds', { seconds: supervisor.staleAfterSeconds })}</span>
          {queuedSample && (
            <span className="rounded border px-2 py-1">
              {t('earliestQueued', { id: shortId(queuedSample.id), time: formatDateTime(queuedSample.availableAt || queuedSample.queuedAt) })}
            </span>
          )}
          {staleSample && (
            <span className="rounded border px-2 py-1">
              {t('earliestTimeout', { id: shortId(staleSample.id), time: formatDateTime(staleSample.startedAt) })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
