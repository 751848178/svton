/**
 * 带部署事件标注的 Sparkline(N4)
 *
 * 单一职责:把 MetricSparkline(A4)与 DeploymentEventMarkers(N4)叠在同一个
 * 固定尺寸的盒子里。sparkline 在下层(数据优先),虚线在上层(半透明,不遮挡)。
 *
 * 不破坏 A4 的数值展示:sparkline 的 points/tone 透传,行为与单独使用时一致;
 * 仅当 markers 非空时才多渲染一层 SVG(空数组时退化为纯 sparkline)。
 */
import { useTranslations } from 'next-intl';
import type { DeploymentEventRun } from '../hooks/use-recent-deployment-events';
import {
  deploymentsInWindow,
  type SparklineTimeWindow,
} from '../deployment-window.utils';
import { MetricSparkline } from './metric-sparkline';
import { DeploymentEventMarkers } from './deployment-event-markers';

const SPARK_WIDTH = 64;
const SPARK_HEIGHT = 20;

export interface MetricSparklineWithDeploymentsProps {
  /** sparkline 数据点(左→右),与 MetricSparkline 同语义。 */
  points: Array<number | null | undefined>;
  /** sparkline 色调。 */
  tone?: 'high' | 'mid' | 'normal';
  /** 部署运行全集;组件内部按窗口过滤。 */
  deployments: DeploymentEventRun[];
  /** 用于把 startedAt 映射到 x 比例的时间窗口;缺省时不叠加虚线(退化为纯 sparkline)。 */
  timeWindow?: SparklineTimeWindow | null;
}

export function MetricSparklineWithDeployments({
  points,
  tone,
  deployments,
  timeWindow,
}: MetricSparklineWithDeploymentsProps) {
  const t = useTranslations('monitoring');
  const markers = timeWindow ? deploymentsInWindow(deployments, timeWindow) : [];
  const hasSpark = points.filter((v) => typeof v === 'number' && Number.isFinite(v)).length >= 2;

  if (!hasSpark) return null;

  // 无时间窗口(或无窗口内事件)时退化为纯 sparkline,保留 A4 行为。
  if (markers.length === 0) {
    return <MetricSparkline points={points} tone={tone} width={SPARK_WIDTH} height={SPARK_HEIGHT} />;
  }

  return (
    <span
      className="relative inline-flex"
      style={{ width: SPARK_WIDTH, height: SPARK_HEIGHT }}
      aria-label={t('metricTrendWithDeployments')}
    >
      <MetricSparkline points={points} tone={tone} width={SPARK_WIDTH} height={SPARK_HEIGHT} />
      <DeploymentEventMarkers
        markers={markers}
        width={SPARK_WIDTH}
        height={SPARK_HEIGHT}
        labels={{
          branch: t('markerBranch'),
          trigger: t('markerCommit'),
          triggeredBy: t('markerTriggeredBy'),
          unknownTrigger: t('markerUnknownTrigger'),
        }}
      />
    </span>
  );
}
