'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDeliverySummary } from '../types/project-delivery-summary.types';
import { releaseEnvironmentLabelKey } from '../utils/release-copy.model';
import { ProjectContextIssue } from './project-context-issue';
import { projectDeliveryActionLabelKey } from './project-delivery-issue.model';
import { projectDeliveryReasonKey } from './project-delivery-reason-copy';

export function ProjectDeliveryIssue({ summary }: { summary: ProjectDeliverySummary | null }) {
  const t = useTranslations('projects');
  const checkpoint = summary?.checkpoints.find(
    (item) =>
      item.status !== 'ready' &&
      item.scope !== 'production' &&
      BASIC_DELIVERY_CHECKPOINTS.has(item.id),
  );
  if (!checkpoint?.action || checkpoint.action.kind === 'open_release') return null;
  const scope =
    checkpoint.scope === 'project'
      ? t('projectDeliveryProjectScope')
      : t(releaseEnvironmentLabelKey(checkpoint.scope));
  const reasonKey = projectDeliveryReasonKey(checkpoint.reasonCodes[0]);
  const reason = reasonKey ? t(reasonKey as never) : t('projectDeliveryActionRequiredGeneric');
  return (
    <ProjectContextIssue
      message={t('projectDeliveryIssueMessage', {
        scope,
        reason,
        checkpoint: t(`projectDeliveryCheckpoint_${checkpoint.id}` as never),
      })}
      actionLabel={(t as unknown as (key: string, values?: Record<string, string>) => string)(
        projectDeliveryActionLabelKey(checkpoint),
        { scope },
      )}
      href={checkpoint.action.href}
    />
  );
}

const BASIC_DELIVERY_CHECKPOINTS = new Set<ProjectDeliverySummary['checkpoints'][number]['id']>([
  'intake',
  'services',
  'targets',
]);
