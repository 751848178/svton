import {
  canonicalJson,
  stableHash,
  computePlanHash,
  computeStageConfigHash,
  computeIdempotencyKey,
  computeApprovalInputHash,
} from "./release-hash.utils";

describe("release-hash canonicalJson", () => {
  it("is stable regardless of key order", () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it("handles nested objects and arrays", () => {
    expect(canonicalJson({ x: [{ b: 2, a: 1 }] })).toBe(
      canonicalJson({ x: [{ a: 1, b: 2 }] }),
    );
  });
});

describe("release-hash stableHash", () => {
  it("produces 64-char hex", () => {
    expect(stableHash({ a: 1 })).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs for different input", () => {
    expect(stableHash({ a: 1 })).not.toBe(stableHash({ a: 2 }));
  });
});

describe("release-hash key builders", () => {
  it("plan hash stable for same snapshot", () => {
    expect(computePlanHash({ a: 1 })).toBe(computePlanHash({ a: 1 }));
  });

  it("stage config hash differs for different config", () => {
    expect(computeStageConfigHash({ cmd: "a" })).not.toBe(
      computeStageConfigHash({ cmd: "b" }),
    );
  });

  it("idempotency key combines plan+stage+config", () => {
    const k1 = computeIdempotencyKey("p1", "s1", "c1");
    const k2 = computeIdempotencyKey("p1", "s1", "c2");
    expect(k1).not.toBe(k2);
  });

  it("approval input hash differs when config changes", () => {
    const h1 = computeApprovalInputHash({
      releasePlanId: "p1",
      stageKey: "s1",
      environmentId: "e1",
      configHash: "c1",
    });
    const h2 = computeApprovalInputHash({
      releasePlanId: "p1",
      stageKey: "s1",
      environmentId: "e1",
      configHash: "c2",
    });
    expect(h1).not.toBe(h2);
  });
});
