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
import { Button } from '@/components/ui';
import { FlowStatusTag } from './release-workbench/release-flow-status-tag';
import type {
  ReleaseGateCatalog,
  ReleaseGateDecisionStage,
} from '../types/release-gate.types';
import { humanizeGateReason } from '../utils/release-display.utils';
import { formatIsoMinute } from '../utils/release-time.utils';
import { buildReleaseGateSummary, releaseGateStatusTone } from './release-gate-summary.model';

const PREVIEW_ICONS = {
  source: GitMerge,
  impact: TreeStructure,
  security: ShieldCheck,
  baseline: PlugsConnected,
};

interface Props {
  catalog: ReleaseGateCatalog;
  /** PX-1：计数取当前执行阶段决策（与预警条同源）。 */
  stage: ReleaseGateDecisionStage;
  stageLabel: string;
  dialogId: string;
  dialogOpen: boolean;
  onOpenCatalog: (capabilityIds?: readonly string[]) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function ReleaseGateSummary(props: Props) {
  const t = useTranslations('projects');
  const locale = useLocale();
  const summary = buildReleaseGateSummary(props.catalog, props.stage);
  const decision = props.catalog.decisions[props.stage] ?? props.catalog.decisions.build;
  const previews = summary.previews.filter(
    (preview) => preview.blockingCount > 0 || preview.status === 'unavailable',
  );

  return (
    <section id="release-gate-details">
      <details className="group overflow-hidden border-y border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          <span className="min-w-0">
            {t('releaseWorkbenchAdvancedChecks')}
            {/* PX-1：计数带阶段限定词，与预警条同源同数。 */}
            <span
              data-testid="gate-summary-counts"
              className="ml-2 text-xs font-normal text-muted-foreground"
            >
              {t('releaseWorkbenchStageGateCounts', {
                stage: props.stageLabel,
                blocked: summary.blockingCount,
                warning: decision?.warningGateIds.length ?? 0,
                manual: summary.manualCount,
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
              {t('releaseWorkbenchAdvancedChecksSummary', {
                count: props.catalog.summary.total,
                stage: props.stageLabel,
              })}
            </p>
            <div className="flex flex-wrap gap-2">
              {/* PX-19：主行动 CTA 与「查看全部」统一为带边框 secondary 形态。 */}
              <Button
                variant="outline"
                size="sm"
                disabled={props.refreshing}
                onClick={props.onRefresh}
              >
                <ArrowClockwise
                  size={16}
                  aria-hidden="true"
                />
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
                {t('releaseGateCatalogExpand', { count: props.catalog.summary.total })}
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
                      <FlowStatusTag
                        status={releaseGateStatusTone(preview.status)}
                        label={t(`releaseGateStatus.${preview.status}`)}
                      />
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {t('releaseGatePreviewRowSummary', {
                        passing: preview.passingCount,
                        total: preview.checkCount,
                        blocked: preview.blockingCount,
                        /* PX-27 复核补漏：无检查时间时回退「暂无」，不再出现「检查于 -」。 */
                        time: preview.checkedAt
                          ? formatIsoMinute(preview.checkedAt)
                          : t('releaseWorkbenchValueEmpty'),
                      })}
                    </span>
                    {preview.primaryReason ? (
                      // ROD-5：后端 reason 可能内嵌 raw ISO 时间戳，渲染前统一本地化。
                      <span
                        data-testid="gate-preview-reason"
                        className="mt-1 block text-xs text-foreground"
                      >
                        {humanizeGateReason(
                          locale.startsWith('zh')
                            ? preview.primaryReason.zh
                            : preview.primaryReason.en,
                        )}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          {!summary.valid ? (
            // PX-26：完整性告警复用 alert 卡片形态（底色 + 边框 + 图标），不再是无形态红字。
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              <WarningCircle
                size={17}
                weight="fill"
                aria-hidden="true"
                className="mt-0.5 shrink-0"
              />
              {t('releaseGateCatalogIntegrityError')}
            </div>
          ) : null}
          {summary.valid && previews.length === 0 ? (
            <p className="py-3 text-sm text-emerald-700">{t('releaseGateCanEnterBuild')}</p>
          ) : null}
        </div>
      </details>
    </section>
  );
}
