/**
 * 项目环境面板。
 *
 * 单一职责：渲染环境列表（名称 + 状态 + 已有的 _count 摘要：站点/托管资源/部署次数）。
 * 弱化展示内部 key（仅作 font-mono 灰色辅助），把焦点放在"环境里有多少资源"上。
 */
'use client';
import { useTranslations } from 'next-intl';
import { Card, EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { getEnvStatusLabelKey } from '../utils/run-labels';
import type { useProjectDetail } from '../hooks/use-project-detail';
import type { ProjectEnvironment } from '../types';
type DetailHook = ReturnType<typeof useProjectDetail>;

export function EnvironmentPanel({ detail }: { detail: DetailHook }) {
  const t = useTranslations('projects');
  const p = detail.project;
  if (!p || !p.environments || p.environments.length === 0)
    return <EmptyState text={t('noEnvironments')} />;
  return (
    <Card
      title={t('environments')}
      extra={<span className="text-xs text-muted-foreground">{t('environmentPanelDescription')}</span>}
    >
      <div className="space-y-2">
        {p.environments.map((env) => (
          <EnvironmentRow key={env.id} env={env} t={t} />
        ))}
      </div>
    </Card>
  );
}

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

function EnvironmentRow({ env, t }: { env: ProjectEnvironment; t: ProjectsTranslator }) {
  const statusKey = getEnvStatusLabelKey(env.status);
  const counts = env._count;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="font-medium">{env.name}</span>
        {/* 内部 key 仅作调试辅助，弱化展示，不作为主标签。 */}
        <span className="font-mono text-xs text-muted-foreground">{env.key}</span>
        {counts ? (
          <span className="text-xs text-muted-foreground">
            {t('envCountSummary', {
              sites: counts.sites ?? 0,
              resources: counts.managedResources ?? 0,
              runs: counts.deploymentRuns ?? 0,
            })}
          </span>
        ) : null}
      </div>
      <StatusTag
        status={env.status}
        label={statusKey ? t(statusKey) : t('envStatusUnknown')}
      />
    </div>
  );
}
