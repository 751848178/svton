/**
 * 跨服务依赖 → 人能理解的中文描述（P0-1 §7）。
 *
 * 单一职责：把 preview.dependencies 的 stageKey 边翻译成「上游阶段 → 下游阶段」的
 * 自然语言，例如 backend 的 health_check 成功后才执行 admin 的应用部署：
 *   「就绪检查 - Backend 成功后，才会执行应用部署 - Admin」
 *
 * 纯函数，无副作用；依赖调用方提供 stageKey → {name,type,applicationServiceId} 映射。
 */
import { DEPENDENCY_CONDITION_LABEL } from './release-labels';

export interface DependencyStageView {
  key: string;
  name: string;
  type: string;
  applicationServiceId?: string | null;
}

export interface DependencyEdgeView {
  stageKey: string;
  dependsOnStageKey: string;
  conditionType: string;
  required: boolean;
}

/**
 * 把单条依赖边翻译成中文描述。
 * @param edge 依赖边
 * @param stageByKey 所有阶段的 key→视图映射
 * @returns 中文描述；找不到端点时回退到 key 形式
 */
export function describeDependency(
  edge: DependencyEdgeView,
  stageByKey: Map<string, DependencyStageView>,
): string {
  const upstream = stageByKey.get(edge.dependsOnStageKey);
  const downstream = stageByKey.get(edge.stageKey);
  const cond = DEPENDENCY_CONDITION_LABEL[edge.conditionType] ?? edge.conditionType;
  // 端点缺失时不向用户暴露原始 cuid 阶段键（如 application_deploy:cmr_abc），渲染占位。
  const upLabel = upstream ? upstream.name : '（未知上游阶段）';
  const downLabel = downstream ? downstream.name : '（未知下游阶段）';
  const optional = edge.required ? '' : '（可选：跳过该上游后仍会继续）';
  return `${upLabel} ${cond}，才会执行${downLabel}${optional}`;
}

/**
 * 把全部跨服务依赖边翻译成中文描述列表，并按上游→下游稳定排序，便于展示。
 * 只返回「跨服务」边（上下游属于不同 service）；同服务内的链边由阶段顺序自然表达。
 */
export function describeCrossServiceDependencies(
  edges: DependencyEdgeView[],
  stages: DependencyStageView[],
): string[] {
  const stageByKey = new Map(stages.map((s) => [s.key, s]));
  const serviceOf = (key: string): string | undefined => {
    const s = stageByKey.get(key);
    return s?.applicationServiceId ?? undefined;
  };
  const cross = edges.filter((e) => {
    const a = serviceOf(e.dependsOnStageKey);
    const b = serviceOf(e.stageKey);
    return a && b && a !== b;
  });
  cross.sort((a, b) => {
    const sa = a.dependsOnStageKey + a.stageKey;
    const sb = b.dependsOnStageKey + b.stageKey;
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  return cross.map((e) => describeDependency(e, stageByKey));
}
