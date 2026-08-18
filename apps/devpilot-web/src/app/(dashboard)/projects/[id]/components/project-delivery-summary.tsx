'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui';
import type {
  ProjectDeliveryBaselineRole,
  ProjectDeliveryCheckpoint,
  ProjectDeliverySummary,
} from '../types/project-delivery-summary.types';
import { releaseEnvironmentLabelKey } from '../utils/release-copy.model';
import { projectDeliveryReasonKey } from './project-delivery-reason-copy';

export function ProjectDeliveryWeakSummary({
  summary,
  onOpenRelease,
}: {
  summary: ProjectDeliverySummary;
  onOpenRelease?: () => void;
}) {
  const t = useTranslations('projects');
  const pending = summary.checkpoints.filter((item) => item.status !== 'ready');
  const next = summary.nextAction;
  const current = next
    ? summary.checkpoints.find(
        (item) => item.action?.kind === next.kind && item.action.href === next.href,
      )
    : undefined;
  return (
    <section
      aria-label={t('projectDeliveryNow')}
      className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4 sm:p-5"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            {t('projectDeliveryNow')}
          </p>
          <h2 className="mt-1 text-lg font-semibold">
            {current ? checkpointLabel(current, t) : t('projectDeliveryAllReady')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {current
              ? t('projectDeliveryScopedReason', {
                  scope: scopeLabel(current.scope, t),
                  reason: reasonLabel(current.reasonCodes[0], t),
                })
              : t('projectDeliveryAllReadyDescription')}
          </p>
        </div>
        {next?.kind === 'open_release' && onOpenRelease ? (
          <Button
            className="min-h-11 shrink-0"
            onClick={onOpenRelease}
            data-current-action="open_release"
          >
            {t('createReleaseOrder')}
          </Button>
        ) : next ? (
          <Link
            href={next.href}
            data-current-action={next.kind}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t('projectDeliveryFixNow')}
          </Link>
        ) : null}
        <Link
          href={`/projects/${summary.project.id}/publish`}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('publishEntryLabel')}
        </Link>
      </div>
      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        {t('projectDeliveryEvidenceSummary', {
          ready: summary.checkpoints.length - pending.length,
          total: summary.checkpoints.length,
        })}
      </p>
    </section>
  );
}

export function ProjectDeliveryEnvironmentStrip({ summary }: { summary: ProjectDeliverySummary }) {
  const t = useTranslations('projects');
  return (
    <section aria-label={t('projectDeliveryCurrentVersions')} className="grid gap-3 lg:grid-cols-2">
      {(['staging', 'production'] as const).map((role) => (
        <EnvironmentTaskCard key={role} role={role} summary={summary} />
      ))}
    </section>
  );
}

function EnvironmentTaskCard({
  role,
  summary,
}: {
  role: ProjectDeliveryBaselineRole;
  summary: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const version = summary.currentVersions[role];
  const ready = summary.baselines[role]?.ready === true;
  const blockers = summary.checkpoints.filter(
    (item) => (item.scope === role || item.scope === 'project') && item.status !== 'ready',
  );
  const next = blockers.find((item) => item.action)?.action;
  return (
    <article className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">
            {t(releaseEnvironmentLabelKey(role))}
          </p>
          <p className="mt-1 font-semibold">
            {!ready
              ? t('projectDeliveryActionRequired', { count: blockers.length })
              : t('projectDeliveryEnvironmentReady')}
          </p>
        </div>
        <span className={!ready
          ? 'rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-700'
          : 'rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-700'}>
          {!ready ? t('projectDeliveryBlocked') : t('projectDeliveryReady')}
        </span>
      </div>
      {blockers[0] ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {reasonLabel(blockers[0].reasonCodes[0], t)}
        </p>
      ) : null}
      {next ? (
        <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline" href={next.href}>
          {t('projectDeliveryConfigureEnvironment')}
        </Link>
      ) : null}
      {role === 'production' ? <ProductionRiskSummary summary={summary} /> : null}
      <details className="mt-3 border-t pt-3 text-xs text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3 font-medium">
          {t('projectDeliveryTechnicalDetails')}
        </summary>
        {version ? (
          <div className="space-y-1 pb-2">
            <p>{t('projectDeliveryReleaseVersion', { version: version.releaseVersion })}</p>
            <p className="break-all font-mono">{version.manifestDigest}</p>
          </div>
        ) : (
          <p className="pb-2">{t('projectDeliveryCurrentVersionUnknown')}</p>
        )}
      </details>
    </article>
  );
}

function ProductionRiskSummary({ summary }: { summary: ProjectDeliverySummary }) {
  const t = useTranslations('projects');
  const resources = summary.resources.byEnvironment.production;
  const routeReady = summary.checkpoints.some((item) =>
    item.id === 'routes' && item.scope === 'production' && item.status === 'ready');
  return (
    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-md bg-muted/40 p-2.5">
        <dt className="text-muted-foreground">{t('projectDeliveryProductionResources')}</dt>
        <dd className="mt-1 font-medium">
          {resources === 0
            ? t('projectDeliveryZeroResourcesNeutral')
            : t('projectDeliveryProductionResourceCount', { count: resources })}
        </dd>
      </div>
      <div className={routeReady ? 'rounded-md bg-muted/40 p-2.5' : 'rounded-md bg-amber-500/10 p-2.5'}>
        <dt className="text-muted-foreground">{t('projectDeliveryProductionRoute')}</dt>
        <dd className="mt-1 font-medium">
          {routeReady ? t('projectDeliveryRouteVerified') : t('projectDeliveryZeroRouteBlocked')}
        </dd>
      </div>
    </dl>
  );
}

type Translator = ReturnType<typeof useTranslations<'projects'>>;

function checkpointLabel(checkpoint: ProjectDeliveryCheckpoint, t: Translator) {
  return t(`projectDeliveryCheckpoint_${checkpoint.id}` as never);
}

function scopeLabel(scope: ProjectDeliveryCheckpoint['scope'], t: Translator) {
  return scope === 'project' ? t('projectDeliveryProjectScope') : t(releaseEnvironmentLabelKey(scope));
}

function reasonLabel(reason: string | undefined, t: Translator) {
  if (!reason) return t('projectDeliveryActionRequiredGeneric');
  const key = projectDeliveryReasonKey(reason);
  return key ? t(key as never) : reason;
}
