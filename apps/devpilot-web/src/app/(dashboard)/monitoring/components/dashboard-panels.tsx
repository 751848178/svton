/** 监控仪表盘面板。 */
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState, LoadingState, Skeleton } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
import { resourceKindLabels, metricSourceLabels, statusLabels } from '../constants';
import { formatMetricWindow, humanizeKey } from '../utils-format';
import { ServiceSloRow } from './service-slo-row';
import type { ServiceSloDashboardRow } from '../types-dashboard';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function DashboardPanels({ m }: { m: MonitoringHook }) {
  const t = useTranslations('monitoring');
  const serviceRows = m.serviceSloDashboard?.rows ?? [];
  const serviceLabel = readFocusedServiceLabel(m, serviceRows[0]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">{t('resourceMetrics')}</h2>
          <WindowSwitch
            value={m.resourceMetricDashboardWindow}
            onChange={m.setResourceMetricDashboardWindow}
          />
        </div>
        {/* 初次加载（loading）走骨架；切窗期间数据为 null 走轻量 LoadingState。 */}
        {m.loading ? (
          <SkeletonGroup />
        ) : !m.resourceMetricDashboard ? (
          <div className="space-y-2 py-4 text-center">
            <p className="text-sm text-muted-foreground">{t('noResourceMetrics')}</p>
            <p className="text-xs text-muted-foreground">
              {t('noResourceMetricsHint')}{' '}
              <Link href="/resource-control" className="font-medium text-primary hover:underline">
                {t('goToResourceControl')} →
              </Link>
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {m.resourceMetricDashboard.rows.slice(0, 10).map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 break-words">
                  {resourceKindLabels[row.kind] || humanizeKey(row.kind)}{' '}
                  <span className="text-muted-foreground">
                    ({metricSourceLabels[row.metricSource] || humanizeKey(row.metricSource)})
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <StatusTag
                    status={row.status}
                    label={statusLabels[row.status] || row.status}
                  />
                  <span className="text-muted-foreground">
                    {t('samples', { count: row.sampleCount })}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">{t('serviceSlo')}</h2>
            <div className="mt-1 text-xs text-muted-foreground">
              {m.applicationServiceId
                ? `${serviceLabel} · ${formatMetricWindow(
                    m.serviceSloDashboard?.windowMinutes ?? m.serviceSloDashboardWindow,
                  )}`
                : `${t('allVisibleServices')} · ${formatMetricWindow(
                    m.serviceSloDashboard?.windowMinutes ?? m.serviceSloDashboardWindow,
                  )}`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <WindowSwitch
              value={m.serviceSloDashboardWindow}
              onChange={m.setServiceSloDashboardWindow}
            />
            {m.applicationServiceId ? (
              <Link
                href="/monitoring"
                className="inline-flex min-h-10 items-center rounded-md border px-3 text-xs font-medium hover:bg-accent"
              >
                {t('viewAllServices')}
              </Link>
            ) : null}
          </div>
        </div>
        {m.loading ? (
          <SkeletonGroup />
        ) : !m.serviceSloDashboard ? (
          <LoadingState text={t('noSloData')} spinner={false} />
        ) : serviceRows.length === 0 ? (
          <EmptyState
            text={m.applicationServiceId ? t('noTargetServiceSloData') : t('noSloData')}
          />
        ) : (
          <div className="space-y-3">
            {serviceRows.slice(0, m.applicationServiceId ? 5 : 10).map((row) => (
              <ServiceSloRow
                key={row.id}
                row={row}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 资源指标面板的加载骨架（4 行占位）。 */
function SkeletonGroup() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton
          key={i}
          height={24}
        />
      ))}
    </div>
  );
}

function readFocusedServiceLabel(
  m: MonitoringHook,
  row?: ServiceSloDashboardRow,
): string {
  if (m.selectedApplicationService) {
    return [
      m.selectedApplicationService.application.name,
      m.selectedApplicationService.service.name,
    ].join(' / ');
  }
  if (row) {
    return row.service.application?.name
      ? `${row.service.application.name} / ${row.service.name}`
      : row.service.name;
  }
  return m.applicationServiceId;
}

const WINDOW_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 15, label: '15m' },
  { minutes: 60, label: '1h' },
  { minutes: 360, label: '6h' },
  { minutes: 1440, label: '24h' },
];

/** 时间窗口切换按钮组（15m/1h/6h/24h）。 */
function WindowSwitch({
  value,
  onChange,
}: {
  value: number;
  onChange: (minutes: number) => void;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border text-xs">
      {WINDOW_OPTIONS.map((option) => (
        <button
          key={option.minutes}
          type="button"
          onClick={() => onChange(option.minutes)}
          className={`inline-flex min-h-8 items-center px-2.5 font-medium ${
            value === option.minutes
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
