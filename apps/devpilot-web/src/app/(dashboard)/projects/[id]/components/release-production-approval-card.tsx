'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
import type { ReleaseEvidenceProductionRun } from '../types/release-order-evidence.types';
import {
  releaseApprovalStatusLabelKey,
  releaseProductionErrorLabelKey,
  releaseRiskLabelKey,
} from '../utils/release-copy.model';
import { formatIso } from '../utils/release-time.utils';
import { releaseApprovalStateTone, releaseRunStateTone } from '../utils/release-order.utils';
import { useProductionApproval } from '../hooks/use-production-approval';
import { RejectReasonModal } from '../../../operation-approvals/components/reject-reason-modal';
import { ReleaseProductionApprovalRow } from './release-production-approval-row';

interface Props {
  projectId: string;
  run: ReleaseEvidenceProductionRun;
  onChanged: () => Promise<unknown>;
}

/** Production 审批卡：就地审阅、执行，拒绝或失败时引导版本恢复。 */
export function ReleaseProductionApprovalCard({ projectId, run, onChanged }: Props) {
  const t = useTranslations('projects');
  const approval = run.operationApproval;
  const isRecovery = run.mode === 'recovery';
  const { acting, error, review, execute } = useProductionApproval(projectId, run, onChanged);
  const [rejectOpen, setRejectOpen] = useState(false);

  const reviewed = approval.status === 'approved' || approval.status === 'rejected';
  const expired = Boolean(
    approval.expiresAt && new Date(approval.expiresAt).getTime() < Date.now(),
  );
  const canExecute =
    run.status === 'awaiting_approval' &&
    approval.status === 'approved' &&
    !approval.consumedAt &&
    !expired;
  const errorKey = error ? releaseProductionErrorLabelKey(error) : null;

  return (
    <section
      className="space-y-3 rounded-lg border p-4"
      aria-label={t(
        isRecovery ? 'releaseProductionRecoveryCardTitle' : 'releaseProductionApprovalCardTitle',
      )}
      data-approval-id={approval.id}
      data-run-mode={run.mode}
      data-state={approval.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-medium">
          {t(
            isRecovery
              ? 'releaseProductionRecoveryCardTitle'
              : 'releaseProductionApprovalCardTitle',
          )}
        </h4>
        {isRecovery ? (
          <StatusTag
            status="default"
            label={t('environmentVersionKindRecovery')}
          />
        ) : null}
        <StatusTag
          status={releaseApprovalStateTone(approval.status)}
          label={t(releaseApprovalStatusLabelKey(approval.status))}
        />
        {run.status === 'failed' || run.status === 'blocked' ? (
          <StatusTag
            status={releaseRunStateTone(run.status)}
            label={t('releaseProductionRunFailed')}
          />
        ) : null}
        <StatusTag
          status="risk"
          variant="risk"
          label={t(releaseRiskLabelKey(approval.risk))}
        />
      </div>

      {approval.summary ? (
        <p className="rounded-md bg-muted/40 p-2 text-sm font-medium">{approval.summary}</p>
      ) : null}
      <dl className="grid gap-2 text-sm">
        <ReleaseProductionApprovalRow
          label={t('releaseProductionRun')}
          value={run.id}
        />
        <ReleaseProductionApprovalRow
          label={t('releaseProductionBuild')}
          value={`#${run.manifest.buildRun.revision} · ${run.manifest.buildRun.sourceBranch} · ${run.manifest.buildRun.sourceCommitSha}`}
        />
        <ReleaseProductionApprovalRow
          label={t('releaseProductionReuseArtifact')}
          value={run.manifest.digest}
        />
      </dl>

      {reviewed ? (
        <div className="space-y-1 text-sm text-muted-foreground">
          {approval.reviewer ? (
            <p>
              {t('releaseProductionApprovalReviewer', {
                name: approval.reviewer.name || approval.reviewer.email,
              })}
            </p>
          ) : null}
          {approval.reviewedAt ? (
            <p>
              {t('releaseProductionApprovalReviewedAt', {
                date: formatIso(approval.reviewedAt),
              })}
            </p>
          ) : null}
          {approval.reviewComment ? (
            <p className="rounded bg-muted/30 p-2">
              {t('releaseProductionApprovalComment', { comment: approval.reviewComment })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('releaseProductionApprovalWaiting')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {approval.status === 'pending' ? (
          <>
            <Button
              data-primary="true"
              onClick={() => void review('approved')}
              loading={acting}
              disabled={acting}
            >
              {t('releaseProductionApprove')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(true)}
              disabled={acting}
            >
              {t('releaseProductionReject')}
            </Button>
          </>
        ) : null}
        {canExecute ? (
          <Button
            data-primary="true"
            onClick={() => void execute()}
            loading={acting}
            disabled={acting}
          >
            {t(isRecovery ? 'releaseProductionRecoveryExecute' : 'releaseProductionExecute')}
          </Button>
        ) : null}
        {approval.status === 'approved' && !approval.consumedAt && expired ? (
          <span className="text-xs text-amber-700">{t('releaseProductionApprovalExpired')}</span>
        ) : null}
      </div>

      {errorKey ? (
        <p
          className="text-sm text-destructive"
          role="alert"
        >
          {t(errorKey)}
        </p>
      ) : null}

      <RejectReasonModal
        open={rejectOpen}
        variant="rejected"
        onClose={() => setRejectOpen(false)}
        onConfirm={(comment) => {
          void review('rejected', comment);
          setRejectOpen(false);
        }}
        submitting={acting}
      />
    </section>
  );
}
