import { validateServiceOwnership } from "./release-env-validation.utils";

describe("validateServiceOwnership (env-consistency predicate)", () => {
  it("ok when service environmentId equals plan target", () => {
    expect(
      validateServiceOwnership(
        { applicationServiceId: "svc-1", environmentId: "env-prod" },
        "env-prod",
      ),
    ).toEqual({ ok: true });
  });

  it("mismatch when environmentId differs from plan target", () => {
    const r = validateServiceOwnership(
      { applicationServiceId: "svc-1", environmentId: "env-dev" },
      "env-prod",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("RELEASE_ENVIRONMENT_MISMATCH");
    expect(r.message).toContain("svc-1");
  });

  it("mismatch when environmentId is null/empty (no implicit match)", () => {
    const r1 = validateServiceOwnership(
      { applicationServiceId: "svc-1", environmentId: null },
      "env-prod",
    );
    expect(r1.ok).toBe(false);
    if (r1.ok) return;
    expect(r1.code).toBe("RELEASE_ENVIRONMENT_MISMATCH");

    const r2 = validateServiceOwnership(
      { applicationServiceId: "svc-1", environmentId: undefined },
      "env-prod",
    );
    expect(r2.ok).toBe(false);

    const r3 = validateServiceOwnership(
      { applicationServiceId: "svc-1", environmentId: "" },
      "env-prod",
    );
    expect(r3.ok).toBe(false);
  });
});
