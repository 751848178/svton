/**
 * 资源 Tab
 *
 * 单一职责：把项目下"此前在详情页不可见"的资源汇总出来 ——
 * 站点、托管资源、资源实例、密钥、CDN、资源分配。
 * 数据全部来自 useProjectDetail 返回的 Project（无新增请求），
 * 以 MetricCard 计数 + 分组的方式概览。
 *
 * 这些资源各自的明细管理页（独立路由）后续可补；当前先给出"有多少"。
 */

'use client';

import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { MetricCard } from '@/components/ui';
import type { useProjectDetail } from '../../hooks/use-project-detail';
import type { Project } from '../../types';
import { ResourceBindCard } from './resource-bind-card';

type DetailHook = ReturnType<typeof useProjectDetail>;

export function ResourcesTab({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p) return null;

  const groups = buildResourceGroups(p);
  const total = groups.reduce((sum, g) => sum + g.value, 0);

  return (
    <div className="space-y-6">
      {/* 关联资源到环境:回答「资源能否在项目侧关联供部署直接配置」(#11)。 */}
      <ResourceBindCard detail={detail} />
      {total === 0 ? (
        <EmptyState text={t('noResources')} />
      ) : (
        groups.map((group) =>
          group.value > 0 ? (
            <section
              key={group.key}
              className="space-y-3"
            >
              <h3 className="text-sm font-medium text-muted-foreground">{t(group.labelKey)}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  label={t(group.metricLabelKey)}
                  value={group.value}
                />
              </div>
            </section>
          ) : null,
        )
      )}
    </div>
  );
}

interface ResourceGroup {
  key: string;
  labelKey: string;
  metricLabelKey: string;
  value: number;
}

/** 从 Project 各资源数组汇总计数（纯函数）。 */
function buildResourceGroups(p: Project): ResourceGroup[] {
  return [
    {
      key: 'sites',
      labelKey: 'resourceGroupSites',
      metricLabelKey: 'siteCount',
      value: p.sites?.length ?? 0,
    },
    {
      key: 'managed',
      labelKey: 'resourceGroupManaged',
      metricLabelKey: 'managedResourceCount',
      value: p.managedResources?.length ?? 0,
    },
    {
      key: 'instances',
      labelKey: 'resourceGroupInstances',
      metricLabelKey: 'resourceInstanceCount',
      value: p.resourceInstances?.length ?? 0,
    },
    {
      key: 'secrets',
      labelKey: 'resourceGroupSecrets',
      metricLabelKey: 'secretKeyCount',
      value: p.secretKeys?.length ?? 0,
    },
    {
      key: 'cdn',
      labelKey: 'resourceGroupCdn',
      metricLabelKey: 'cdnConfigCount',
      value: p.cdnConfigs?.length ?? 0,
    },
    {
      key: 'allocations',
      labelKey: 'resourceGroupAllocations',
      metricLabelKey: 'allocationCount',
      value: p.allocations?.length ?? 0,
    },
  ];
}
