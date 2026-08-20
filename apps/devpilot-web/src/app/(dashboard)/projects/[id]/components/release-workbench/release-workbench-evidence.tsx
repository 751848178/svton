'use client';

import { CloudArrowUp, Cube, RocketLaunch, ShieldCheck } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { ReleaseOrderEvidenceHook } from '../../hooks/use-release-order-evidence';
import type { ReleaseGateCatalog } from '../../types/release-gate.types';
import type { ReleaseOrderStep } from '../../types/release-order.types';
import { releaseExecutionStatusLabelKey } from '../../utils/release-copy.model';
import type { ReleaseWorkbenchActivity } from './release-workbench-activity.model';

export function ReleaseWorkbenchEvidence(props: {
  evidence: ReleaseOrderEvidenceHook;
  catalog: ReleaseGateCatalog | null;
  activities: ReleaseWorkbenchActivity[];
  onOpen: (activity: ReleaseWorkbenchActivity) => void;
  onSelectStep: (step: ReleaseOrderStep) => void;
}) {
  const t = useTranslations('projects');
  const evidence = props.evidence.evidence;
  if (props.evidence.loading && !evidence) {
    return (
      <p id="release-workbench-evidence" role="status" className="px-4 py-5 text-sm text-muted-foreground">
        {t('releaseWorkbenchActivityLoading')}
      </p>
    );
  }
  if (props.evidence.error && !evidence) {
    return (
      <p id="release-workbench-evidence" role="alert" className="px-4 py-5 text-sm text-destructive">
        {t('releaseWorkbenchEvidenceUnavailable')}
      </p>
    );
  }

  const build = latestActivity(props.activities, 'build');
  const staging = latestActivity(props.activities, 'staging');
  const production = latestActivity(props.activities, 'production');
  const cards: EvidenceRow[] = [
    {
      step: 'preflight',
      icon: <ShieldCheck size={18} aria-hidden="true" />,
      title: t('releaseWorkbenchEvidenceGate'),
      value: props.catalog
        ? t('releaseWorkbenchEvidenceGateValue', {
            total: props.catalog.summary.total,
            blocked: props.catalog.summary.statusCounts.blocked,
            unavailable: props.catalog.summary.statusCounts.unavailable,
          })
        : t('releaseWorkbenchEvidenceUnavailable'),
    },
    runRow('build', <Cube size={18} aria-hidden="true" />, build, t),
    runRow('staging', <CloudArrowUp size={18} aria-hidden="true" />, staging, t),
    runRow('production', <RocketLaunch size={18} aria-hidden="true" />, production, t),
  ];
  return (
    <div
      id="release-workbench-evidence"
      role="tabpanel"
      aria-labelledby="release-workbench-evidence-tab"
      className="divide-y divide-border px-4"
    >
      {cards.map((card) => (
        <button
          key={card.step}
          type="button"
          className="flex min-h-11 w-full items-start gap-3 py-4 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          onClick={() =>
            card.activity ? props.onOpen(card.activity) : props.onSelectStep(card.step)
          }
        >
          <span className="mt-0.5 text-muted-foreground">{card.icon}</span>
          <span className="min-w-0">
            <strong className="block text-sm font-medium">{card.title}</strong>
            <span className="mt-1 block truncate text-xs text-muted-foreground" title={card.value}>
              {card.value}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

interface EvidenceRow {
  step: ReleaseOrderStep;
  icon: React.ReactNode;
  title: string;
  value: string;
  activity?: ReleaseWorkbenchActivity;
}

function runRow(
  step: Exclude<ReleaseOrderStep, 'preflight'>,
  icon: React.ReactNode,
  activity: ReleaseWorkbenchActivity | undefined,
  t: ReturnType<typeof useTranslations<'projects'>>,
): EvidenceRow {
  return {
    step,
    icon,
    title: t(`releaseWorkbenchEvidenceLatest.${step}`),
    value: activity
      ? t('releaseWorkbenchLatestEvidenceRun', {
          id: shortId(runId(activity)),
          status: t(releaseExecutionStatusLabelKey(activity.status)),
        })
      : t('releaseWorkbenchNoRunYet'),
    activity,
  };
}

function latestActivity(activities: ReleaseWorkbenchActivity[], step: ReleaseOrderStep) {
  return activities.find(
    (activity) =>
      activity.step === step &&
      (step !== 'production' || activity.kind === 'production'),
  );
}

function runId(activity: ReleaseWorkbenchActivity) {
  return activity.buildRunId || activity.releaseRunId || activity.deploymentRunId || activity.id;
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 10)}…` : value;
}
