'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import type {
  ProjectDeliveryBaselineRole,
  ProjectDeliverySummary,
} from '../types/project-delivery-summary.types';
import { releaseEnvironmentLabelKey } from '../utils/release-copy.model';

export function ProjectDeliveryWeakSummary({ summary }: { summary: ProjectDeliverySummary }) {
  const t = useTranslations('projects');
  const ready = (['staging', 'production'] as const).filter(
    (role) => summary.baselines[role]?.ready,
  ).length;
  const items = [
    [t('projectDeliveryShape'), intakeLabel(summary, t)],
    [
      t('projectDeliveryEnvironmentReadiness'),
      t('projectDeliveryEnvironmentReadinessValue', { ready }),
    ],
    [
      t('projectDeliveryResourceBinding'),
      t('projectDeliveryResourceBindingValue', summary.resources),
    ],
    [
      t('projectDeliverySiteEntries'),
      t('projectDeliverySiteEntriesValue', {
        active: summary.entries.active,
        total: summary.entries.total,
      }),
    ],
  ];
  return (
    <section
      aria-label={t('projectDeliveryRuntimeBaseline')}
      className="grid gap-3 rounded-lg border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {items.map(([label, value]) => (
        <div key={label}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-1 font-medium">{value}</p>
        </div>
      ))}
    </section>
  );
}

export function ProjectDeliveryEnvironmentStrip({ summary }: { summary: ProjectDeliverySummary }) {
  const t = useTranslations('projects');
  return (
    <section
      aria-label={t('projectDeliveryCurrentVersions')}
      className="grid gap-3 lg:grid-cols-2"
    >
      {(['staging', 'production'] as const).map((role) => (
        <EnvironmentVersionCard
          key={role}
          role={role}
          summary={summary}
        />
      ))}
    </section>
  );
}

function EnvironmentVersionCard({
  role,
  summary,
}: {
  role: ProjectDeliveryBaselineRole;
  summary: ProjectDeliverySummary;
}) {
  const t = useTranslations('projects');
  const version = summary.currentVersions[role];
  return (
    <article className="rounded-lg border p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">
        {t(releaseEnvironmentLabelKey(role))}
      </p>
      {version ? (
        <div className="mt-2">
          <p className="text-lg font-semibold">
            {t('projectDeliveryReleaseVersion', { version: version.releaseVersion })}
          </p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {version.manifestDigest}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t('projectDeliveryCurrentVersionUnknown')}
        </p>
      )}
    </article>
  );
}

type Translator = ReturnType<typeof useTranslations<'projects'>>;

function intakeLabel(summary: ProjectDeliverySummary, t: Translator) {
  const type = summary.intake.projectType
    ? t(`projectDeliveryType_${summary.intake.projectType}` as never)
    : t('projectDeliveryUnknown');
  const architecture = summary.intake.architecture
    ? t(`projectDeliveryArchitecture_${summary.intake.architecture}` as never)
    : t('projectDeliveryUnknown');
  const components =
    summary.intake.componentCount === null
      ? t('projectDeliveryComponentsUnknown')
      : t('projectDeliveryComponents', { count: summary.intake.componentCount });
  return `${type} · ${architecture} · ${components}`;
}
