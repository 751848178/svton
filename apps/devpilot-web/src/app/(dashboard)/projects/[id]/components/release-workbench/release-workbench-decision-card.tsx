'use client';

import { Info, WarningCircle } from '@phosphor-icons/react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderStep } from '../../types/release-order.types';
import { releaseOrderStepLabelKey } from '../release-order-stepper.model';
import { FlowStatusTag } from './release-flow-status-tag';
import type { ReleaseWorkbenchGateSummary } from './release-workbench-summary.model';

interface Props {
  decisionStep: ReleaseOrderStep;
  gate: ReleaseWorkbenchGateSummary;
  targetRepairHref?: string;
  onReviewGate: () => void;
}

export function ReleaseWorkbenchDecisionCard(props: Props) {
  const t = useTranslations('projects');
  const blocked = props.gate.state === 'blocked' || props.gate.state === 'error';
  const counts = t('releaseWorkbenchGateCounts', {
    blocked: props.gate.blockerCount,
    warning: props.gate.warningCount,
    manual: props.gate.manualCount,
  });
  return (
    <section
      data-release-decision
      role={blocked ? 'alert' : 'status'}
      aria-labelledby="release-decision-heading"
      className={`grid min-h-[76px] gap-3 rounded-xl border p-4 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center ${
        blocked ? 'border-destructive/35 bg-destructive/5' : 'border-border bg-muted/30'
      }`}
    >
      {blocked ? (
        <WarningCircle
          size={19}
          weight="fill"
          aria-hidden="true"
          className="text-destructive"
        />
      ) : (
        <Info
          size={19}
          weight="fill"
          aria-hidden="true"
          className="text-muted-foreground"
        />
      )}
      <div className="min-w-0">
        <div
          id="release-decision-heading"
          data-testid="release-decision-heading"
          className="flex flex-wrap items-center gap-2 font-semibold"
        >
          <span>
            {t('releaseWorkbenchDecisionFor', {
              step: t(releaseOrderStepLabelKey(props.decisionStep)),
            })}
          </span>
          <FlowStatusTag
            status={decisionTone(props.gate.state)}
            label={t(`releaseWorkbenchGateState.${props.gate.state}`)}
          />
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {props.gate.reason ? `${props.gate.reason} · ${counts}` : counts}
        </p>
      </div>
      {blocked ? (
        props.targetRepairHref ? (
          <DecisionLink
            href={props.targetRepairHref}
            label={t('releaseWorkbenchOpenTargetSettings')}
          />
        ) : (
          <DecisionButton
            label={t('releaseWorkbenchReviewGateDetails')}
            onClick={props.onReviewGate}
          />
        )
      ) : null}
    </section>
  );
}

const actionClass =
  'inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:min-h-9';

function DecisionLink(props: { href: string; label: string }) {
  return (
    <Link
      href={props.href}
      data-testid="primary-release-action"
      className={actionClass}
    >
      {props.label}
    </Link>
  );
}

function DecisionButton(props: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="primary-release-action"
      onClick={props.onClick}
      className={actionClass}
    >
      {props.label}
    </button>
  );
}

function decisionTone(state: ReleaseWorkbenchGateSummary['state']) {
  if (state === 'ready') return 'succeeded' as const;
  if (state === 'loading') return 'running' as const;
  return 'failed' as const;
}
