'use client';

import { useTranslations } from 'next-intl';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { releaseApprovalStatusLabelKey } from '../../utils/release-copy.model';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleaseProductionRunApproval(props: {
  approval: ReleaseEvidenceProductionRun['operationApproval'];
}) {
  const t = useTranslations('projects');
  const approval = props.approval;
  return (
    <section
      className="border-t pt-4"
      aria-labelledby="release-production-approval-title"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h5
          id="release-production-approval-title"
          className="text-sm font-semibold"
        >
          {t('releaseProductionRunApprovalTitle')}
        </h5>
        <FlowStatusTag
          status={approval.status.toLowerCase()}
          label={t(releaseApprovalStatusLabelKey(approval.status))}
        />
      </div>
      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label={t('releaseProductionApprovalRequester')}
          value={person(approval.requester) || approval.requesterId || '—'}
        />
        <Fact
          label={t('releaseProductionApprovalRequestedAt')}
          value={formatIso(approval.requestedAt)}
        />
        <Fact
          label={t('releaseProductionApprovalReviewer')}
          value={person(approval.reviewer) || approval.reviewerId || '—'}
        />
        <Fact
          label={t('releaseProductionApprovalReviewedAt')}
          value={formatIso(approval.reviewedAt)}
        />
        <Fact
          label={t('releaseProductionApprovalConsumedAt')}
          value={formatIso(approval.consumedAt)}
        />
        <Fact
          label={t('releaseProductionApprovalExpiresAt')}
          value={formatIso(approval.expiresAt)}
        />
        <Fact
          label={t('releaseProductionApprovalRisk')}
          value={approval.risk || '—'}
        />
        <Fact
          label={t('releaseProductionApprovalComment')}
          value={approval.reviewComment || approval.summary || '—'}
        />
      </dl>
      {approval.status === 'pending' ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('releaseProductionApprovalReadOnly')}
        </p>
      ) : null}
    </section>
  );
}

function person(value: { name: string | null; email: string } | null) {
  return value ? value.name || value.email : '';
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all">{value}</dd>
    </div>
  );
}
