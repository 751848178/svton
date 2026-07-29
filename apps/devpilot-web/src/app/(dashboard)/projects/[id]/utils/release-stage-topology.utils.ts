/**
 * 发布编排 — 阶段 DAG 拓扑排序（F383, invest-3 §E.4）
 *
 * 单一职责：客户端 Kahn 拓扑排序，按依赖顺序排列阶段，而非 createdAt。
 * 纯函数，仅依赖输入 stages + 各自 dependencies（dependsOnStageId）。
 * 检测到环时回退到原始顺序（不抛错，保证渲染可见）。
 */
import type { ReleaseStage } from '../types/releases';

/**
 * 对阶段数组做拓扑排序：依赖（dependsOnStageId）在前，被依赖者在后。
 * 同层之间保持原数组的相对顺序（稳定）。
 */
export function topologicalSortStages(stages: ReleaseStage[]): ReleaseStage[] {
  if (stages.length <= 1) return stages.slice();
  const idToStage = new Map<string, ReleaseStage>();
  for (const s of stages) idToStage.set(s.id, s);

  // 仅保留在本批次内、且确实存在的依赖边。
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const s of stages) {
    inDegree.set(s.id, 0);
    adj.set(s.id, []);
  }
  for (const s of stages) {
    for (const dep of s.dependencies ?? []) {
      const fromId = dep.dependsOnStageId;
      if (!idToStage.has(fromId)) continue; // 依赖外部/历史阶段，忽略
      adj.get(fromId)!.push(s.id);
      inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
    }
  }

  // Kahn：入度 0 的先入队，按原数组顺序保持稳定。
  const queue: string[] = stages.filter((s) => (inDegree.get(s.id) ?? 0) === 0).map((s) => s.id);
  const ordered: ReleaseStage[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const stage = idToStage.get(id);
    if (stage) ordered.push(stage);
    for (const next of adj.get(id) ?? []) {
      const d = (inDegree.get(next) ?? 0) - 1;
      inDegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  // 环或未覆盖到的阶段，按原顺序补在末尾。
  if (ordered.length < stages.length) {
    for (const s of stages) if (!seen.has(s.id)) ordered.push(s);
  }
  return ordered;
}
