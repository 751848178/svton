'use client';

import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState } from '@svton/ui';
import { ErrorBanner, Input, LinkButton, PageHeader, Select } from '@/components/ui';
import { useProjects } from '../hooks/use-projects';
import type {
  ProjectConfigurationFilter,
  ProjectDirectoryResponse,
  ProjectRuntimeFilter,
} from '../types';
import { ProjectCard } from './project-card';

interface ProjectsContentProps {
  initialDirectory?: ProjectDirectoryResponse;
  loadFailed?: boolean;
}

export function ProjectsContent({ initialDirectory, loadFailed = false }: ProjectsContentProps) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const directory = useProjects(initialDirectory);
  const filtered =
    directory.search ||
    directory.runtimeFilter !== 'all' ||
    directory.configurationFilter !== 'all';

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescriptionV13')}
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton
              href="/projects/new"
              variant="outline"
            >
              {t('generateProject')}
            </LinkButton>
            <LinkButton
              href="/projects/create"
              variant="primary"
            >
              {t('connectExistingProject')}
            </LinkButton>
          </div>
        }
      />

      <DirectorySummary summary={directory.summary} />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4">
        <div className="min-w-[16rem] flex-1">
          <Input
            type="search"
            value={directory.search}
            onChange={(event) => directory.setSearch(event.target.value)}
            placeholder={t('directorySearchPlaceholder')}
            aria-label={t('directorySearchPlaceholder')}
          />
        </div>
        <div className="w-44">
          <Select
            value={directory.runtimeFilter}
            onChange={(event) =>
              directory.setRuntimeFilter(event.target.value as ProjectRuntimeFilter)
            }
            options={runtimeOptions(t)}
            aria-label={t('runtimeFilter')}
          />
        </div>
        <div className="w-52">
          <Select
            value={directory.configurationFilter}
            onChange={(event) =>
              directory.setConfigurationFilter(event.target.value as ProjectConfigurationFilter)
            }
            options={configurationOptions(t)}
            aria-label={t('configurationFilter')}
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {t('directoryResultCount', { count: directory.total })}
        </span>
      </div>

      {loadFailed || directory.error ? (
        <ErrorBanner
          message={t('loadFailed')}
          onRetry={directory.refresh}
          retryLabel={tc('retry')}
        />
      ) : directory.loading ? (
        <LoadingState text={tc('loading')} />
      ) : directory.items.length === 0 ? (
        <EmptyState
          text={filtered ? t('noSearchResults') : t('noProjects')}
          description={filtered ? undefined : t('noProjectsDescriptionV13')}
          action={
            filtered ? undefined : (
              <LinkButton
                href="/projects/create"
                variant="primary"
              >
                {t('connectExistingProject')}
              </LinkButton>
            )
          }
        />
      ) : (
        <section
          className="space-y-3"
          aria-busy={directory.validating}
        >
          {directory.items.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function DirectorySummary({ summary }: { summary?: ProjectDirectoryResponse['summary'] }) {
  const t = useTranslations('projects');
  const values = [
    [t('directoryTotal'), summary?.total ?? 0],
    [t('directoryOnline'), summary?.online ?? 0],
    [t('directoryNeedsConfiguration'), summary?.needsConfiguration ?? 0],
  ];
  return (
    <section
      className="grid gap-3 sm:grid-cols-3"
      aria-label={t('directorySummary')}
    >
      {values.map(([label, value]) => (
        <article
          key={String(label)}
          className="rounded-lg border bg-card p-4"
        >
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </article>
      ))}
    </section>
  );
}

function runtimeOptions(t: ReturnType<typeof useTranslations>) {
  return [
    { label: t('filterAllRuntime'), value: 'all' },
    { label: t('runtimeRunning'), value: 'running' },
    { label: t('runtimeIdle'), value: 'idle' },
    { label: t('runtimeFailed'), value: 'failed' },
  ];
}

function configurationOptions(t: ReturnType<typeof useTranslations>) {
  return [
    { label: t('filterAllConfiguration'), value: 'all' },
    { label: t('configurationReady'), value: 'ready' },
    { label: t('configurationNeedsConfiguration'), value: 'needs_configuration' },
    { label: t('configurationInProgress'), value: 'in_progress' },
    { label: t('configurationDraft'), value: 'draft' },
  ];
}
