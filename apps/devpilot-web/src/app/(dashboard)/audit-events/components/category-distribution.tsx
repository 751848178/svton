/**
 * 审计事件分类分布（紧凑标签行）
 *
 * 单一职责：把原 6 张分类 MetricCard / 分布区块收敛为一行紧凑的「标签 + 计数」。
 * 与聚合卡共用同一个 stats 数据源，口径不变；不再占独立大块，节省纵向空间。
 */

'use client';

import { Tag } from '@svton/ui';
import type { AuditStats } from '../types';
import { categoryLabels } from '../constants';

interface CategoryDistributionProps {
  stats: AuditStats;
}

export function CategoryDistribution({ stats }: CategoryDistributionProps) {
  const rows: { key: string; value: number }[] = [
    { key: 'deployment', value: stats.deployments },
    { key: 'resource_action', value: stats.resourceActions },
    { key: 'service_operation', value: stats.serviceOperations },
    { key: 'backup', value: stats.backups },
    { key: 'alert', value: stats.alerts },
    { key: 'log', value: stats.logs },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {rows.map((row) => (
        <Tag key={row.key} color={row.value > 0 ? 'blue' : 'default'}>
          {categoryLabels[row.key] || row.key}
          <span className="ml-1 tabular-nums">{row.value}</span>
        </Tag>
      ))}
    </div>
  );
}
