'use client';

/**
 * 指标卡区
 *
 * 单一职责：四张全局 MetricCard（项目总数 / 进行中部署 / 待处理资源申请 / 活跃告警）。
 */

import { useTranslations } from 'next-intl';
import { MetricCard } from '@/components/ui';

interface MetricsGridProps {
  projectCount: number;
  runningDeployments: number;
  pendingRequests: number;
  firingAlerts: number;
}

export function MetricsGrid({
  projectCount,
  runningDeployments,
  pendingRequests,
  firingAlerts,
}: MetricsGridProps) {
  const t = useTranslations('dashboard');

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label={t('metricProjects')} value={projectCount} />
      <MetricCard label={t('metricRunningDeployments')} value={runningDeployments} />
      <MetricCard label={t('metricPendingRequests')} value={pendingRequests} />
      <MetricCard label={t('metricFiringAlerts')} value={firingAlerts} />
    </div>
  );
}
