/** 监控仪表盘面板。 */
'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
import type { ServiceSloDashboardRow } from '../types-dashboard';
import { formatMetricNumber, formatMetricWindow, formatPercent } from '../utils-format';
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
        {!m.resourceMetricDashboard ? (
          <EmptyState text={t('noResourceMetrics')} />
        ) : (
          <div className="space-y-2">
            {m.resourceMetricDashboard.rows.slice(0, 10).map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="min-w-0 break-words">
                  {row.kind} ({row.metricSource})
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {row.status} · {t('samples', { count: row.sampleCount })}
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
        {!m.serviceSloDashboard ? (
          <EmptyState text={t('noSloData')} />
        ) : serviceRows.length === 0 ? (
          <EmptyState
            text={m.applicationServiceId ? t('noTargetServiceSloData') : t('noSloData')}
          />
        ) : (
          <div className="space-y-3">
            {serviceRows.slice(0, m.applicationServiceId ? 5 : 10).map((row) => (
              <div
                key={row.id}
                className="rounded-md bg-muted/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="break-words font-medium">
                      {row.service.application?.name ? `${row.service.application.name} / ` : ''}
                      {row.service.name}
                    </div>
                    <div className="mt-1 break-words text-xs text-muted-foreground">
                      {row.service.project?.name || row.projectId} ·{' '}
                      {row.service.environment?.name || row.environmentId}
                    </div>
                  </div>
                  <StatusTag
                    status={row.status}
                    label={row.status === 'no_data' ? t('noData') : row.status}
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <ServiceSloMetric
                    label="SLO"
                    value={formatPercent(row.sloPercent)}
                  />
                  <ServiceSloMetric
                    label={t('target')}
                    value={formatPercent(row.targetPercent)}
                  />
                  <ServiceSloMetric
                    label={t('errorBudget')}
                    value={formatPercent(row.errorBudgetRemainingPercent)}
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
                    value={row.statusReason}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

function ServiceSloMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-medium">{value}</div>
    </div>
  );
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
