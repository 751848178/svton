/**
 * 环境详情抽屉 - 派生信息区块（配置画像 + 最近部署）
 *
 * 单一职责：渲染 buildEnvironmentConfigProfiles 派生的服务/资源/部署画像，
 * 以及该环境最近一次部署运行。与抽屉主体的「环境直有字段」（服务器/计数）分离。
 */
'use client';

import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import { formatDateTimeMinute } from '@/lib/format-date';
import { getRunStatusLabelKey } from '../utils/run-labels';
import type { DeploymentRun } from '../types/operations';
import type { EnvironmentConfigProfile } from '../types/environment-sync';

type ProjectsTranslator = ReturnType<typeof useTranslations<'projects'>>;

export function ConfigProfile({
  profile,
  t,
}: {
  profile: EnvironmentConfigProfile;
  t: ProjectsTranslator;
}) {
  const { deployConfigCoverage: coverage, differences, isReference } = profile;
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailProfile')}
        {isReference ? (
          <span className="ml-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
            {t('envDetailReference')}
          </span>
        ) : null}
      </h4>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{t('envDetailServices', { count: coverage.total })}</span>
        <span>{t('envDetailDeployCmd', { count: coverage.deployCommand })}</span>
        <span>{t('envDetailSites', { count: profile.siteCount })}</span>
        <span>{t('envDetailTls', { count: profile.tlsSiteCount })}</span>
        <span>{t('envDetailSuccess', { count: profile.successfulDeployments })}</span>
      </div>
      {differences.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-amber-600 dark:text-amber-400">
          {differences.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function LastDeployment({
  run,
  t,
}: {
  run: DeploymentRun | null;
  t: ProjectsTranslator;
}) {
  if (!run) {
    return (
      <p className="text-xs text-muted-foreground">{t('envDetailNoDeployment')}</p>
    );
  }
  const statusKey = getRunStatusLabelKey(run.status);
  return (
    <section className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('envDetailLastDeployment')}
      </h4>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusTag status={run.status} label={statusKey ? t(statusKey) : run.status} />
        {run.branch ? (
          <span className="font-mono text-xs text-muted-foreground">{run.branch}</span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {formatDateTimeMinute(run.startedAt)}
        </span>
      </div>
    </section>
  );
}
