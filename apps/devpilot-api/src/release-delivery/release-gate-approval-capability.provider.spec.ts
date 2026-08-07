import { ReleaseGateApprovalCapabilityProvider } from "./release-gate-approval-capability.provider";
import type { ReleaseGateDefinition } from "./release-gate-catalog.types";
import type { ReleaseGateEvidenceContext } from "./release-gate-evidence.repository";

const NOW = new Date("2026-08-07T00:00:00.000Z");

describe("ReleaseGateApprovalCapabilityProvider (M10 D13/freeze pin)", () => {
  const provider = new ReleaseGateApprovalCapabilityProvider();

  it("checks an approved approval only when change window and freeze are verified", () => {
    const result = provider.evaluate(
      definition(),
      context({ changeWindowVerified: true, freezeVerified: true }),
      NOW,
    );
    expect(result.status).toBe("checked");
    expect(result.reasonCode).toBe("production_approval_valid");
  });

  it("fails closed when a real revision has no explicit freeze/change-window conclusions", () => {
    const result = provider.evaluate(
      definition(),
      context({ changeWindowVerified: false, freezeVerified: false }),
      NOW,
    );
    expect(result.status).toBe("unchecked");
    expect(result.reasonCode).toBe("release_protection_incomplete");
  });

  it("stays manual while the approval is pending regardless of protection", () => {
    const result = provider.evaluate(
      definition(),
      context({ changeWindowVerified: true, freezeVerified: true }, "pending"),
      NOW,
    );
    expect(result.status).toBe("manual");
  });
});

function definition() {
  return { capabilityId: "M10" } as unknown as ReleaseGateDefinition;
}

function context(
  protection: { changeWindowVerified: boolean; freezeVerified: boolean },
  approvalStatus: "approved" | "pending" = "approved",
) {
  return {
    projectId: "project-1",
    promote: {
      releaseRun: {
        id: "release-1",
        projectId: "project-1",
        environmentId: "production-1",
        inputHash: "hash-1",
        createdAt: new Date("2026-08-07T00:00:00.000Z"),
        policySnapshot: {
          releaseProtection: protection,
        },
        operationApproval: {
          id: "approval-1",
          projectId: "project-1",
          environmentId: "production-1",
          inputHash: "hash-1",
          status: approvalStatus,
          requestedAt: new Date("2026-08-07T00:00:00.000Z"),
          reviewedAt: approvalStatus === "approved"
            ? new Date("2026-08-07T00:10:00.000Z")
            : null,
          expiresAt: null,
        },
      },
    },
  } as unknown as ReleaseGateEvidenceContext;
}
