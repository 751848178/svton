import { ReleaseGatePromoteEvidenceRepository } from "./release-gate-promote-evidence.repository";

describe("ReleaseGatePromoteEvidenceRepository", () => {
  it("keeps alerts environment-scoped and loads only the exact DNS receipt", async () => {
    const prisma = fixture();
    const repository = new ReleaseGatePromoteEvidenceRepository(prisma as never);
    await repository.load(
      "team-1", "project-1", "order-1", "release-1", "dns-exact",
    );
    expect(prisma.alertEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          teamId: "team-1", projectId: "project-1", environmentId: "prod-1",
        },
      }),
    );
    expect(prisma.siteDnsProbeReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "dns-exact" }),
        take: 1,
      }),
    );
  });
});

function fixture() {
  const empty = jest.fn().mockResolvedValue([]);
  return {
    projectEnvironment: { findFirst: jest.fn().mockResolvedValue({
      id: "prod-1", currentConfigRevision: null,
      currentEnvironmentVersion: null, environmentVersions: [],
    }) },
    releaseRun: { findFirst: jest.fn().mockResolvedValue(null) },
    site: { findMany: empty },
    alertEvent: { findMany: jest.fn().mockResolvedValue([]) },
    logCollectionRun: { findMany: empty },
    resourceMetricSnapshot: { findMany: empty },
    siteRouteSwitchRun: { findMany: empty },
    siteDnsProbeReceipt: { findMany: jest.fn().mockResolvedValue([]) },
  };
}
