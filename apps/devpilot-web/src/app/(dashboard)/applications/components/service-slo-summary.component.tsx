/**
 * 服务 SLO 摘要
 *
 * 单一职责：渲染单个应用服务的 SLO loading/empty/摘要（可展开看完整指标）+ 监控深链。
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { ApplicationServiceItem, ServiceSloRow } from '../types';
import { formatPercent } from '../utils';

interface ServiceSloSummaryProps {
  service: ApplicationServiceItem;
  row?: ServiceSloRow | null;
  loading: boolean;
}

/** SLO 状态 → applications 命名空间下的 i18n key（no_data 复用 sloNoData）。 */
const sloStatusLabelKeys: Record<string, string> = {
  ok: 'sloStatusOk',
  warning: 'sloStatusWarning',
  critical: 'sloStatusCritical',
  no_data: 'sloNoData',
};

export function ServiceSloSummary({ service, row, loading }: ServiceSloSummaryProps) {
  const t = useTranslations('applications');
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        {t('sloLoading')}
      </div>
    );
  }

  if (!row) {
    return (
      <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        {t('sloEmpty')}
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md bg-muted/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('sloSummary')}</span>
          <StatusTag
            status={row.status}
            label={(() => {
              const key = sloStatusLabelKeys[row.status];
              return key ? t(key) : row.status;
            })()}
          />
          <span className="text-xs text-muted-foreground">
            {row.windowMinutes}m ·{' '}
            <span
              className="max-w-[14rem] align-middle inline-block truncate"
              title={row.statusReason}
            >
              {row.statusReason}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SloMetric
            label={t('sloLabel')}
            value={formatPercent(row.sloPercent)}
            muted={row.sloPercent === null || row.sloPercent === undefined}
          />
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-primary hover:underline"
            aria-expanded={expanded}
          >
            {t('sloDetails')}
          </button>
          <Link
            href={`/monitoring?applicationServiceId=${encodeURIComponent(service.id)}`}
            className="text-xs text-primary hover:underline"
          >
            {t('viewMonitoring')}
          </Link>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <SloMetric
            label={t('sloTarget')}
            value={formatPercent(row.targetPercent)}
          />
          <SloMetric
            label={t('sloErrorBudget')}
            value={formatPercent(row.errorBudgetRemainingPercent)}
            muted={
              row.errorBudgetRemainingPercent === null ||
              row.errorBudgetRemainingPercent === undefined
            }
          />
          <SloMetric
            label={t('burnRate')}
            value={row.burnRate === null || row.burnRate === undefined ? '-' : String(row.burnRate)}
            muted={row.burnRate === null || row.burnRate === undefined}
          />
          <SloMetric
            label={t('sloDeployFail')}
            value={`${row.deploymentFailureCount}/${row.deploymentCount}`}
          />
          <SloMetric
            label={t('sloOpsAlert')}
            value={`${row.operationFailureCount}/${row.operationCount} · ${row.alertImpactCount}`}
          />
        </div>
      ) : null}
    </div>
  );
}

function SloMetric({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={
          muted ? 'truncate text-xs text-muted-foreground' : 'truncate text-xs font-medium'
        }
      >
        {value}
      </div>
    </div>
  );
}
