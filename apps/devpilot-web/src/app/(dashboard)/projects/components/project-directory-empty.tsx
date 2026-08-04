import React from 'react';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { Button, LinkButton } from '@/components/ui';

export function ProjectDirectoryEmpty({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  const t = useTranslations('projects');
  if (filtered) {
    return (
      <EmptyState
        text={t('noSearchResults')}
        description={t('noSearchResultsDescription')}
        action={<Button onClick={onReset}>{t('resetFilters')}</Button>}
      />
    );
  }
  return (
    <EmptyState
      text={t('noProjects')}
      description={t('noProjectsDescriptionV13')}
      action={
        <div className="flex flex-wrap justify-center gap-2">
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
  );
}
