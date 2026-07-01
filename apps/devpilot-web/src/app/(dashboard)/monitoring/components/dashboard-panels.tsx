/** 监控仪表盘面板。 */
'use client';
import Link from 'next/link';
import { EmptyState } from '@svton/ui';
import { StatusTag } from '@/components/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
import type { ServiceSloDashboardRow } from '../types-dashboard';
import { formatMetricNumber, formatMetricWindow, formatPercent } from '../utils-format';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function DashboardPanels({ m }: { m: MonitoringHook }) {
  const serviceRows = m.serviceSloDashboard?.rows ?? [];
  const serviceLabel = readFocusedServiceLabel(m, serviceRows[0]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h2 className="mb-3 font-semibold">资源指标</h2>
        {!m.resourceMetricDashboard ? (
          <EmptyState text="暂无资源指标数据" />
        ) : (
          <div className="space-y-2">
            {m.resourceMetricDashboard.rows.slice(0, 10).map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between text-sm"
              >
                <span>
                  {row.kind} ({row.metricSource})
                </span>
                <span className="text-muted-foreground">
                  {row.status} · {row.sampleCount} samples
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">服务 SLO</h2>
            <div className="mt-1 text-xs text-muted-foreground">
              {m.applicationServiceId
                ? `${serviceLabel} · ${formatMetricWindow(
                    m.serviceSloDashboard?.windowMinutes ?? m.serviceSloDashboardWindow,
                  )}`
                : `全部可见服务 · ${formatMetricWindow(
                    m.serviceSloDashboard?.windowMinutes ?? m.serviceSloDashboardWindow,
                  )}`}
            </div>
          </div>
          {m.applicationServiceId ? (
            <Link
              href="/monitoring"
              className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              查看全部服务
            </Link>
          ) : null}
        </div>
        {!m.serviceSloDashboard ? (
          <EmptyState text="暂无 SLO 数据" />
        ) : serviceRows.length === 0 ? (
          <EmptyState
            text={m.applicationServiceId ? '暂无目标服务 SLO 数据' : '暂无 SLO 数据'}
          />
        ) : (
          <div className="space-y-3">
            {serviceRows.slice(0, m.applicationServiceId ? 5 : 10).map((row) => (
              <div
                key={row.id}
                className="rounded-md bg-muted/40 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {row.service.application?.name ? `${row.service.application.name} / ` : ''}
                      {row.service.name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {row.service.project?.name || row.projectId} ·{' '}
                      {row.service.environment?.name || row.environmentId}
                    </div>
                  </div>
                  <StatusTag
                    status={row.status}
                    label={row.status === 'no_data' ? '无数据' : row.status}
                  />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <ServiceSloMetric
                    label="SLO"
                    value={formatPercent(row.sloPercent)}
                  />
                  <ServiceSloMetric
                    label="目标"
                    value={formatPercent(row.targetPercent)}
                  />
                  <ServiceSloMetric
                    label="错误预算"
                    value={formatPercent(row.errorBudgetRemainingPercent)}
                  />
                  <ServiceSloMetric
                    label="burn rate"
                    value={formatMetricNumber(row.burnRate)}
                  />
                  <ServiceSloMetric
                    label="部署失败"
                    value={`${row.deploymentFailureCount}/${row.deploymentCount}`}
                  />
                  <ServiceSloMetric
                    label="操作失败"
                    value={`${row.operationFailureCount}/${row.operationCount}`}
                  />
                  <ServiceSloMetric
                    label="告警影响"
                    value={String(row.alertImpactCount)}
                  />
                  <ServiceSloMetric
                    label="状态原因"
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
