import { completeVersionedDeployment } from "./environment-version-write.utils";

describe("completeVersionedDeployment terminal transition", () => {
  it("runs append-only persistence only for the winning terminal CAS", async () => {
    const tx = {
      deploymentRun: {
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 }),
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValueOnce({
            id: "deployment-1",
            teamId: "team-1",
            projectId: "project-1",
            environmentId: "environment-1",
            artifactManifestId: "manifest-1",
            releaseRunId: null,
            artifactManifest: { releaseOrderId: "order-1" },
          })
          .mockResolvedValueOnce({ status: "failed" }),
      },
    };
    const persistAttempt = jest.fn().mockResolvedValue(undefined);
    const input = {
      deploymentRunId: "deployment-1",
      status: "failed" as const,
      kind: "upgrade" as const,
      logs: ["route provider unavailable"],
      error: "SITE_ROUTE_ACTIVATION_FAILED",
    };

    await expect(
      completeVersionedDeployment(tx as never, input, persistAttempt),
    ).resolves.toEqual({ version: null, transitioned: true });
    await expect(
      completeVersionedDeployment(tx as never, input, persistAttempt),
    ).resolves.toEqual({ version: null, transitioned: false });
    expect(persistAttempt).toHaveBeenCalledTimes(1);
  });
});
