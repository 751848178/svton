/**
 * 指标 Sparkline
 *
 * 单一职责:把一组数值渲染为约 20px 高的内联 SVG 趋势线(纯手写,不引库)。
 *
 * 数据来源说明:后端 ResourceMetricDashboardValue 不暴露原始采样数组,
 * delta 为标量(latest - oldest)。因此趋势线由「峰值 → 平均 → 当前」三点构成,
 * 横向时序:左=max(峰)、中=average(基线)、右=latest(当前),直观体现是否回落/攀升。
 * 数值不足两点或非有限时返回 null(调用方优雅降级)。
 */
interface MetricSparklineProps {
  /** 有序数值(左→右)。不足两点或全非有限时不渲染。 */
  points: Array<number | null | undefined>;
  /** 色调:high(>=80 红)、mid(>=50 黄)、normal(默认)。 */
  tone?: 'high' | 'mid' | 'normal';
  width?: number;
  height?: number;
}

const TONE_STROKE: Record<NonNullable<MetricSparklineProps['tone']>, string> = {
  high: 'stroke-red-500 dark:stroke-red-400',
  mid: 'stroke-amber-500 dark:stroke-amber-400',
  normal: 'stroke-muted-foreground',
};

const TONE_FILL: Record<NonNullable<MetricSparklineProps['tone']>, string> = {
  high: 'fill-red-500/10 dark:fill-red-400/15',
  mid: 'fill-amber-500/10 dark:fill-amber-400/15',
  normal: 'fill-muted-foreground/10',
};

/** 渲染纯 SVG inline 趋势线;数据不足时返回 null。 */
export function MetricSparkline({
  points,
  tone = 'normal',
  width = 64,
  height = 20,
}: MetricSparklineProps) {
  const nums = points.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value),
  );
  if (nums.length < 2) return null;

  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const span = max - min || 1; // 避免除零:全相等时拉成中线
  const stepX = width / (nums.length - 1);
  const pad = 2;
  const usableH = height - pad * 2;

  const coords = nums.map((value, index) => {
    const x = index * stepX;
    const y = pad + usableH * (1 - (value - min) / span);
    return [x, y] as const;
  });

  const linePath = coords
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={TONE_STROKE[tone]}
      preserveAspectRatio="none"
      aria-hidden="true"
      role="img"
      aria-label="指标趋势"
    >
      <path d={areaPath} className={TONE_FILL[tone]} stroke="none" />
      <path
        d={linePath}
        fill="none"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* 末端(当前值)标记点 */}
      <circle
        cx={coords[coords.length - 1][0]}
        cy={coords[coords.length - 1][1]}
        r={1.6}
        className="fill-current"
        stroke="none"
      />
    </svg>
  );
}
