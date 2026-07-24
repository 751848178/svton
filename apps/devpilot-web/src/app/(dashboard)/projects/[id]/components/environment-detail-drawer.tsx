/**
 * 环境详情抽屉
 *
 * 单一职责：点击某条环境行后，以侧边抽屉展示该环境的丰富信息——
 *   基础信息、已绑服务器、资源计数（8 项 _count 全展）、最近部署、配置画像。
 *
 * 全部数据来自 useProjectDetail 返回的 Project + DeploymentRun[]（无新增请求）。
 * 使用 buildEnvironmentConfigProfiles 派生服务/资源/部署画像（复用既有纯函数）。
 *
 * 不新建路由（环境始终属于某项目，脱离项目上下文意义不大——见 research §2 #2）。
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Drawer } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import { getEnvStatusLabelKey } from '../utils/run-labels';
import { buildEnvironmentConfigProfiles } from '../utils/deployment-config';
import { ConfigProfile, LastDeployment } from './environment-detail-derived';
import { EnvironmentEnvVarsSection } from './environment-env-vars-section';
import type { DeploymentRun } from '../types/operations';
import type { Project, ProjectEnvironment } from '../types';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

interface EnvironmentDetailDrawerProps {
  environment: ProjectEnvironment | null;
  project: Project;
  deploymentRuns: DeploymentRun[];
  onClose: () => void;
  /** 普通变量保存成功后回调，供父级刷新项目数据（避免抽屉重开时丢失最新值）。 */
  onEnvironmentSaved?: () => void;
}

export function EnvironmentDetailDrawer({
  environment,
  project,
  deploymentRuns,
  onClose,
  onEnvironmentSaved,
}: EnvironmentDetailDrawerProps) {
  const t = useTranslations('projects');
  // 保留上一次非 null 的环境，使抽屉关闭时仍能播放退出动画（Drawer 内部按 open 控制过渡）。
  const [rendered, setRendered] = useState<ProjectEnvironment | null>(null);
  useEffect(() => {
    if (environment) setRendered(environment);
  }, [environment]);

  // 普通变量保存成功：先更新本地 rendered（立即反馈），再通知父级重载项目。
  const handleEnvSaved = (updated: ProjectEnvironment) => {
    setRendered((prev) => (prev && prev.id === updated.id ? updated : prev));
    onEnvironmentSaved?.();
  };

  const profile = useMemo(
    () =>
      rendered
        ? buildEnvironmentConfigProfiles(
            project,
            deploymentRuns,
            project.environments ?? [],
          ).find((p) => p.environment.id === rendered.id) ?? null
        : null,
    [rendered, project, deploymentRuns],
  );
  const lastRun = useMemo(() => {
    if (!rendered) return null;
    const runs = deploymentRuns.filter(
      (r) => r.projectEnvironment?.id === rendered.id || r.environment === rendered.key,
    );
    return runs[0] ?? null;
  }, [rendered, deploymentRuns]);

  if (!rendered) return null;
  return (
    <Drawer
      open={Boolean(environment)}
      onClose={onClose}
      title={t('envDetailTitle', { name: rendered.name })}
      width={460}
    >
      <div className="space-y-5">
        <EnvBasics environment={rendered} t={t} />
        <BoundServers environment={rendered} t={t} />
        <ResourceCounts environment={rendered} t={t} />
        <EnvironmentEnvVarsSection
          environment={rendered}
          project={project}
          onSaved={handleEnvSaved}
        />
        {profile ? <ConfigProfile profile={profile} t={t} /> : null}
        <LastDeployment run={lastRun} t={t} />
      </div>
    </Drawer>
  );
}

function EnvBasics({ environment, t }: { environment: ProjectEnvironment; t: ProjectsTranslator }) {
  const statusKey = getEnvStatusLabelKey(environment.status);
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{environment.key}</span>
        <StatusTag
          status={environment.status}
          label={statusKey ? t(statusKey) : t('envStatusUnknown')}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('envDetailSortOrder', { order: environment.sortOrder })}
      </p>
    </section>
  );
}

function BoundServers({ environment, t }: { environment: ProjectEnvironment; t: ProjectsTranslator }) {
  const servers = environment.serverBindings ?? [];
  if (servers.length === 0) {
    return <p className="text-xs text-muted-foreground">{t('envDetailNoServers')}</p>;
  }
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailServers')}
      </h4>
      <ul className="space-y-1 text-sm">
        {servers.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2">
            <span className="truncate">
              <span className="font-medium">{b.server.name}</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{b.server.host}</span>
            </span>
            {b.role ? (
              <span className="shrink-0 text-xs text-muted-foreground">{b.role}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ResourceCounts({
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
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailResourceCounts')}
      </h4>
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
    </section>
  );
}
