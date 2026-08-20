'use client';

import { ArrowRight, Hammer, LockKey, WarningCircle } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button, LinkButton, StatusTag } from '@/components/ui';
import type { ReleaseActionGate } from '../release-action-gate.model';
import { releaseOrderStepLabelKey } from '../release-order-stepper.model';
import type { ReleaseOrderStep } from '../../types/release-order.types';
import type { ReleaseWorkbenchGateSummary } from './release-workbench-summary.model';

interface Props {
  decisionStep: ReleaseOrderStep;
  executionStep: ReleaseOrderStep;
  selectedStep: ReleaseOrderStep;
  gate: ReleaseWorkbenchGateSummary;
  actionGate: ReleaseActionGate;
  building: boolean;
  buildFrozen: boolean;
  targetRepairHref?: string;
  onBuildLatest: () => void;
  onReviewGate: () => void;
  onReturnToExecution: () => void;
}

export function ReleaseWorkbenchDecisionCard(props: Props) {
  const t = useTranslations('projects');
  const blocked = props.gate.state === 'blocked' || props.gate.state === 'error';
  const canBuild =
    (props.decisionStep === 'preflight' || props.decisionStep === 'build') &&
    props.gate.state === 'ready' &&
    props.actionGate.allowed &&
    !props.buildFrozen;
  const role = blocked ? 'alert' : 'status';
  const viewingHistory = props.selectedStep !== props.executionStep;

  return (
    <section
      data-release-decision
      role={role}
      className="border-l-4 border-l-primary bg-muted/35 px-4 py-4 sm:px-5"
      aria-labelledby="release-decision-heading"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t('releaseWorkbenchDecisionFor', {
                step: t(releaseOrderStepLabelKey(props.decisionStep)),
              })}
            </p>
            <StatusTag
              status={decisionTone(props.gate.state)}
              label={t(`releaseWorkbenchGateState.${props.gate.state}`)}
            />
          </div>
          <h3
            id="release-decision-heading"
            className="mt-2 text-lg font-semibold"
          >
            {t(`releaseWorkbenchDecisionTitle.${props.gate.state}`)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {decisionMessage(t, props.gate)}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {t('releaseWorkbenchGateCounts', {
              blocked: props.gate.blockerCount,
              warning: props.gate.warningCount,
              manual: props.gate.manualCount,
            })}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[320px] lg:justify-end">
          {blocked ? (
            props.targetRepairHref ? (
              <LinkButton
                href={props.targetRepairHref}
                data-testid="primary-release-action"
              >
                {t('releaseWorkbenchOpenTargetSettings')}
                <ArrowRight size={16} aria-hidden="true" />
              </LinkButton>
            ) : (
              <Button
                onClick={props.onReviewGate}
                data-testid="primary-release-action"
              >
                <WarningCircle size={17} weight="bold" aria-hidden="true" />
                {t('releaseWorkbenchReviewGateDetails')}
              </Button>
            )
          ) : null}
          {canBuild ? (
            <Button
              loading={props.building}
              onClick={props.onBuildLatest}
              data-testid="primary-release-action"
            >
              <Hammer size={17} weight="bold" aria-hidden="true" />
              {t('buildLatestCode')}
            </Button>
          ) : null}
          {props.buildFrozen &&
          (props.decisionStep === 'preflight' || props.decisionStep === 'build') ? (
            <span className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
              <LockKey size={17} aria-hidden="true" />
              {t('releaseBuildFrozenReason')}
            </span>
          ) : null}
          {viewingHistory ? (
            <Button
              variant="outline"
              onClick={props.onReturnToExecution}
            >
              {t('releaseWorkbenchReturnToExecution')}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function decisionTone(state: ReleaseWorkbenchGateSummary['state']) {
  if (state === 'ready') return 'succeeded' as const;
  if (state === 'loading') return 'running' as const;
  return 'failed' as const;
}

function decisionMessage(
  t: ReturnType<typeof useTranslations<'projects'>>,
  gate: ReleaseWorkbenchGateSummary,
) {
  if ((gate.state === 'blocked' || gate.state === 'error') && gate.reason) {
    return t('releaseWorkbenchBlockedReason', { reason: gate.reason });
  }
  return t(`releaseWorkbenchGateMessage.${gate.state}`);
}
