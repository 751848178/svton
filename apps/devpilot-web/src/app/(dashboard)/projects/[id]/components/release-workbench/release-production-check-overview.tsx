'use client';

import Link from 'next/link';
import { ArrowUpRight } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import type { ProductionReleasePreview } from '../../types/release-production.types';
import { FlowStatusTag } from './release-flow-status-tag';
import {
  productionCheckCounts,
  productionCheckStatusKey,
  productionCheckTone,
  productionRouteTargets,
} from './release-production-check.model';

export function ReleaseProductionCheckOverview(props: { preview: ProductionReleasePreview }) {
  const t = useTranslations('projects');
  const counts = productionCheckCounts(props.preview);
  const attention = props.preview.preflight.checks.filter((check) => check.status !== 'checked');
  return (
    <div className="space-y-5">
      <DecisionBanner preview={props.preview} />
      <dl className="grid gap-x-6 gap-y-3 border-y py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Fact
          label={t('releaseProductionCheckTargetEnvironment')}
          value={props.preview.snapshot.environment.name}
        />
        <Fact
          label={t('productionVersion')}
          value={props.preview.snapshot.releaseOrder.releaseVersion}
        />
        <Fact
          label={t('releaseProductionCheckComponents')}
          value={String(props.preview.snapshot.workload.services.length)}
        />
        <Fact
          label={t('releaseProductionCheckRoutes')}
          value={String(productionRouteTargets(props.preview).length)}
        />
      </dl>
      <section aria-labelledby="release-production-attention-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4
            id="release-production-attention-title"
            className="text-sm font-semibold"
          >
            {t('releaseProductionCheckAttentionTitle')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('releaseProductionCheckDescription', counts)}
          </p>
        </div>
        {attention.length > 0 ? (
          <div className="mt-3 divide-y border-y">
            {attention.map((check) => (
              <AttentionCheck
                key={check.id}
                check={check}
              />
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            {t('releaseProductionCheckAttentionEmpty')}
          </p>
        )}
      </section>
    </div>
  );
}

function DecisionBanner(props: { preview: ProductionReleasePreview }) {
  const t = useTranslations('projects');
  const blocked = props.preview.preflight.readiness === 'blocked';
  const local = props.preview.preflight.acceptanceOnly;
  return (
    <div
      className={`rounded-lg border p-4 text-sm ${blocked ? 'border-destructive/40 bg-destructive/5' : local ? 'border-warning/40 bg-warning/5' : ''}`}
      role={blocked ? 'alert' : undefined}
    >
      <p className="font-medium">
        {t(
          blocked
            ? 'releaseProductionCheckDecisionBlocked'
            : local
              ? 'releaseProductionCheckDecisionLocal'
              : 'releaseProductionCheckDecisionReady',
        )}
      </p>
      {blocked && props.preview.preflight.repairHref ? (
        <Link
          href={props.preview.preflight.repairHref}
          className="mt-2 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {t('releaseProductionCheckRepair')}
          <ArrowUpRight
            size={13}
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}

type Check = ProductionReleasePreview['preflight']['checks'][number];

function AttentionCheck(props: { check: Check }) {
  const t = useTranslations('projects');
  const locale = useLocale();
  return (
    <div className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          {props.check.title ? localized(props.check.title, locale) : props.check.id}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {localized(props.check.reason, locale)}
        </p>
        {props.check.repairHref ? (
          <Link
            href={props.check.repairHref}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t('releaseProductionCheckRepair')}
            <ArrowUpRight
              size={12}
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </div>
      <FlowStatusTag
        status={productionCheckTone(props.check.status)}
        label={t(productionCheckStatusKey(props.check.status))}
      />
    </div>
  );
}

function Fact(props: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
      <dd
        className="mt-1 truncate font-medium"
        title={props.value}
      >
        {props.value}
      </dd>
    </div>
  );
}

function localized(value: { zh: string; en: string }, locale: string) {
  return locale.startsWith('zh') ? value.zh : value.en;
}
