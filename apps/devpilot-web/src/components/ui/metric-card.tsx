/**
 * 统计指标卡片
 *
 * 单一职责：展示单个统计数字 + 标签。
 * 跨列表页复用（backups / audit-events / monitoring 等都有同样的 Metric）。
 */

export function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
