import { presentReleaseOrderLifecycle } from "./release-order-lifecycle.presenter";
import type { ReleaseOrderLifecycleRow } from "./release-order-lifecycle.types";

describe("presentReleaseOrderLifecycle", () => {
  it("presents the persisted and server-derived lifecycle separately", () => {
    expect(presentReleaseOrderLifecycle(row())).toEqual({
      persistedStatus: "active",
      lifecycle: {
        status: "awaiting_approval",
        phase: "production",
        sourceType: "release_run",
        sourceId: "release-run-1",
        sourceStatus: "awaiting_approval",
        occurredAt: "2026-08-04T08:00:00.000Z",
      },
    });
  });

  it.each([
    ["persistedStatus", "paused", "persisted status"],
    ["lifecycleStatus", "active", "lifecycle status"],
    ["lifecyclePhase", "approval", "lifecycle phase"],
    ["lifecycleSourceType", "gate", "lifecycle source"],
    ["lifecycleFailureKind", "unknown", "failure kind"],
  ] as const)("fails closed for an invalid %s", (field, value, message) => {
    expect(() =>
      presentReleaseOrderLifecycle({ ...row(), [field]: value }),
    ).toThrow(message);
  });

  it("fails closed instead of emitting a nullable or invalid occurredAt", () => {
    expect(() =>
      presentReleaseOrderLifecycle({
        ...row(),
        lifecycleOccurredAt: null as unknown as Date,
      }),
    ).toThrow("invalid timestamp");
    expect(() =>
      presentReleaseOrderLifecycle({
        ...row(),
        lifecycleOccurredAt: new Date("invalid"),
      }),
    ).toThrow("invalid timestamp");
  });

  it("emits failureKind only for a validated failed lifecycle", () => {
    expect(
      presentReleaseOrderLifecycle({
        ...row(),
        lifecycleStatus: "failed",
        lifecyclePhase: "staging",
        lifecycleSourceType: "deployment_run",
        lifecycleSourceId: "deployment-1",
        lifecycleSourceStatus: "blocked",
        lifecycleFailureKind: "blocked",
      }).lifecycle,
    ).toMatchObject({ status: "failed", failureKind: "blocked" });
    expect(presentReleaseOrderLifecycle(row()).lifecycle).not.toHaveProperty(
      "failureKind",
    );
  });
});

function row(): ReleaseOrderLifecycleRow {
  return {
    persistedStatus: "active",
    lifecycleStatus: "awaiting_approval",
    lifecyclePhase: "production",
    lifecycleSourceType: "release_run",
    lifecycleSourceId: "release-run-1",
    lifecycleSourceStatus: "awaiting_approval",
    lifecycleOccurredAt: new Date("2026-08-04T08:00:00.000Z"),
    lifecycleFailureKind: null,
  };
}
