/**
 * 项目环境面板。
 *
 * 单一职责：渲染环境列表（名称 + 状态 + _count 摘要）。
 * - 行可点击：打开 EnvironmentDetailDrawer 展示该环境的服务器/资源/部署详情。
 * - 行级摘要扩到「N 服务器 · N 实例 · N 站点 · N 部署」，比此前只显示 3 项更直观。
 *
 * 所需数据全部来自 useProjectDetail 返回的 Project + DeploymentRun[]（无新增请求）。
 */
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { getEnvStatusLabelKey } from '../utils/run-labels';
import { EnvironmentDetailDrawer } from './environment-detail-drawer';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectEnvironment } from '../types';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const [activeEnvId, setActiveEnvId] = useState<string | null>(null);
  const p = detail.project;
  if (!p || !p.environments || p.environments.length === 0)
    return <EmptyState text={t('noEnvironments')} />;

  const activeEnv = p.environments.find((e) => e.id === activeEnvId) ?? null;

  return (
    <Card
      title={t('environments')}
      extra={<span className="text-xs text-muted-foreground">{t('environmentPanelDescription')}</span>}
    >
      <div className="space-y-2">
        {p.environments.map((env) => (
          <EnvironmentRow
            key={env.id}
            env={env}
            t={t}
            onClick={() => setActiveEnvId(env.id)}
          />
        ))}
      </div>
      <EnvironmentDetailDrawer
        environment={activeEnv}
        project={p}
        deploymentRuns={detail.deploymentRuns}
        onClose={() => setActiveEnvId(null)}
      />
    </Card>
  );
}

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

function EnvironmentRow({
  env,
  t,
  onClick,
}: {
  env: ProjectEnvironment;
  t: ProjectsTranslator;
  onClick: () => void;
}) {
  const statusKey = getEnvStatusLabelKey(env.status);
  const counts = env._count;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
      aria-label={t('envRowOpenHint', { name: env.name })}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-2">
        <span className="font-medium">{env.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{env.key}</span>
        {counts ? (
          <span className="text-xs text-muted-foreground">
            {t('envCountSummaryV2', {
              servers: counts.serverBindings ?? 0,
              instances: counts.resourceInstances ?? 0,
              sites: counts.sites ?? 0,
              runs: counts.deploymentRuns ?? 0,
            })}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusTag
          status={env.status}
          label={statusKey ? t(statusKey) : t('envStatusUnknown')}
        />
        <span className="text-muted-foreground" aria-hidden>
          ›
        </span>
      </div>
    </button>
  );
}
