import { productionApprovalData } from "./release-production-approval.model";

describe("production approval model", () => {
  it("records an auditable automatic approval for the basic flow", () => {
    const data = productionApprovalData(
      { teamId: "team-1", actorId: "actor-1", projectId: "project-1" },
      {
        environment: { id: "production-1" },
        releaseOrder: { releaseVersion: "1.0.0" },
        build: { revision: 1 },
      },
      "release-run-1",
      "input-hash",
    );

    expect(data).toMatchObject({
      status: "approved",
      requesterId: "actor-1",
      reviewerId: "actor-1",
      targetId: "release-run-1",
      metadata: { autoApprovedByReleaseFlow: "basic_v1" },
    });
  });
});
