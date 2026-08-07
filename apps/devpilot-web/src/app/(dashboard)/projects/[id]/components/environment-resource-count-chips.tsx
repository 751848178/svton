/**
 * 环境资源计数徽章
 *
 * 单一职责：把环境的 _count 八项资源计数渲染为一组徽章，供环境详情抽屉与
 * 「资源绑定」子区共用（避免重复实现）。
 */
'use client';

import React from 'react';

import { useTranslations } from 'next-intl';
import type { ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function ResourceCountChips({
  environment,
  t,
}: {
  environment: ProjectEnvironment;
  t: ProjectsTranslator;
}) {
  const c = environment._count;
  if (!c) return null;
  const chips: Array<{ key: string; value: number }> = [
    { key: 'envCountServers', value: c.serverBindings ?? 0 },
    { key: 'envCountSites', value: c.sites ?? 0 },
    { key: 'envCountManaged', value: c.managedResources ?? 0 },
    { key: 'envCountInstances', value: c.resourceInstances ?? 0 },
    { key: 'envCountSecrets', value: c.secretKeys ?? 0 },
    { key: 'envCountCdn', value: c.cdnConfigs ?? 0 },
    { key: 'envCountRequests', value: c.resourceRequests ?? 0 },
    { key: 'envCountRuns', value: c.deploymentRuns ?? 0 },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="rounded-md border bg-muted/40 px-2 py-1 text-xs"
          title={t(chip.key)}
        >
          <span className="font-semibold">{chip.value}</span>{' '}
          <span className="text-muted-foreground">{t(chip.key)}</span>
        </span>
      ))}
    </div>
  );
}
