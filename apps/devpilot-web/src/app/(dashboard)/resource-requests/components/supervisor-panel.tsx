/** 供给运行 Supervisor 面板。 */
'use client';

import { useTranslations } from 'next-intl';
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

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SupervisorStatGroup
          title={t('groupActive')}
          stats={[
            { label: t('queued'), value: counts?.queued },
            { label: t('running'), value: counts?.running },
            { label: t('planned'), value: counts?.planned },
          ]}
        />
        <SupervisorStatGroup
          title={t('groupTerminal')}
          stats={[
            { label: t('completed'), value: counts?.completed },
            { label: t('failed'), value: counts?.failed },
            { label: t('blocked'), value: counts?.blocked },
            { label: t('timeout'), value: counts?.staleRunning },
          ]}
        />
      </div>

      {supervisor && (
        <SupervisorDetails
          scheduler={scheduler}
          staleAfterSeconds={supervisor.staleAfterSeconds}
          queuedSample={queuedSample}
          staleSample={staleSample}
          t={t}
        />
      )}
    </div>
  );
}

/** 指标小组：一个子标题 + 若干 mini 统计块。无数据时一并显示 '-'。 */
function SupervisorStatGroup({
  title,
  stats,
}: {
  title: string;
  stats: { label: string; value: number | undefined }[];
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">{title}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded border px-3 py-2"
          >
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="mt-1 text-lg font-semibold">{stat.value ?? '-'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 调度开关 / 阈值 / 采样 chips：次要信息折叠进 <details>，避免与上方统计区抢注意力。
 * 最早队列 / 最早超时这两个采样 chip 信息量更高，默认展开外露。
 */
function SupervisorDetails({
  scheduler,
  staleAfterSeconds,
  queuedSample,
  staleSample,
  t,
}: {
  scheduler: ResourceProvisioningRunSupervisor['scheduler'] | undefined;
  staleAfterSeconds: number;
  queuedSample?: { id: string; availableAt?: string; queuedAt?: string };
  staleSample?: { id: string; startedAt?: string };
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const switches = (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
      <span className="rounded border px-2 py-1">
        {t('autoRetrySwitch', { state: scheduler?.autoRetryEnabled ? t('on') : t('off') })}
      </span>
      <span className="rounded border px-2 py-1">
        {t('staleRecoverySwitch', { state: scheduler?.staleRecoveryEnabled ? t('on') : t('off') })}
      </span>
      <span className="rounded border px-2 py-1">
        {t('queueSwitch', { state: scheduler?.queueingEnabled ? t('on') : t('off') })}
      </span>
      <span className="rounded border px-2 py-1">{t('thresholdSeconds', { seconds: staleAfterSeconds })}</span>
    </div>
  );

  const samples = queuedSample || staleSample ? (
    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
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
  ) : null;

  return (
    <div className="mt-3 space-y-2">
      {samples}
      <details>
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          {t('governanceDetails')}
        </summary>
        <div className="mt-2">{switches}</div>
      </details>
    </div>
  );
}
