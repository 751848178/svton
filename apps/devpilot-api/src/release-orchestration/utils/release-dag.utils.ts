/**
 * 发布 DAG 纯函数：节点/边校验、拓扑排序、环检测。
 * 无 IO、无副作用，所有失败返回结构化错误。
 */

export interface ReleaseDagNode {
  key: string;
  name?: string;
}

export interface ReleaseDagEdge {
  from: string; // 依赖目标（上游）
  to: string; // 依赖方（下游）
}

export type ReleaseDagErrorKind =
  | "duplicate_key"
  | "missing_reference"
  | "self_dependency"
  | "cycle"
  | "empty";

export interface ReleaseDagError {
  kind: ReleaseDagErrorKind;
  message: string;
  details?: string[];
}

export type ReleaseDagResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReleaseDagError };

// 节点 key 唯一、引用存在、无自依赖、无环
export function validateReleaseDag(
  nodes: ReleaseDagNode[],
  edges: ReleaseDagEdge[],
): ReleaseDagResult<{ order: string[] }> {
  if (nodes.length === 0) {
    return {
      ok: false,
      error: { kind: "empty", message: "发布计划至少需要一个阶段" },
    };
  }

  const seen = new Map<string, ReleaseDagNode>();
  for (const node of nodes) {
    if (!node.key || !node.key.trim()) {
      return {
        ok: false,
        error: {
          kind: "duplicate_key",
          message: "阶段 key 不能为空",
          details: [JSON.stringify(node)],
        },
      };
    }
    if (seen.has(node.key)) {
      return {
        ok: false,
        error: {
          kind: "duplicate_key",
          message: `阶段 key 重复：${node.key}`,
        },
      };
    }
    seen.set(node.key, node);
  }

  const keys = new Set(seen.keys());
  for (const edge of edges) {
    if (!keys.has(edge.from)) {
      return {
        ok: false,
        error: {
          kind: "missing_reference",
          message: `依赖目标不存在：${edge.from}（被 ${edge.to} 引用）`,
        },
      };
    }
    if (!keys.has(edge.to)) {
      return {
        ok: false,
        error: {
          kind: "missing_reference",
          message: `依赖方不存在：${edge.to}（引用 ${edge.from}）`,
        },
      };
    }
    if (edge.from === edge.to) {
      return {
        ok: false,
        error: { kind: "self_dependency", message: `阶段不能依赖自身：${edge.from}` },
      };
    }
  }

  const cycle = detectCycle(nodes, edges);
  if (cycle.length > 0) {
    return {
      ok: false,
      error: {
        kind: "cycle",
        message: `发布阶段存在循环依赖：${cycle.join(" → ")}`,
        details: cycle,
      },
    };
  }

  const order = topologicalSort(nodes, edges);
  return { ok: true, value: { order } };
}

// Kahn 算法拓扑排序；输入已校验无环
export function topologicalSort(
  nodes: ReleaseDagNode[],
  edges: ReleaseDagEdge[],
): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    inDegree.set(node.key, 0);
    adjacency.set(node.key, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)!.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }
  // 同优先级按节点声明顺序保持稳定
  const queue = nodes
    .map((n) => n.key)
    .filter((k) => (inDegree.get(k) ?? 0) === 0);
  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    const next = adjacency.get(current) ?? [];
    for (const target of next) {
      const decremented = (inDegree.get(target) ?? 0) - 1;
      inDegree.set(target, decremented);
      if (decremented === 0) queue.push(target);
    }
  }
  return order;
}

// DFS 环检测，返回环上的节点 key 序列（不重复首尾）
export function detectCycle(
  nodes: ReleaseDagNode[],
  edges: ReleaseDagEdge[],
): string[] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.key, []);
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node.key, WHITE);

  const stack: string[] = [];
  let cycleFound: string[] = [];

  const visit = (key: string): boolean => {
    color.set(key, GRAY);
    stack.push(key);
    for (const next of adjacency.get(key) ?? []) {
      const c = color.get(next);
      if (c === GRAY) {
        const start = stack.indexOf(next);
        cycleFound = stack.slice(start).concat(next);
        return true;
      }
      if (c === WHITE && visit(next)) return true;
    }
    color.set(key, BLACK);
    stack.pop();
    return false;
  };

  for (const node of nodes) {
    if (color.get(node.key) === WHITE && visit(node.key)) break;
  }
  return cycleFound;
}

// 工具：把依赖边集合转为 DAG 边（from=被依赖的上游，to=依赖方）
export function dependencyEdgesToDagEdges(
  deps: Array<{ stageKey: string; dependsOnStageKey: string }>,
): ReleaseDagEdge[] {
  return deps.map((d) => ({ from: d.dependsOnStageKey, to: d.stageKey }));
}
