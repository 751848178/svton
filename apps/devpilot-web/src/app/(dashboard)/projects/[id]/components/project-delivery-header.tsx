'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button, LinkButton } from '@/components/ui';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';

export function ProjectDeliveryHeader({
  summary,
  showCreate,
  onCreate,
}: {
  summary: ProjectDeliverySummary;
  showCreate: boolean;
  onCreate: () => void;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const projectId = summary.project.id;
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('backToProjects')}
            onClick={() => router.push('/projects')}
          >
            <span aria-hidden="true">←</span>
          </Button>
          <h1 className="text-2xl font-bold">{summary.project.name}</h1>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-11 text-xs text-muted-foreground">
          {summary.repository ? (
            <>
              <span className="break-all font-mono">{summary.repository.canonicalUrl}</span>
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
      <div className="flex flex-wrap items-center gap-2">
        {summary.entries.productionDomain ? (
          <LinkButton
            href={`https://${summary.entries.productionDomain}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
          >
            {t('projectDeliveryProductionSite')}
          </LinkButton>
        ) : null}
        <LinkButton
          href={`/projects/${encodeURIComponent(projectId)}/settings`}
          variant="outline"
        >
          {t('manageProject')}
        </LinkButton>
        {showCreate ? <Button onClick={onCreate}>{t('createReleaseOrder')}</Button> : null}
      </div>
    </header>
  );
}
