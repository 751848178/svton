'use client';

/**
 * 仪表盘页（/dashboard）
 *
 * 信息层级：先处理（待办行动区）→ 看状态（指标卡 + 双栏近况）→ 给入口（快捷操作）。
 * 客户端渲染：部署运行 / 告警需数据驱动轮询（usePollingList），与 resource-requests 页同范式。
 */

import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useDashboard } from './hooks/use-dashboard';
import { TodoSection } from './components/todo-section';
import { MetricsGrid } from './components/metrics-grid';
import { RecentDeployments } from './components/recent-deployments';
import { MyResourceRequests } from './components/my-resource-requests';
import { QuickActions } from './components/quick-actions';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tc = useTranslations('common');
  const { stats, recentRuns, recentRequests, loading, hasAnyData, error, retry } = useDashboard();

  return (
    <div className="space-y-6">
      <PageHeader title={t('pageTitle')} description={t('pageDescription')} />

      {error && !hasAnyData ? (
        <ErrorBanner
          message={`${t('loadFailed')}：${error.message}`}
          onRetry={retry}
          retryLabel={tc('retry')}
        />
      ) : loading && !hasAnyData ? (
        <LoadingState text={tc('loading')} />
      ) : (
        <>
          {error ? (
            <ErrorBanner
              message={`${t('loadFailed')}：${error.message}`}
              onRetry={retry}
              retryLabel={tc('retry')}
            />
          ) : null}

          {/* 第 1 层：待办行动区 */}
          <TodoSection
            pendingApprovals={stats.pendingApprovals}
            failedDeployments={stats.failedDeployments24h}
            firingAlerts={stats.firingAlerts}
          />

          {/* 第 2 层：全局指标卡 */}
          <MetricsGrid
            projectCount={stats.projectCount}
            runningDeployments={stats.runningDeployments}
            pendingRequests={stats.pendingRequests}
            firingAlerts={stats.firingAlerts}
          />

          {/* 第 3 层：双栏近况 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <RecentDeployments runs={recentRuns} />
            <MyResourceRequests requests={recentRequests} />
          </div>

          {/* 第 4 层：快捷操作 */}
          <QuickActions />
        </>
      )}
    </div>
  );
}
