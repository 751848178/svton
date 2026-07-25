/**
 * 资源指标仪表盘行
 *
 * 单一职责:渲染 ResourceMetricDashboardRow 单行——
 * kind/source 标签、CPU/内存当前值 Chip(阈值着色)、趋势 Sparkline、
 * StatusTag 与样本数。数值缺失时优雅降级(不显示对应 Chip / Sparkline)。
 *
 * 修复 A4:此前 dashboard-panels 只渲染 kind/source/status/sampleCount,
 * 后端已算出的 latest/average/max/delta 全被丢弃。本组件补回数值与趋势。
 *
 * N4:Sparkline 叠加部署事件虚线(对标 Railway),由父层注入 deployments + 时间窗口。
 */
import { useTranslations } from 'next-intl';
import { StatusTag } from '@/components/ui';
import type { ResourceMetricDashboardRow, ResourceMetricDashboardValue } from '../types-dashboard';
import type { DeploymentEventRun } from '../hooks/use-recent-deployment-events';
import type { SparklineTimeWindow } from '../deployment-window.utils';
import { resourceKindLabels, metricSourceLabels, statusLabels } from '../constants';
import { humanizeKey } from '../utils-format';
import { MetricChip } from './metric-chip';
import { MetricSparklineWithDeployments } from './metric-sparkline-with-deployments';

const PERCENT_THRESHOLD_HIGH = 80;
const PERCENT_THRESHOLD_MID = 50;

type PercentTone = 'high' | 'mid' | 'normal';

/** 百分比 → 色调(与 MetricChip 阈值一致)。 */
function percentTone(value: number | null | undefined): PercentTone {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'normal';
  if (value >= PERCENT_THRESHOLD_HIGH) return 'high';
  if (value >= PERCENT_THRESHOLD_MID) return 'mid';
  return 'normal';
}

/** 取百分比最新值,缺失返回 null。 */
function latestOf(value?: ResourceMetricDashboardValue): number | null {
  const latest = value?.latest;
  return typeof latest === 'number' && Number.isFinite(latest) ? latest : null;
}

export interface ResourceMetricRowProps {
  row: ResourceMetricDashboardRow;
  /** 部署事件全集(N4);由父层统一注入,组件内按时间窗口过滤。 */
  deployments?: DeploymentEventRun[];
  /** 部署虚线的时间窗口(N4);缺省时不叠加虚线。 */
  timeWindow?: SparklineTimeWindow;
}

export function ResourceMetricRow({ row, deployments, timeWindow }: ResourceMetricRowProps) {
  const t = useTranslations('monitoring');
  const cpuLatest = latestOf(row.cpuPercent);
  const memLatest = latestOf(row.memoryPercent);
  const sparkTone = percentTone(Math.max(cpuLatest ?? 0, memLatest ?? 0));
  const showSpark = cpuLatest !== null || memLatest !== null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 break-words">
        <span className="break-words">
          {resourceKindLabels[row.kind] || humanizeKey(row.kind)}{' '}
          <span className="text-muted-foreground">
            ({metricSourceLabels[row.metricSource] || humanizeKey(row.metricSource)})
          </span>
        </span>
        {cpuLatest !== null && (
          <MetricChip label={t('cpu')} value={cpuLatest} suffix="%" />
        )}
        {memLatest !== null && (
          <MetricChip label={t('memory')} value={memLatest} suffix="%" />
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {showSpark && (
          <MetricSparklineWithDeployments
            points={[
              row.cpuPercent?.max ?? row.memoryPercent?.max,
              row.cpuPercent?.average ?? row.memoryPercent?.average,
              row.cpuPercent?.latest ?? row.memoryPercent?.latest,
            ]}
            tone={sparkTone}
            deployments={deployments ?? []}
            timeWindow={timeWindow}
          />
        )}
        <StatusTag
          status={row.status}
          label={statusLabels[row.status] || row.status}
        />
        <span className="text-muted-foreground">
          {t('samples', { count: row.sampleCount })}
        </span>
      </span>
    </div>
  );
}
