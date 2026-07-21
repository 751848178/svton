/**
 * 审计事件分类分布
 *
 * 单一职责：把原 6 张分类 MetricCard 收敛为一个紧凑区块——
 * 每个分类一行（标签 + 迷你条形 + 计数），不引入图表库。
 * 数字与聚合卡来自同一个 stats 数据源，口径不变。
 */

'use client';

import { useTranslations } from 'next-intl';
import type { AuditStats } from '../types';
import { categoryLabels } from '../constants';

interface CategoryDistributionProps {
  stats: AuditStats;
}

export function CategoryDistribution({ stats }: CategoryDistributionProps) {
  const t = useTranslations('auditEvents');

  const rows: { key: string; value: number }[] = [
    { key: 'deployment', value: stats.deployments },
    { key: 'resource_action', value: stats.resourceActions },
    { key: 'service_operation', value: stats.serviceOperations },
    { key: 'backup', value: stats.backups },
    { key: 'alert', value: stats.alerts },
    { key: 'log', value: stats.logs },
  ];
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm font-medium text-muted-foreground">{t('categoryDistribution')}</div>
      <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 text-muted-foreground">
              {categoryLabels[row.key] || row.key}
            </span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-primary/60"
                style={{ width: `${Math.round((row.value / max) * 100)}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right font-medium tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
