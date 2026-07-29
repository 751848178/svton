import {
  readOutputPath,
  evaluateOutputRule,
  evaluateDependencyCondition,
  deriveStageReadiness,
} from "./release-readiness.utils";
import type { ReleaseStageFacts } from "../types/release-orchestration.types";

const baseFacts = (over: Partial<ReleaseStageFacts>): ReleaseStageFacts => ({
  stageId: "s1",
  status: "pending",
  required: true,
  currentAttempt: 0,
  hasActiveAttempt: false,
  dependencies: [],
  dependencyStates: [],
  approvalSatisfied: true,
  releaseExecutable: true,
  concurrencyAvailable: true,
  ...over,
});

describe("release-readiness output path", () => {
  it("reads nested values path", () => {
    expect(
      readOutputPath(
        { schemaVersion: 1, values: { migrationCount: 5 } },
        "values.migrationCount",
      ),
    ).toBe(5);
  });

  it("returns undefined for missing path", () => {
    expect(readOutputPath({ schemaVersion: 1 }, "values.x")).toBeUndefined();
  });

  // F383 Slice 1/invest-2 §E.1: readOutputPath 第一段白名单限制为 values|metrics，
  // 阻止把人工摘要/制品/schemaVersion 当成就绪判据。
  it("whitelists values and metrics roots", () => {
    const out = {
      schemaVersion: 1,
      values: { ok: true, count: 7 },
      metrics: { latency: 12 },
    } as const;
    expect(readOutputPath(out, "values.ok")).toBe(true);
    expect(readOutputPath(out, "values.count")).toBe(7);
    expect(readOutputPath(out, "metrics.latency")).toBe(12);
  });

  it("returns undefined for non-whitelisted roots", () => {
    const out: {
      schemaVersion: number;
      summary?: string;
      values?: Record<string, unknown>;
      metrics?: Record<string, number>;
      artifacts?: Array<{ name: string; ref?: string }>;
    } = {
      schemaVersion: 1,
      summary: "ok",
      values: { count: 1 },
      artifacts: [{ name: "a", ref: "r" }],
    };
    expect(readOutputPath(out, "summary")).toBeUndefined();
    expect(readOutputPath(out, "artifacts.0.name")).toBeUndefined();
    expect(readOutputPath(out, "schemaVersion")).toBeUndefined();
    expect(readOutputPath(out, "unknown.path")).toBeUndefined();
  });

  it("returns undefined for empty/missing path even if root whitelisted", () => {
    expect(readOutputPath({ schemaVersion: 1, values: { a: 1 } }, "")).toBe(
      undefined,
    );
    expect(readOutputPath(null, "values.x")).toBeUndefined();
    expect(readOutputPath(undefined, "values.x")).toBeUndefined();
  });
});

describe("release-readiness evaluateOutputRule", () => {
  const out = {
    schemaVersion: 1,
    values: { count: 10, ok: true, name: "v1" },
  } as const;

  it("eq / ne / exists / bool", () => {
    expect(
      evaluateOutputRule(out, { path: "values.name", operator: "eq", value: "v1" }),
    ).toBe(true);
    expect(
      evaluateOutputRule(out, { path: "values.name", operator: "ne", value: "v2" }),
    ).toBe(true);
    expect(
      evaluateOutputRule(out, { path: "values.count", operator: "exists" }),
    ).toBe(true);
    expect(
      evaluateOutputRule(out, { path: "values.ok", operator: "bool_true" }),
    ).toBe(true);
    expect(
      evaluateOutputRule(out, { path: "values.ok", operator: "bool_false" }),
    ).toBe(false);
  });

  it("numeric comparisons", () => {
    expect(
      evaluateOutputRule(out, { path: "values.count", operator: "gt", value: 5 }),
    ).toBe(true);
    expect(
      evaluateOutputRule(out, { path: "values.count", operator: "lt", value: 5 }),
    ).toBe(false);
    expect(
      evaluateOutputRule(out, { path: "values.count", operator: "gte", value: 10 }),
    ).toBe(true);
    expect(
      evaluateOutputRule(out, { path: "values.count", operator: "lte", value: 9 }),
    ).toBe(false);
  });

  it("numeric comparison against non-number returns false", () => {
    expect(
      evaluateOutputRule(out, { path: "values.name", operator: "gt", value: 1 }),
    ).toBe(false);
  });
});

