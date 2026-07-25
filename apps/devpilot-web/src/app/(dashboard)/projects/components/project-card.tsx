'use client';

/**
 * 项目卡片
 *
 * 单一职责：渲染单张项目卡。整卡是 <Link>（保留可点导航）。
 * 在原有 name/来源/管理范围/标签/创建时间之上增强：
 *   - 顶部最近部署状态点（StatusTag）+ 相对时间
 *   - 底部环境/应用计数 Tag
 *   - 右上角三点菜单（部署/设置，trigger 阻止冒泡避免触发卡片导航）
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag } from '@svton/ui';
import { ActionMenu, StatusTag } from '@/components/ui';
import { formatDate, formatRelative } from '@/lib/format-date';
import {
  getProjectDescription,
  getProjectManagementScopeLabel,
  getProjectOriginLabel,
  getProjectRepository,
  getProjectStackTags,
  getProjectSubProjectLabels,
} from '@/lib/project-display';
import {
  buildProjectActionGroups,
  countApplications,
  countEnvironments,
  getLatestRunStatusValue,
} from '../utils/project-card-fields';
import type { Project, ProjectDeploymentRun } from '../types';

/** 项目卡最近部署 health 值 → projects 命名空间 i18n key。 */
const STATUS_VALUE_LABEL_KEY: Record<string, string> = {
  neutral: 'latestDeployNone',
  deploying: 'healthDeploying',
  failed: 'healthDegraded',
  healthy: 'healthHealthy',
};

interface ProjectCardProps {
  project: Project;
  latestRun?: ProjectDeploymentRun;
  hasGitRepoLabel: string;
}

/** 把相对时间分桶翻译成本地化文案（zh/en 同构）。返回 null 表示无最近部署。 */
function formatRelativeLabel(
  t: ReturnType<typeof useTranslations>,
  startedAt?: string | null,
): string {
  const bucket = formatRelative(startedAt);
  if (!bucket) return t('latestDeployNone');
  switch (bucket.key) {
    case 'justNow':
      return t('relativeJustNow');
    case 'minutes':
      return t('relativeMinutesAgo', { count: bucket.value });
    case 'hours':
      return t('relativeHoursAgo', { count: bucket.value });
    case 'days':
      return t('relativeDaysAgo', { count: bucket.value });
    case 'date':
      return bucket.value;
    default:
      return t('latestDeployNone');
  }
}

export function ProjectCard({ project, latestRun, hasGitRepoLabel }: ProjectCardProps) {
  const t = useTranslations('projects');
  const router = useRouter();

  const description = getProjectDescription(project.config, project.description);
  const tags = [
    ...getProjectSubProjectLabels(project.config),
    ...getProjectStackTags(project.config),
  ];
  const repository = getProjectRepository(project.config, project.gitRepo);

  const envCount = countEnvironments(project);
  const appCount = countApplications(project);
  const statusValue = getLatestRunStatusValue(latestRun ?? null);
  const relativeText = formatRelativeLabel(t, latestRun?.startedAt);

  const handleAction = (action: 'deploy' | 'settings') => {
    router.push(`/projects/${project.id}`);
    void action;
  };
  const actionGroups = buildProjectActionGroups({
    deployLabel: t('actionDeploy'),
    settingsLabel: t('actionSettings'),
    onSelect: handleAction,
  });

  // 整卡是 <Link>，菜单 trigger 必须吞掉点击事件，否则会触发导航。
  const stopCardNavigation = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <Link
      href={`/projects/${project.id}`}
      className="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold">{project.name}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusTag
              status={statusValue}
              label={t(STATUS_VALUE_LABEL_KEY[statusValue] || 'latestDeployNone')}
            />
            <span className="text-xs text-muted-foreground">{relativeText}</span>
          </div>
        </div>
        <div onClick={stopCardNavigation} className="shrink-0">
          <ActionMenu groups={actionGroups} triggerLabel={t('moreActions')} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Tag color="default">{getProjectOriginLabel(project.config)}</Tag>
        <Tag color="cyan">{getProjectManagementScopeLabel(project.config)}</Tag>
      </div>

      {description ? (
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{description}</p>
      ) : null}

      {tags.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag
              key={tag}
              color="default"
            >
              {tag}
            </Tag>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Tag color="default">{t('envAppSummary', { envs: envCount, apps: appCount })}</Tag>
        <span className="ml-auto">{formatDate(project.createdAt)}</span>
        {repository ? <span className="text-primary">{hasGitRepoLabel}</span> : null}
      </div>
    </Link>
  );
}
