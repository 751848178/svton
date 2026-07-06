'use client';

import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useBackups } from './hooks/use-backups';
import { PlanForm } from './components/plan-form';
import { PlanCard } from './components/plan-card';
import { RunList } from './components/run-list';

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
    reload,
  } = useBackups();

  const handleRetry = usePersistFn(() => reload());

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescriptionDetail')}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={queueBackupRuns}
                onChange={(e) => setQueueBackupRuns(e.target.checked)}
              />
              {t('queueBackupRuns')}
            </label>
            <button
              onClick={handleRetry}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
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
              />
            ))}
          </div>
          <RunList runs={runs} />
        </div>
      )}
    </div>
  );
}
