'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useBackups } from './hooks/use-backups';
import { PlanForm } from './components/plan-form';
import { PlanCard } from './components/plan-card';
import { RunList } from './components/run-list';
import type { BackupRestoreTarget } from './types';

export default function BackupsPage() {
  const t = useTranslations('backups');
  const tc = useTranslations('common');
  const {
    plans,
    runs,
    backupableResources,
    stats,
    loading,
    creating,
    runningPlanId,
    updatingPlanId,
    error,
    queueBackupRuns,
    setQueueBackupRuns,
    createPlan,
    runPlan,
    togglePlanStatus,
    restoreRun,
    reload,
  } = useBackups();

  const handleRetry = usePersistFn(() => reload());

  // 恢复确认弹窗状态（一个操作一个确认实例，RunList 与 PlanCard run chips 共用）
  const [restoreTarget, setRestoreTarget] = useState<BackupRestoreTarget | null>(null);

  const handleConfirmRestore = usePersistFn(async () => {
    if (!restoreTarget) return;
    await restoreRun(restoreTarget.id);
    setRestoreTarget(null);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescriptionDetail')}
        actions={
          <>
            <label className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={queueBackupRuns}
                onChange={(e) => setQueueBackupRuns(e.target.checked)}
                className="h-4 w-4"
              />
              {t('queueBackupRuns')}
            </label>
            <button
              onClick={handleRetry}
              className="min-h-11 rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              {tc('refresh')}
            </button>
          </>
        }
      />

      {error ? (
        <ErrorBanner
          message={error}
          onRetry={handleRetry}
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label={t('statTotalPlans')}
          value={stats.total}
        />
        <MetricCard
          label={t('statActive')}
          value={stats.active}
        />
        <MetricCard
          label={t('statBlocked')}
          value={stats.blockedRuns}
        />
        <MetricCard
          label={t('statFailedRuns')}
          value={stats.failedRuns}
        />
      </div>

      <PlanForm
        resources={backupableResources}
        creating={creating}
        onCreate={createPlan}
      />

      {loading ? (
        <LoadingState text={tc('loading')} />
      ) : plans.length === 0 ? (
        <EmptyState
          text={t('noPlans')}
          description={t('noPlansHint')}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-4">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                runningPlanId={runningPlanId}
                updatingPlanId={updatingPlanId}
                queueBackupRuns={queueBackupRuns}
                onRun={runPlan}
                onToggleStatus={togglePlanStatus}
                onRestore={setRestoreTarget}
              />
            ))}
          </div>
          <RunList
            runs={runs}
            onRestore={setRestoreTarget}
          />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => {
          if (!open) setRestoreTarget(null);
        }}
        tone="danger"
        title={t('restoreConfirmTitle')}
        description={
          restoreTarget ? t('restoreConfirmDescription', { name: restoreTarget.name }) : undefined
        }
        consequences={[t('restoreConsequenceOverwrite'), t('restoreConsequenceAudit')]}
        confirmLabel={t('restore')}
        cancelLabel={tc('cancel')}
        onConfirm={handleConfirmRestore}
      />
    </div>
  );
}
