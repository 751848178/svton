'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';

export function ProjectDeliveryHeader({
  summary,
}: {
  summary: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const projectId = summary.project.id;
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
      <div className="w-full min-w-0 sm:flex-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11"
            aria-label={t('backToProjects')}
            onClick={() => router.push('/projects')}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <h1 className="min-w-0 break-words text-2xl font-bold">{summary.project.name}</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-11 text-xs text-muted-foreground">
          {summary.repository ? (
            <>
              <span className="min-w-0 break-all font-mono">{summary.repository.canonicalUrl}</span>
              <span aria-hidden="true">·</span>
              <span>
                {t('projectDeliveryDefaultBranch', { branch: summary.repository.defaultBranch })}
              </span>
            </>
          ) : (
            <span>{t('projectDeliveryRepositoryUnknown')}</span>
          )}
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        {summary.entries.productionDomain ? (
          <LinkButton
            className="min-h-11"
            href={`https://${summary.entries.productionDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            {t('projectDeliveryProductionSite')}
          </LinkButton>
        ) : null}
        <LinkButton
          className="min-h-11"
          href={`/projects/${encodeURIComponent(projectId)}/settings`}
          variant="outline"
        >
          {t('manageProject')}
        </LinkButton>
      </div>
    </header>
  );
}
