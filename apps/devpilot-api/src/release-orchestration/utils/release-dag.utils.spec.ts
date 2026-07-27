import {
  validateReleaseDag,
  topologicalSort,
  detectCycle,
  dependencyEdgesToDagEdges,
} from "./release-dag.utils";

const N = (...keys: string[]) => keys.map((key) => ({ key }));

describe("release-dag validateReleaseDag", () => {
  it("accepts a linear chain", () => {
    const r = validateReleaseDag(
      N("a", "b", "c"),
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
      ],
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.order).toEqual(["a", "b", "c"]);
  });

  it("accepts branches and joins (diamond)", () => {
    // a -> b, a -> c, b -> d, c -> d
    const r = validateReleaseDag(
      N("a", "b", "c", "d"),
      [
        { from: "a", to: "b" },
        { from: "a", to: "c" },
        { from: "b", to: "d" },
        { from: "c", to: "d" },
      ],
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.order[0]).toBe("a");
      expect(r.value.order[3]).toBe("d");
      expect(new Set(r.value.order.slice(1, 3))).toEqual(new Set(["b", "c"]));
    }
  });

  it("rejects empty nodes", () => {
    const r = validateReleaseDag([], []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("empty");
  });

  it("rejects duplicate keys", () => {
    const r = validateReleaseDag(N("a", "a"), []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("duplicate_key");
  });

  it("rejects empty key", () => {
    const r = validateReleaseDag([{ key: "" }, { key: "x" }], []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("duplicate_key");
  });

  it("rejects missing reference (edge target absent)", () => {
    const r = validateReleaseDag(N("a"), [{ from: "a", to: "ghost" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("missing_reference");
  });

  it("rejects self dependency", () => {
    const r = validateReleaseDag(N("a"), [{ from: "a", to: "a" }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("self_dependency");
  });

  it("rejects cycle and reports the path", () => {
    const r = validateReleaseDag(
      N("a", "b", "c"),
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("cycle");
      expect(r.error.details).toEqual(["a", "b", "c", "a"]);
    }
  });

  it("dependencyEdgesToDagEdges maps stage->dependsOn into from/to", () => {
    const edges = dependencyEdgesToDagEdges([
      { stageKey: "deploy", dependsOnStageKey: "migration" },
    ]);
    expect(edges).toEqual([{ from: "migration", to: "deploy" }]);
  });
});

describe("release-dag topologicalSort / detectCycle", () => {
  it("returns stable order for disconnected nodes", () => {
    const order = topologicalSort(N("x", "y", "z"), []);
    expect(order).toEqual(["x", "y", "z"]);
  });

  it("detectCycle returns empty for DAG", () => {
    expect(
      detectCycle(N("a", "b"), [{ from: "a", to: "b" }]),
    ).toEqual([]);
  });

  it("detectCycle returns the cycle path", () => {
    const cycle = detectCycle(
      N("a", "b", "c"),
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    );
    expect(cycle.length).toBeGreaterThan(0);
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
  });
});
