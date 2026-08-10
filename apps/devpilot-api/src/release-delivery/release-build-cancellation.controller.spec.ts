import { ReleaseBuildCancellationController } from "./release-build-cancellation.controller";

describe("ReleaseBuildCancellationController", () => {
  const cancellations = { cancel: jest.fn() };
  const access = { assertBuild: jest.fn() };
  const controller = new ReleaseBuildCancellationController(
    cancellations as never,
    access as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("uses the canonical Build permission and exact run scope", async () => {
    cancellations.cancel.mockResolvedValue({
      id: "run-1",
      status: "cancel_requested",
    });
    await expect(
      controller.cancel(
        { teamId: "team-1", user: { id: "user-1" } },
        "project-1",
        "order-1",
        "run-1",
      ),
    ).resolves.toEqual({ id: "run-1", status: "cancel_requested" });
    expect(access.assertBuild).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      projectId: "project-1",
    });
    expect(cancellations.cancel).toHaveBeenCalledWith({
      teamId: "team-1",
      projectId: "project-1",
      releaseOrderId: "order-1",
      buildRunId: "run-1",
    });
  });
});
