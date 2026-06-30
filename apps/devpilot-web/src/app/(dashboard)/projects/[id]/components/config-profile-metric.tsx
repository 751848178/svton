/**
 * 配置画像指标
 *
 * 单一职责：展示单个环境配置指标（标签/值/详情）。
 */

export function ConfigProfileMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-md bg-muted/50 p-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium text-foreground">{value}</div>
      <div
        className="mt-1 truncate text-muted-foreground"
        title={detail}
      >
        {detail}
      </div>
    </div>
  );
}
