'use client';

/**
 * 项目列表客户端视图
 *
 * 单一职责：渲染列表页头部 + 检索条 + 卡片网格。
 * 接收首屏 server 数据（initialProjects/initialRuns）作为 SWR fallback，避免 client 二次请求。
 * 检索（搜索框 + 来源筛选）与最近部署聚合在 useProjects 内完成。
 */

import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, Input, LinkButton, PageHeader, Select } from '@/components/ui';
import { useProjects } from '../hooks/use-projects';
import { ProjectCard } from './project-card';
import type { Project, ProjectDeploymentRun, ProjectOriginFilter } from '../types';

interface ProjectsContentProps {
  initialProjects?: Project[];
  initialRuns?: ProjectDeploymentRun[];
  loadFailed?: boolean;
}

/** 来源筛选下拉选项（全部 + 三种 origin）。 */
function buildOriginOptions(
  tAll: string,
  labels: { generated: string; imported: string; external: string },
) {
  return [
    { label: tAll, value: 'all' as ProjectOriginFilter },
    { label: labels.generated, value: 'generated' as ProjectOriginFilter },
    { label: labels.imported, value: 'imported' as ProjectOriginFilter },
    { label: labels.external, value: 'external' as ProjectOriginFilter },
  ];
}

export function ProjectsContent({
  initialProjects,
  initialRuns,
  loadFailed = false,
}: ProjectsContentProps) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const {
    filtered,
    latestRunByProject,
    search,
    setSearch,
    originFilter,
    setOriginFilter,
    loading,
    error,
    refresh,
  } = useProjects(initialProjects, initialRuns);

  const originOptions = buildOriginOptions(t('filterAllOrigins'), {
    generated: t('originGenerated'),
    imported: t('originImported'),
    external: t('originExternal'),
  });

  const showError = loadFailed || Boolean(error);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href="/projects/import"
              variant="outline"
            >
              {t('importExisting')}
            </LinkButton>
            <LinkButton
              href="/projects/new"
              variant="primary"
            >
              {t('createNew')}
            </LinkButton>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[16rem] flex-1">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Select
            value={originFilter}
            onChange={(event) => setOriginFilter(event.target.value as ProjectOriginFilter)}
            options={originOptions}
            aria-label={t('filterOrigin')}
          />
        </div>
      </div>

      {showError ? (
        <ErrorBanner
          message={t('loadFailed')}
          onRetry={refresh}
          retryLabel={tc('retry')}
        />
      ) : loading ? (
        <LoadingState text={tc('loading')} />
      ) : filtered.length === 0 ? (
        search || originFilter !== 'all' ? (
          <EmptyState text={t('noSearchResults')} />
        ) : (
          <EmptyState
            text={t('noProjects')}
            description={t('noProjectsDescription')}
            action={
              <div className="flex gap-3">
                <LinkButton
                  href="/projects/import"
                  variant="outline"
                >
                  {t('importExisting')}
                </LinkButton>
                <LinkButton
                  href="/projects/new"
                  variant="primary"
                >
                  {t('createNew')}
                </LinkButton>
              </div>
            }
          />
        )
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              latestRun={latestRunByProject[project.id]}
              hasGitRepoLabel={t('hasGitRepo')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
