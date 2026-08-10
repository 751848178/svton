'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LinkButton } from '@/components/ui';
import { buildDeploymentRunHref } from '../utils/release-run-deep-links.utils';

export function ReleaseDeploymentEvidenceLink(props: { projectId: string; runId: string }) {
  const t = useTranslations('projects');
  return (
    <LinkButton
      href={buildDeploymentRunHref(props.projectId, props.runId)}
      variant="outline"
      size="sm"
    >
      {t('viewDeploymentRecords')}
    </LinkButton>
  );
}
