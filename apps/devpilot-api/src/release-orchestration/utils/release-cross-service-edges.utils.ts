/**
 * 跨服务依赖边解析（纯函数）：把声明式的 serviceDependencies 翻译成具体阶段键边。
 * Devpilot 不推断服务间依赖——由调用方在 ReleasePlanBuildInput.serviceDependencies 显式声明。
 */
import type { ReleaseDependency } from "./release-plan-builder.utils";
import type {
  ReleaseDependencyConditionType,
  ReleaseStageType,
} from "../types/release-orchestration.types";

// 一条跨服务声明边：from 阶段（上游）→ to 阶段（下游）
export interface ServiceDependencyEdge {
  fromServiceId: string;
  fromStageType: ReleaseStageType;
  toServiceId: string;
  toStageType: ReleaseStageType;
  conditionType: ReleaseDependencyConditionType;
  required?: boolean;
}

// 工厂阶段键模板：<stageType>:<applicationServiceId>
export function stageKeyOf(stageType: ReleaseStageType, serviceId: string): string {
  return `${stageType}:${serviceId}`;
}

// 解析跨服务边：引用不存在的 service/stageType → 返回 missing_reference 错误
export function resolveCrossServiceEdges(
  edges: ServiceDependencyEdge[],
  knownStageKeys: Set<string>,
):
  | { ok: true; edges: ReleaseDependency[] }
  | { ok: false; kind: "missing_reference"; message: string } {
  const resolved: ReleaseDependency[] = [];
  for (const edge of edges) {
    const fromKey = stageKeyOf(edge.fromStageType, edge.fromServiceId);
    const toKey = stageKeyOf(edge.toStageType, edge.toServiceId);
    if (!knownStageKeys.has(fromKey)) {
      return {
        ok: false,
        kind: "missing_reference",
        message: `跨服务依赖的上游阶段不存在：${fromKey}（被 ${toKey} 引用）`,
      };
    }
    if (!knownStageKeys.has(toKey)) {
      return {
        ok: false,
        kind: "missing_reference",
        message: `跨服务依赖的下游阶段不存在：${toKey}（引用 ${fromKey}）`,
      };
    }
    resolved.push({
      stageKey: toKey,
      dependsOnStageKey: fromKey,
      conditionType: edge.conditionType,
      required: edge.required ?? true,
    });
  }
  return { ok: true, edges: resolved };
}
