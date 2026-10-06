'use client';

import { useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import type { ReleaseEvidenceProductionRun } from '../../types/release-order-evidence.types';
import { releaseApprovalStatusLabelKey } from '../../utils/release-copy.model';
import { shortDigest, shortTechnicalId } from '../../utils/release-display.utils';
import { formatIso } from '../../utils/release-time.utils';
import { FlowStatusTag } from './release-flow-status-tag';
import {
  productionApprovalCheck,
  productionCheckStatusKey,
  productionCheckTone,
} from './release-production-check.model';

export function ReleaseProductionCheckGuards(props: {
  preview: ProductionReleasePreview;
  operationApproval: ReleaseEvidenceProductionRun['operationApproval'] | null;
}) {
  const t = useTranslations('projects');
  const approval = productionApprovalCheck(props.preview);
  const policy = props.preview.snapshot.releasePolicy;
  const concurrency = props.preview.preflight.concurrency;
  const frozen = props.preview.preflight.frozen;
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <GuardCard title={t('releaseProductionCheckApproval')}>
        <GuardStatus
          tone={approvalTone(props.operationApproval?.status, approval?.status)}
          label={
            props.operationApproval
              ? t(releaseApprovalStatusLabelKey(props.operationApproval.status))
              : approval?.deferredUntilApproval
                ? t('releaseProductionCheckApprovalDeferred')
                : approval
                  ? t(productionCheckStatusKey(approval.status))
                  : t('releaseStagingCheckStatus.unavailable')
          }
        />
        <Fact
          label={t('releaseProductionCheckApprovalPolicy')}
          value={
            policy.requireProductionApproval
              ? t('productionApprovalRequired')
              : t('productionApprovalNotRequired')
          }
        />
        <Fact
          label={t('releaseGateReasonLabel')}
          value={approval?.reason.zh || t('releaseProductionCheckApprovalNotCreated')}
        />
        <Fact
          label={t('releaseApprovalStatus')}
          value={
            props.operationApproval
              ? `${t(releaseApprovalStatusLabelKey(props.operationApproval.status))} · ${formatIso(props.operationApproval.requestedAt)}`
              : t('releaseProductionCheckApprovalNotCreated')
          }
        />
      </GuardCard>
      <GuardCard title={t('releaseProductionCheckConcurrency')}>
        <GuardStatus
          tone={!concurrency ? 'neutral' : concurrency.state === 'available' ? 'success' : 'danger'}
          label={
            concurrency
              ? t(`releaseProductionCheckConcurrencyState.${concurrency.state}`)
              : t('releaseStagingCheckStatus.unavailable')
          }
        />
        <Fact
          label={t('releaseProductionCheckConcurrencyLimit')}
          value={concurrency ? String(concurrency.limit) : '—'}
        />
        <Fact
          label={t('releaseGateCheckedAtLabel')}
          value={formatIso(concurrency?.checkedAt)}
        />
        {concurrency?.activeRun ? (
          <Fact
            label={t('releaseProductionCheckActiveRun')}
            value={`${concurrency.activeRun.releaseVersion} · ${shortTechnicalId(concurrency.activeRun.id)} · ${concurrency.activeRun.status}`}
            title={concurrency.activeRun.id}
          />
        ) : null}
      </GuardCard>
      <GuardCard title={t('releaseProductionCheckRevision')}>
        <GuardStatus
          tone={policy.synthetic ? 'warning' : 'success'}
          label={
            policy.synthetic
              ? t('releaseProductionCheckSyntheticPolicy')
              : t('releaseProductionCheckPersistedPolicy')
          }
        />
        <Fact
          label={t('releaseProductionCheckConfigHash')}
          value={shortDigest(props.preview.snapshot.config.snapshotHash)}
          title={props.preview.snapshot.config.snapshotHash}
          mono
        />
        <Fact
          label={t('releaseProductionCheckPolicyRevision')}
          value={
            policy.revisionId ? `R${policy.revision} · ${shortTechnicalId(policy.revisionId)}` : '—'
          }
          title={policy.revisionId || undefined}
          mono
        />
        <Fact
          label={t('releaseProductionCheckWorkload')}
          value={t('releaseProductionCheckWorkloadValue', {
            count: frozen.workloadServiceCount,
            health: frozen.workloadHealthConfigured
              ? t('releasePreflightReady')
              : t('notConfigured'),
          })}
        />
      </GuardCard>
    </div>
  );
}

function approvalTone(status?: string, gateStatus?: string) {
  if (status === 'approved' || status === 'consumed') return 'success';
  if (status === 'rejected' || status === 'canceled' || status === 'expired') return 'danger';
  if (status) return 'warning';
  return gateStatus ? productionCheckTone(gateStatus) : 'neutral';
}

function GuardCard(props: React.PropsWithChildren<{ title: string }>) {
  return (
    <section className="space-y-3 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{props.title}</h3>
      {props.children}
    </section>
  );
}

function GuardStatus(props: { tone: 'success' | 'danger' | 'warning' | 'neutral'; label: string }) {
  return (
    <FlowStatusTag
      status={props.tone}
      label={props.label}
    />
  );
}

function Fact(props: { label: string; value: string; title?: string; mono?: boolean }) {
  return (
    <div className="min-w-0 text-xs">
      <p className="text-muted-foreground">{props.label}</p>
      <p
        className={`mt-1 break-all ${props.mono ? 'font-mono' : ''}`}
        title={props.title}
      >
        {props.value}
      </p>
    </div>
  );
}
