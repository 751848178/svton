'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { buildDeploymentRunHref } from '../utils/release-run-deep-links.utils';

export function ReleaseDeploymentEvidenceLink(props: { projectId: string; runId: string }) {
  const t = useTranslations('projects');
  return (
    /* 复核修 9：跨页导航用链接形态，不再是描边按钮。 */
    <Link
      href={buildDeploymentRunHref(props.projectId, props.runId)}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      {t('viewDeploymentRecords')}
    </Link>
  );
}
