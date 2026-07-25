/**
 * 部署事件 → sparkline 时间窗口映射(N4)
 *
 * 单一职责:把部署 startedAt 时间戳映射到 sparkline 的横向 x 坐标(0..1 比例)。
 *
 * 时间窗口语义(对齐后端 ResourceMetricDashboard):
 *   窗口右端 = generatedAt(后端汇总时刻);
 *   窗口左端 = generatedAt - windowMinutes。
 * 部署虚线落在窗口内时返回 [0,1] 比例;窗口外返回 null(不绘制,避免遮挡数据线)。
 *
 * 纯函数,无状态,可单测。
 */
import type { DeploymentEventRun } from './hooks/use-recent-deployment-events';

export interface SparklineTimeWindow {
  /** 窗口右端时间戳(ms)。通常取 dashboard.generatedAt;缺失回退 Date.now()。 */
  windowEndMs: number;
  /** 窗口长度(分钟)。 */
  windowMinutes: number;
}

export interface DeploymentMarker {
  /** 关联的部署运行(供 hover tooltip 展示)。 */
  run: DeploymentEventRun;
  /** 横向比例 0..1(左=最早,右=最近)。 */
  ratio: number;
}

/**
 * 把部署 startedAt 映射为 sparkline 内的横向比例。
 * 落在窗口外、或时间无效时返回 null。
 */
export function deploymentToRatio(
  startedAt: string,
  window: SparklineTimeWindow,
): number | null {
  const ts = new Date(startedAt).getTime();
  if (!Number.isFinite(ts)) return null;
  const windowStartMs = window.windowEndMs - window.windowMinutes * 60_000;
  const span = window.windowEndMs - windowStartMs;
  if (span <= 0) return null;
  if (ts < windowStartMs || ts > window.windowEndMs) return null;
  return (ts - windowStartMs) / span;
}

/**
 * 过滤并映射部署运行为 sparkline 标注;窗口内的事件按时间升序排列(左→右)。
 */
export function deploymentsInWindow(
  runs: DeploymentEventRun[],
  window: SparklineTimeWindow,
): DeploymentMarker[] {
  return runs
    .map((run) => {
      const ratio = deploymentToRatio(run.startedAt, window);
      return ratio === null ? null : ({ run, ratio } satisfies DeploymentMarker);
    })
    .filter((marker): marker is DeploymentMarker => marker !== null)
    .sort((a, b) => a.ratio - b.ratio);
}
