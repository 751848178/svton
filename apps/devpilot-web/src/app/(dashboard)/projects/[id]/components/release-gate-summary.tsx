'use client';

import React from 'react';
import {
  ArrowClockwise,
  CaretDown,
  GitMerge,
  PlugsConnected,
  ShieldCheck,
  TreeStructure,
  WarningCircle,
} from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import { Button, StatusTag } from '@/components/ui';
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
  const decision = props.catalog.decisions.build;
  const previews = summary.previews.filter(
    (preview) => preview.blockingCount > 0 || preview.status === 'unavailable',
  );

  return (
    <section id="release-gate-details">
      <details className="group overflow-hidden border-y border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span>
            {t('releaseWorkbenchAdvancedChecks')}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {t('releaseWorkbenchGateCounts', {
                blocked: summary.blockingCount,
                warning: decision?.warningGateIds.length ?? 0,
                manual:
                  (decision?.manualGateIds.length ?? 0) -
                  (decision?.confirmedManualGateIds.length ?? 0),
              })}
            </span>
          </span>
          <CaretDown
            size={16}
            className="shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        <div className="border-t border-border pb-2 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
            <p className="text-sm text-muted-foreground">
              {t('releaseWorkbenchAdvancedChecksSummary', { count: props.catalog.summary.total })}
            </p>
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
                variant="outline"
                size="sm"
                aria-controls={props.dialogOpen ? props.dialogId : undefined}
                aria-expanded={props.dialogOpen}
                aria-haspopup="dialog"
                onClick={() => props.onOpenCatalog()}
              >
                {t('releaseGateCatalogExpand')}
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border">
            {previews.map((preview) => {
              const Icon = PREVIEW_ICONS[preview.key];
              return (
                <button
                  type="button"
                  key={preview.key}
                  className="flex min-h-11 w-full items-start gap-3 py-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  aria-controls={props.dialogOpen ? props.dialogId : undefined}
                  onClick={() => props.onOpenCatalog(preview.capabilityIds)}
                >
                  <Icon
                    size={18}
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm font-medium">
                        {t(`releaseGatePreview.${preview.key}.title`)}
                      </strong>
                      <StatusTag
                        status={releaseGateStatusTone(preview.status)}
                        label={t(`releaseGateStatus.${preview.status}`)}
                      />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t('releaseGatePreviewRowSummary', {
                        passing: preview.passingCount,
                        total: preview.checkCount,
                        blocked: preview.blockingCount,
                        time: formatTime(
                          preview.checkedAt,
                          locale,
                          t('releaseGateMetadataUnavailable'),
                        ),
                      })}
                    </span>
                    {preview.primaryReason ? (
                      <span className="mt-1 block text-xs text-foreground">
                        {locale.startsWith('zh')
                          ? preview.primaryReason.zh
                          : preview.primaryReason.en}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          {!summary.valid ? (
            <p
              role="alert"
              className="mt-3 flex items-center gap-2 text-sm text-destructive"
            >
              <WarningCircle size={18} weight="fill" aria-hidden="true" />
              {t('releaseGateCatalogIntegrityError')}
            </p>
          ) : null}
          {summary.valid && previews.length === 0 ? (
            <p className="py-3 text-sm text-emerald-700">{t('releaseGateCanEnterBuild')}</p>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function formatTime(value: string | null, locale: string, fallback: string) {
  return value ? new Date(value).toLocaleString(locale) : fallback;
}
