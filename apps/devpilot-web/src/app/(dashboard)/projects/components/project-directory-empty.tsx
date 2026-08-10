import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, EmptyState, LinkButton } from '@/components/ui';

export function ProjectDirectoryEmpty({
  filtered,
  onReset,
}: {
  filtered: boolean;
  onReset: () => void;
}) {
  const t = useTranslations('projects');
  const tn = useTranslations('nav');
  if (filtered) {
    return (
      <EmptyState
        title={t('noSearchResults')}
        description={t('noSearchResultsDescription')}
        dashed={false}
        action={<Button onClick={onReset}>{t('resetFilters')}</Button>}
      />
    );
  }
  return (
    <EmptyState
      title={t('noProjects')}
      description={t('noProjectsDescriptionV13')}
      dashed={false}
      action={
        <LinkButton
          href="/projects/create"
          variant="primary"
        >
          {tn('createProject')}
        </LinkButton>
      }
    />
  );
}
