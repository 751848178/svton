/**
 * 服务 SLO 仪表盘行
 *
 * 单一职责：渲染单条服务 SLO 概况（名称 + 项目/环境 + 状态 + 默认 2 个关键指标），
 * 其余 6 个明细指标折叠在「详情」切换后。
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePersistFn } from '@svton/hooks';
import { StatusTag } from '@/components/ui';
import type { ServiceSloDashboardRow } from '../types-dashboard';
import { statusLabels } from '../constants';
import { formatMetricNumber, formatPercent } from '../utils-format';

interface ServiceSloRowProps {
  row: ServiceSloDashboardRow;
}

export function ServiceSloRow({ row }: ServiceSloRowProps) {
  const t = useTranslations('monitoring');
  const [expanded, setExpanded] = useState(false);
  const toggle = usePersistFn(() => setExpanded((v) => !v));
  const projectName = row.service.project?.name || t('unknownProject');
  const envName = row.service.environment?.name || t('unknownEnvironment');

  return (
    <div className="rounded-md bg-muted/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words font-medium">
            {row.service.application?.name ? `${row.service.application.name} / ` : ''}
            {row.service.name}
          </div>
          <div className="mt-1 break-words text-xs text-muted-foreground">
            {projectName} · {envName}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusTag
            status={row.status}
            label={row.status === 'no_data' ? t('noData') : statusLabels[row.status] || row.status}
          />
          <button
            type="button"
            onClick={toggle}
            className="inline-flex min-h-9 items-center rounded border px-2 text-xs hover:bg-accent"
          >
            {expanded ? t('collapse') : t('details')}
          </button>
        </div>
      </div>
      {/* 默认展示 2 个关键指标；展开后补齐其余明细指标。 */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <ServiceSloMetric
          label={t('sloLabel')}
          value={formatPercent(row.sloPercent)}
        />
        <ServiceSloMetric
          label={t('errorBudget')}
          value={formatPercent(row.errorBudgetRemainingPercent)}
        />
        {expanded ? (
          <>
            <ServiceSloMetric
              label={t('target')}
              value={formatPercent(row.targetPercent)}
            />
            <ServiceSloMetric
              label={t('burnRate')}
              value={formatMetricNumber(row.burnRate)}
            />
            <ServiceSloMetric
              label={t('deployFailure')}
              value={`${row.deploymentFailureCount}/${row.deploymentCount}`}
            />
            <ServiceSloMetric
              label={t('operationFailure')}
              value={`${row.operationFailureCount}/${row.operationCount}`}
            />
            <ServiceSloMetric
              label={t('alertImpact')}
              value={String(row.alertImpactCount)}
            />
            <ServiceSloMetric
              label={t('statusReason')}
              value={row.statusReason || '-'}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ServiceSloMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium">{value}</div>
    </div>
  );
}
