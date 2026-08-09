import { releaseOperationApprovalSelect } from "./release-operation-approval.select";

describe("releaseOperationApprovalSelect", () => {
  it("returns the protected action with the approval identity", () => {
    expect(releaseOperationApprovalSelect).toEqual({
      id: true,
      status: true,
      action: true,
      inputHash: true,
      requestedAt: true,
    });
  });
});
