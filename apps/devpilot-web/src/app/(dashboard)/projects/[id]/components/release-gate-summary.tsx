'use client';

import React from 'react';
import {
  GitMerge,
  PlugsConnected,
  ShieldCheck,
  TreeStructure,
  WarningCircle,
} from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { Button } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { ReleaseGateCatalog } from '../types/release-gate.types';
import { buildReleaseGateSummary, releaseGateStatusTone } from './release-gate-summary.model';

const PREVIEW_ICONS = {
  source: GitMerge,
  impact: TreeStructure,
  security: ShieldCheck,
  baseline: PlugsConnected,
};

interface Props {
  catalog: ReleaseGateCatalog;
  dialogId: string;
  dialogOpen: boolean;
  onOpenCatalog: () => void;
}

export function ReleaseGateSummary({ catalog, dialogId, dialogOpen, onOpenCatalog }: Props) {
  const t = useTranslations('projects');
  const summary = buildReleaseGateSummary(catalog);
  const conclusion = summary.valid
    ? summary.canEnterBuild
      ? t('releaseGateCanEnterBuild')
      : t('releaseGateCannotEnterBuild', { count: summary.blockingCount })
    : t('releaseGateCatalogInvalid');

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4 min-[821px]:flex-row min-[821px]:items-start">
        <div>
          <h4 className="font-semibold">
            {summary.canEnterBuild
              ? t('releaseGatePreflightComplete')
              : t('releaseGatePreflightBlocked')}
          </h4>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            {t('releaseGatePreflightSummaryDescription')}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-controls={dialogId}
          aria-expanded={dialogOpen}
          aria-haspopup="dialog"
          onClick={onOpenCatalog}
        >
          {t('releaseGateCatalogExpand')}
        </Button>
      </div>

      <dl className="grid gap-3 min-[821px]:grid-cols-3">
        <SummaryFact
          label={t('releaseGateMvpGroups')}
          value={t('releaseGateGroupCount', { count: summary.capabilityCount })}
        />
        <SummaryFact
          label={t('releaseGateFullCatalog')}
          value={t('releaseGateCheckCount', { count: summary.totalChecks })}
        />
        <SummaryFact
          label={t('releaseGateCurrentConclusion')}
          value={conclusion}
        />
      </dl>

      <div className="grid gap-3 min-[821px]:grid-cols-2">
        {summary.previews.map((preview) => {
          const Icon = PREVIEW_ICONS[preview.key];
          return (
            <article
              key={preview.key}
              className="flex items-start gap-3 rounded-lg border bg-white p-4"
            >
              <Icon
                size={22}
                weight="duotone"
                className="mt-0.5 shrink-0 text-indigo-600"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="font-medium">{t(`releaseGatePreview.${preview.key}.title`)}</h5>
                  <StatusTag
                    status={releaseGateStatusTone(preview.status)}
                    label={t(`releaseGateStatus.${preview.status}`)}
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t(`releaseGatePreview.${preview.key}.description`, {
                    passing: preview.passingCount,
                    total: preview.checkCount,
                  })}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {!summary.valid ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-sm text-destructive"
        >
          <WarningCircle
            size={18}
            weight="fill"
            aria-hidden="true"
          />
          {t('releaseGateCatalogIntegrityError')}
        </p>
      ) : null}
    </section>
  );
}

function SummaryFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
