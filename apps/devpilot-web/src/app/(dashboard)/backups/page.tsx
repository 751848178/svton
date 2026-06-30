'use client';

import { usePersistFn } from '@svton/hooks';
import { LoadingState, EmptyState } from '@svton/ui';
import { PageHeader, ErrorBanner, MetricCard } from '@/components/ui';
import { useBackups } from './hooks/use-backups';
import { PlanForm } from './components/plan-form';
import { PlanCard } from './components/plan-card';
import { RunList } from './components/run-list';

export default function BackupsPage() {
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
        title="备份计划"
        description="管理数据库和中间件资源的备份计划、dry-run 执行计划和运行记录"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={queueBackupRuns}
                onChange={(e) => setQueueBackupRuns(e.target.checked)}
              />
              服务器备份加入队列
            </label>
            <button
              onClick={handleRetry}
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              刷新
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
          label="计划总数"
          value={stats.total}
        />
        <MetricCard
          label="启用中"
          value={stats.active}
        />
        <MetricCard
          label="已阻塞"
          value={stats.blockedRuns}
        />
        <MetricCard
          label="失败运行"
          value={stats.failedRuns}
        />
      </div>

      <PlanForm
        resources={backupableResources}
        creating={creating}
        onCreate={createPlan}
      />

      {loading ? (
        <LoadingState text="加载中..." />
      ) : plans.length === 0 ? (
        <EmptyState
          text="暂无备份计划"
          description="同步 Docker 或 RDS 资源后可以在这里创建备份计划"
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
