'use client';

import React from 'react';
import {
  GitMerge,
  PlugsConnected,
  ShieldCheck,
  TreeStructure,
  WarningCircle,
  ArrowClockwise,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
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
  onOpenCatalog: (capabilityIds?: readonly string[]) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ReleaseGateSummary(props: Props) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const summary = buildReleaseGateSummary(props.catalog);
  const conclusion = summary.valid
    ? summary.canEnterBuild
      ? t('releaseGateCanEnterBuild')
      : t('releaseGateCannotEnterBuild', { count: summary.blockingCount })
    : t('releaseGateCatalogInvalid');
  const blockerPreviews = summary.previews.filter((preview) =>
    preview.blockingCount > 0 || preview.status === 'unavailable');

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
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={props.refreshing}
            onClick={props.onRefresh}
          >
            <ArrowClockwise size={16} aria-hidden="true" />
            {t('releaseGateRefresh')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-controls={props.dialogId}
            aria-expanded={props.dialogOpen}
            aria-haspopup="dialog"
            onClick={() => props.onOpenCatalog()}
          >
            {t('releaseGateCatalogExpand')}
          </Button>
        </div>
      </div>

      <p className="rounded-lg border bg-white px-4 py-3 text-sm font-medium">{conclusion}</p>

      <div className="grid gap-3 min-[821px]:grid-cols-2">
        {blockerPreviews.map((preview) => {
          const Icon = PREVIEW_ICONS[preview.key];
          return (
            <button
              type="button"
              key={preview.key}
              className="flex items-start gap-3 rounded-lg border bg-white p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/30"
              aria-controls={props.dialogId}
              onClick={() => props.onOpenCatalog(preview.capabilityIds)}
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
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('releaseGateBlockingCount', { count: preview.blockingCount })}
                  {' · '}
                  {t('releaseGateLastChecked', {
                    time: formatTime(preview.checkedAt, locale, t('releaseGateMetadataUnavailable')),
                  })}
                </p>
                {preview.primaryReason ? (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-700">
                    {locale.startsWith('zh')
                      ? preview.primaryReason.zh
                      : preview.primaryReason.en}
                  </p>
                ) : null}
              </div>
            </button>
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
      {summary.valid && blockerPreviews.length === 0 ? (
        <p className="text-sm text-emerald-700">{t('releaseGateCanEnterBuild')}</p>
      ) : null}
    </section>
  );
}

function formatTime(value: string | null, locale: string, fallback: string) {
  return value ? new Date(value).toLocaleString(locale) : fallback;
}
