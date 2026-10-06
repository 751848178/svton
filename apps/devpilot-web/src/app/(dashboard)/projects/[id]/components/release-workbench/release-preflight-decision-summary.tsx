'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type { ReleaseGateDecision } from '../../types/release-gate.types';
import { formatIso } from '../../utils/release-time.utils';
import type { ReleaseActionGate } from '../release-action-gate.model';
import { FlowStatusTag } from './release-flow-status-tag';

export function ReleasePreflightDecisionSummary(props: {
  actionGate: ReleaseActionGate;
  decision: ReleaseGateDecision | null;
  loading: boolean;
  stageLabel: string;
  targetRepairHref: string | null;
  onRefresh: () => void;
}) {
  const t = useTranslations('projects');
  return (
    <>
      {props.targetRepairHref ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm"
        >
          <div>
            <strong>{t('releasePreflightTargetBlocked')}</strong>
            <p className="mt-1 text-xs text-muted-foreground">
              {props.actionGate.reason} · {t('releasePreflightTargetImpact')}
            </p>
          </div>
          <Link
            className="inline-flex min-h-11 items-center rounded-md border px-3 text-sm font-medium"
            href={props.targetRepairHref}
          >
            {t('releasePreflightConfigureTarget')}
          </Link>
        </div>
      ) : null}
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm">
        <div>
          <h4 className="font-semibold">
            {t('releasePreflightDecisionTitle', { stage: props.stageLabel })}
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {props.decision
              ? `${props.decision.checkpoint || props.decision.phase} · ${formatIso(props.decision.decidedAt)}`
              : t('releaseGateMetadataUnavailable')}
          </p>
          {props.decision?.integrityErrors.length ? (
            <p className="mt-2 text-xs text-destructive">
              {props.decision.integrityErrors.join(' · ')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FlowStatusTag
            status={props.decision?.allowed ? 'success' : 'danger'}
            label={t(
              props.decision?.allowed
                ? 'releasePreflightDecisionAllowed'
                : 'releasePreflightDecisionBlocked',
            )}
          />
          <span className="text-xs text-muted-foreground">
            {t('releaseWorkbenchStageGateCounts', {
              stage: props.stageLabel,
              blocked: props.decision?.blockerGateIds.length ?? 0,
              warning: props.decision?.warningGateIds.length ?? 0,
              manual: props.decision?.manualGateIds.length ?? 0,
            })}
          </span>
          <Button
            variant="outline"
            size="sm"
            loading={props.loading}
            onClick={props.onRefresh}
          >
            {t('releaseGateRefresh')}
          </Button>
        </div>
      </section>
    </>
  );
}
