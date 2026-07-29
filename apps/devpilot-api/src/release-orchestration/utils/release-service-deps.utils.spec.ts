import { readServiceReleaseDependencies } from "./release-service-deps.utils";

describe("readServiceReleaseDependencies (P0-2a non-array fail-closed)", () => {
  it("returns empty when releaseDependencies absent (back-compat)", () => {
    const r = readServiceReleaseDependencies({ deployCommand: "x" });
    expect(r).toEqual({ edges: [], errors: [] });
  });

  it("blocks when top-level releaseDependencies is a string", () => {
    const r = readServiceReleaseDependencies({ releaseDependencies: "bad" });
    expect(r.edges).toEqual([]);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toEqual(
      expect.objectContaining({
        code: "RELEASE_DEP_INVALID_FIELD_TYPE",
        field: "releaseDependencies",
        invalidValue: "bad",
      }),
    );
    expect(r.errors[0].reason).toContain("顶层");
    expect(r.errors[0].suggestedAction).toMatch(/必须是数组/);
  });

  it("blocks when top-level releaseDependencies is an object", () => {
    const r = readServiceReleaseDependencies({
      releaseDependencies: { toServiceId: "x" },
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].code).toBe("RELEASE_DEP_INVALID_FIELD_TYPE");
    expect(r.errors[0].invalidValue).toEqual({ toServiceId: "x" });
  });

  it("blocks when deployment.releaseDependencies is non-array", () => {
    const r = readServiceReleaseDependencies({
      deployment: { releaseDependencies: 42 },
    });
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].code).toBe("RELEASE_DEP_INVALID_FIELD_TYPE");
    expect(r.errors[0].reason).toContain("deployment 子层");
    expect(r.errors[0].invalidValue).toBe(42);
  });

  it("blocks on BOTH layers when both are non-array", () => {
    const r = readServiceReleaseDependencies({
      releaseDependencies: "bad",
      deployment: { releaseDependencies: { x: 1 } },
    });
    expect(r.errors).toHaveLength(2);
    expect(r.errors.every((e) => e.code === "RELEASE_DEP_INVALID_FIELD_TYPE")).toBe(true);
  });

  it("still parses a valid array normally", () => {
    const r = readServiceReleaseDependencies({
      releaseDependencies: [
        {
          toServiceId: "svc-b",
          fromStageType: "health_check",
          toStageType: "application_deploy",
          conditionType: "succeeded",
          required: true,
        },
      ],
    });
    expect(r.errors).toEqual([]);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0].toServiceId).toBe("svc-b");
  });

  it("non-object deployConfig returns empty (no field present)", () => {
    expect(readServiceReleaseDependencies(null)).toEqual({ edges: [], errors: [] });
    expect(readServiceReleaseDependencies("string")).toEqual({
      edges: [],
      errors: [],
    });
    expect(readServiceReleaseDependencies([])).toEqual({ edges: [], errors: [] });
  });
});
