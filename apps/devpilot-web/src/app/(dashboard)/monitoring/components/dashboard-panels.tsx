/** 监控仪表盘面板。 */
'use client';
import { EmptyState } from '@svton/ui';
import type { useMonitoring } from '../hooks/use-monitoring';
type MonitoringHook = ReturnType<typeof useMonitoring>;

export function DashboardPanels({ m }: { m: MonitoringHook }) {
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
        <h2 className="mb-3 font-semibold">服务 SLO</h2>
        {!m.serviceSloDashboard ? (
          <EmptyState text="暂无 SLO 数据" />
        ) : (
          <div className="space-y-2">
            {m.serviceSloDashboard.rows.slice(0, 10).map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between text-sm"
              >
                <span>{row.serviceId}</span>
                <span className="text-muted-foreground">
                  {row.sloPercent?.toFixed(2) ?? '-'}% / {row.targetPercent}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