describe("release-readiness evaluateDependencyCondition", () => {
  it("succeeded requires dep succeeded", () => {
    expect(evaluateDependencyCondition("succeeded", "succeeded", null, false)).toBe(
      true,
    );
    expect(evaluateDependencyCondition("succeeded", "failed", null, false)).toBe(
      false,
    );
  });

  it("completed accepts succeeded or skipped", () => {
    expect(evaluateDependencyCondition("completed", "skipped", null, false)).toBe(
      true,
    );
    expect(evaluateDependencyCondition("completed", "succeeded", null, false)).toBe(
      true,
    );
    expect(evaluateDependencyCondition("completed", "failed", null, false)).toBe(
      false,
    );
  });

  it("approved requires depApprovalApproved", () => {
    expect(evaluateDependencyCondition("approved", "succeeded", null, true)).toBe(
      true,
    );
    expect(evaluateDependencyCondition("approved", "succeeded", null, false)).toBe(
      false,
    );
  });

  it("output_match all rules must pass", () => {
    const out = { schemaVersion: 1, values: { n: 3 } };
    expect(
      evaluateDependencyCondition(
        "output_match",
        "succeeded",
        out,
        false,
        [{ path: "values.n", operator: "gt", value: 1 }],
      ),
    ).toBe(true);
    expect(
      evaluateDependencyCondition(
        "output_match",
        "succeeded",
        out,
        false,
        [
          { path: "values.n", operator: "gt", value: 1 },
          { path: "values.n", operator: "lt", value: 2 },
        ],
      ),
    ).toBe(false);
  });
});

describe("release-readiness deriveStageReadiness", () => {
  it("ready when all conditions met", () => {
    expect(
      deriveStageReadiness(
        baseFacts({
          dependencies: [
            { stageId: "s1", dependsOnStageId: "d1", conditionType: "succeeded" },
          ],
          dependencyStates: [
            { dependsOnStageId: "d1", status: "succeeded" },
          ],
        }),
      ).ready,
    ).toBe(true);
  });

  it("blocked when dependency unmet", () => {
    const r = deriveStageReadiness(
      baseFacts({
        dependencies: [
          { stageId: "s1", dependsOnStageId: "d1", conditionType: "succeeded" },
        ],
        dependencyStates: [{ dependsOnStageId: "d1", status: "failed" }],
      }),
    );
    expect(r.ready).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.blockedReason).toContain("d1");
  });

  it("awaiting approval when approval unmet and deps ok", () => {
    const r = deriveStageReadiness(
      baseFacts({ approvalSatisfied: false }),
    );
    expect(r.ready).toBe(false);
    expect(r.awaitingApproval).toBe(true);
  });

  it("not ready when has active attempt", () => {
    const r = deriveStageReadiness(baseFacts({ hasActiveAttempt: true }));
    expect(r.ready).toBe(false);
    expect(r.blocked).toBe(false);
  });

  it("terminal status never ready", () => {
    expect(deriveStageReadiness(baseFacts({ status: "succeeded" })).ready).toBe(
      false,
    );
    expect(deriveStageReadiness(baseFacts({ status: "skipped" })).ready).toBe(
      false,
    );
  });

  it("blocked when concurrency unavailable", () => {
    const r = deriveStageReadiness(baseFacts({ concurrencyAvailable: false }));
    expect(r.blocked).toBe(true);
    expect(r.blockedReason).toContain("并发");
  });

  it("blocked when release not executable", () => {
    const r = deriveStageReadiness(baseFacts({ releaseExecutable: false }));
    expect(r.blocked).toBe(true);
  });

  it("blocked when dependency state missing", () => {
    const r = deriveStageReadiness(
      baseFacts({
        dependencies: [
          { stageId: "s1", dependsOnStageId: "ghost", conditionType: "succeeded" },
        ],
        dependencyStates: [],
      }),
    );
    expect(r.blocked).toBe(true);
    expect(r.blockedReason).toContain("ghost");
  });
});
