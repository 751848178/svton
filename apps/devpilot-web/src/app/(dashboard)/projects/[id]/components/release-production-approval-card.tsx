'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, LinkButton, StatusTag } from '@/components/ui';
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

interface Props {
  projectId: string;
  run: ReleaseEvidenceProductionRun;
  onChanged: () => Promise<unknown>;
  recoveryHref: string;
}

/**
 * 项目发布上下文审批卡片。
 *
 * 单一职责：在 Production 步骤展示当前 ReleaseRun 的审批，并就地完成
 * 批准 / 拒绝（必填理由）/ 批准后执行生产发布，无需跳到全局模块再返回。
 * 拒绝/失败提供指向环境版本恢复的本地化补救入口（AC-PROD-035）。
 */
export function ReleaseProductionApprovalCard({ projectId, run, onChanged, recoveryHref }: Props) {
  const t = useTranslations('projects');
  const approval = run.operationApproval;
  const isRecovery = run.mode === 'recovery';
  const { acting, error, review, execute } = useProductionApproval(projectId, run, onChanged);
  const [rejectOpen, setRejectOpen] = useState(false);

  const reviewed = approval.status === 'approved' || approval.status === 'rejected';
  const expired = Boolean(
    approval.expiresAt && new Date(approval.expiresAt).getTime() < Date.now(),
  );
  const canExecute = approval.status === 'approved' && !approval.consumedAt && !expired;
  const errorKey = error ? releaseProductionErrorLabelKey(error) : null;
  const needsRecovery = approval.status === 'rejected' || run.status === 'failed';

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
        <ApprovalRow
          label={t('releaseProductionRun')}
          value={run.id}
        />
        <ApprovalRow
          label={t('releaseProductionBuild')}
          value={`#${run.manifest.buildRun.revision} · ${run.manifest.buildRun.sourceBranch} · ${run.manifest.buildRun.sourceCommitSha}`}
        />
        <ApprovalRow
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
        {needsRecovery ? (
          <LinkButton
            data-primary="true"
            href={recoveryHref}
            variant="outline"
            size="sm"
          >
            {t('releaseProductionRecoveryLink')}
          </LinkButton>
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

function ApprovalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 rounded bg-muted/40 p-2">
      <dt className="font-medium">{label}</dt>
      <dd className="break-all font-mono text-xs text-muted-foreground">{value}</dd>
    </div>
  );
}
