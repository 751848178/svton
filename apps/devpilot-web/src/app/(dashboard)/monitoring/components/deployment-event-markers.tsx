/**
 * 部署事件虚线标注(N4)
 *
 * 单一职责:在 sparkline 同尺寸的 SVG 内,按部署 startedAt 的横向比例绘制
 * 竖直虚线;每条线挂一个 <title> 提供 hover 提示(commit sha / 分支 / 触发者)。
 *
 * 渲染约束(对标 Railway):
 * - 虚线置于 sparkline 之上(z 序),但用半透明细线,避免遮挡数据线;
 * - 使用 stroke-dasharray 表达「事件标注」语义,与数据线区分;
 * - 多事件落在相近 ratio 时仍各自绘制(交叠由 SVG 顺序自然处理)。
 *
 * 无业务状态,纯展示。空 markers 时返回 null(调用方优雅降级)。
 */
import type { DeploymentMarker } from '../deployment-window.utils';
import { formatDeploymentTooltip } from '../deployment-marker-format.utils';

export interface DeploymentEventMarkersProps {
  /** 已映射到窗口内的部署标注(由 deploymentsInWindow 计算)。 */
  markers: DeploymentMarker[];
  /** 与 sparkline 同尺寸;默认对齐 MetricSparkline。 */
  width?: number;
  height?: number;
  /** tooltip 文案(由调用方按 i18n 注入)。 */
  labels: {
    branch: string;
    trigger: string;
    triggeredBy: string;
    unknownTrigger: string;
  };
}

/** 渲染部署事件虚线层;无标注时返回 null。 */
export function DeploymentEventMarkers({
  markers,
  width = 64,
  height = 20,
  labels,
}: DeploymentEventMarkersProps) {
  if (markers.length === 0) return null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-0 text-primary/70"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {markers.map(({ run, ratio }) => {
        const x = ratio * width;
        const title = formatDeploymentTooltip(run, labels);
        return (
          // 单条事件虚线;pointer-events 开启仅对线本身,以触发 hover title。
          <line
            key={run.id}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            strokeWidth={1}
            strokeDasharray="2 2"
            className="pointer-events-auto stroke-current opacity-60 hover:opacity-100"
          >
            <title>{title}</title>
          </line>
        );
      })}
    </svg>
  );
}
