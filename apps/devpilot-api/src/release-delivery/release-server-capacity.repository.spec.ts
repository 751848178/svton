import { Prisma } from "@prisma/client";
import { ReleaseServerCapacityRepository } from "./release-server-capacity.repository";

describe("ReleaseServerCapacityRepository concurrent receipt", () => {
  const sampledAt = new Date("2026-08-12T06:00:00.000Z");
  const data = {
    teamId: "team-1", projectId: "project-1", environmentId: "env-1",
    configRevisionId: "revision-1", buildRunId: "build-1", manifestId: "manifest-1",
    providerKey: "local-filesystem-v1", bindingId: "binding-1",
    deploymentInputHash: "deployment-hash", workloadInputHash: "workload-hash",
    requirementHash: "requirement-hash", sampledBucket: sampledAt,
    measurementHash: "measurement-hash", status: "fit", requirements: {},
    measurement: {}, reasonCode: "capacity_fit_local_single_tenant",
    sampledAt, expiresAt: new Date(sampledAt.getTime() + 300_000),
  };

  it("returns only the exact winner after a unique race", async () => {
    const winner = { id: "winner", ...data };
    const prisma = { serverCapacitySnapshot: {
      create: jest.fn().mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
        "unique", { code: "P2002", clientVersion: "5.22.0" },
      )),
      findFirst: jest.fn().mockResolvedValue(winner),
    } };
    await expect(new ReleaseServerCapacityRepository(prisma as never).create(data))
      .resolves.toBe(winner);
    expect(prisma.serverCapacitySnapshot.findFirst).toHaveBeenCalledWith({ where: {
      deploymentInputHash: "deployment-hash", workloadInputHash: "workload-hash",
      requirementHash: "requirement-hash", providerKey: "local-filesystem-v1",
      bindingId: "binding-1", sampledBucket: sampledAt,
    } });
  });

  it("does not swallow a non-unique database failure", async () => {
    const failure = new Error("database unavailable");
    const prisma = { serverCapacitySnapshot: {
      create: jest.fn().mockRejectedValue(failure), findFirst: jest.fn(),
    } };
    await expect(new ReleaseServerCapacityRepository(prisma as never).create(data))
      .rejects.toBe(failure);
    expect(prisma.serverCapacitySnapshot.findFirst).not.toHaveBeenCalled();
  });
});
