'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LoadingState } from '@svton/ui';
import { ErrorBanner, PageHeader } from '@/components/ui';
import { useProjects } from '../hooks/use-projects';
import type { ProjectDirectoryResponse } from '../types';
import { DirectorySummary } from './directory-summary';
import { DirectoryToolbar } from './directory-toolbar';
import { ProjectDirectoryEmpty } from './project-directory-empty';
import { ProjectDirectoryPanel } from './project-directory-panel';

interface ProjectsContentProps {
  initialDirectory?: ProjectDirectoryResponse;
  loadFailed?: boolean;
}

export function ProjectsContent({ initialDirectory, loadFailed = false }: ProjectsContentProps) {
  const t = useTranslations('projects');
  const tc = useTranslations('common');
  const directory = useProjects(initialDirectory);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescriptionV13')}
      />
      <DirectorySummary summary={directory.summary} />
      <section
        className="overflow-hidden rounded-xl border bg-card"
        aria-label={t('directoryList')}
      >
        <DirectoryToolbar
          search={directory.search}
          status={directory.statusFilter}
          total={directory.total}
          onSearch={directory.setSearch}
          onStatus={directory.setStatusFilter}
        />
        {loadFailed || directory.error ? (
          <div className="p-4">
            <ErrorBanner
              message={t('loadFailed')}
              onRetry={directory.refresh}
              retryLabel={tc('retry')}
            />
          </div>
        ) : directory.loading ? (
          <div className="p-8">
            <LoadingState text={tc('loading')} />
          </div>
        ) : (
          <ProjectDirectoryPanel
            items={directory.items}
            validating={directory.validating}
            empty={
              <ProjectDirectoryEmpty
                filtered={directory.filtered}
                onReset={directory.resetFilters}
              />
            }
          />
        )}
      </section>
    </div>
  );
}
