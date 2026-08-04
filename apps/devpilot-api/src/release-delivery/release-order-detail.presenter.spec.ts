import { presentReleaseOrderDetail } from "./release-order-detail.presenter";
import { presentReleaseOrderResumeStep } from "./release-order-lifecycle.presenter";
import type { ReleaseOrderLifecyclePhase } from "./release-order-lifecycle.types";

describe("release order detail resume step", () => {
  it.each(["preflight", "build", "staging", "production"] as const)(
    "uses validated server resume step %s instead of raw relation counts",
    (resumeStep) => {
      expect(
        presentReleaseOrderDetail(detailInput(resumeStep)).resumeStep,
      ).toBe(resumeStep);
    },
  );

  it.each([null, "unknown", "BUILD", ""])(
    "rejects invalid SQL resume step %p",
    (value) => {
      expect(() => presentReleaseOrderResumeStep(value)).toThrow("resume step");
    },
  );
});

function detailInput(resumeStep: ReleaseOrderLifecyclePhase) {
  return {
    order: {
      id: "order-1",
      projectId: "project-1",
      releaseVersion: "2.4.1",
      note: null,
      createdAt: new Date("2026-08-05T00:00:00Z"),
      updatedAt: new Date("2026-08-05T00:00:00Z"),
      _count: { buildRuns: 9, manifests: 8, releaseRuns: 7 },
      project: {
        repositoryConnection: null,
        repositoryIdentity: null,
        environments: [],
      },
    },
    persistedStatus: "active" as const,
    lifecycle: {
      status: "failed" as const,
      phase: "build" as const,
      sourceType: "build_run" as const,
      sourceId: "build-9",
      sourceStatus: "failed",
      occurredAt: "2026-08-05T01:00:00.000Z",
      failureKind: "failed" as const,
    },
    resumeStep,
  };
}
