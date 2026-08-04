import React, { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDirectoryItem } from '../types';
import { ProjectCard } from './project-card';

export function ProjectDirectoryPanel({
  items,
  validating,
  empty,
}: {
  items: ProjectDirectoryItem[];
  validating: boolean;
  empty?: ReactNode;
}) {
  const t = useTranslations('projects');
  return (
    <div aria-busy={validating}>
      <div
        className="hidden grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(11rem,.8fr)] gap-4 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:grid"
        aria-hidden="true"
      >
        <span>{t('directoryProject')}</span>
        <span>{t('directoryType')}</span>
        <span>{t('directoryBaselines')}</span>
        <span>Production</span>
        <span>{t('directoryRecentActivity')}</span>
      </div>
      <div className="divide-y">
        {items.length > 0
          ? items.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
              />
            ))
          : empty && <div className="px-4 py-10">{empty}</div>}
      </div>
    </div>
  );
}
