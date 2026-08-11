import { SourcePolicyRevisionRepository } from "./source-policy-revision.repository";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";

describe("SourcePolicyRevisionRepository", () => {
  it("persists a full v2 snapshot and reuses only its exact hash", async () => {
    const fixture = setup();
    const repository = new SourcePolicyRevisionRepository(fixture.prisma as never);
    await repository.resolveRegistered("team-1", "project-1", profile());
    expect(fixture.tx.sourcePolicyRevision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        snapshotVersion: 2,
        snapshot: expect.objectContaining({
          schemaVersion: 2,
          runnerVersion: "runner-v2",
          scanners: [expect.objectContaining({ rulesDigest: "rules-1" })],
        }),
        snapshotHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(fixture.tx.project.update).toHaveBeenCalledWith({
      where: { id: "project-1" },
      data: { currentSourcePolicyRevisionId: "policy-created" },
    });
  });

  it("selects a different immutable identity when scanner policy drifts", async () => {
    const first = setup();
    const second = setup();
    await new SourcePolicyRevisionRepository(first.prisma as never)
      .resolveRegistered("team-1", "project-1", profile());
    await new SourcePolicyRevisionRepository(second.prisma as never)
      .resolveRegistered("team-1", "project-1", {
        ...profile(),
        scanners: [{ ...profile().scanners[0], rulesDigest: "rules-2" }],
      });
    const firstKey = first.tx.sourcePolicyRevision.findUnique.mock.calls[0][0]
      .where.projectId_profileId_profileVersion_snapshotHash.snapshotHash;
    const secondKey = second.tx.sourcePolicyRevision.findUnique.mock.calls[0][0]
      .where.projectId_profileId_profileVersion_snapshotHash.snapshotHash;
    expect(firstKey).not.toBe(secondKey);
  });
});

function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: "project-1" }]),
    sourcePolicyRevision: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ revision: 1 }),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: "policy-created",
        ...data,
      })),
    },
    project: { update: jest.fn().mockResolvedValue({ id: "project-1" }) },
  };
  return {
    tx,
    prisma: {
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    },
  };
}

function profile(): RegisteredReleaseBuildProfile {
  return {
    id: "controlled-local-acceptance-v2",
    profileVersion: 2,
    runnerVersion: "runner-v2",
    externalRequiredChecks: 0,
    requiredIndependentApprovals: 2,
    highRiskPathPrefixes: ["infra/"],
    packageManagers: {},
    scanners: [{
      id: "secretScan", executable: "/opt/scanner", argvTemplate: ["scan"],
      toolVersion: "1.0.0", rulesDigest: "rules-1",
    }],
  };
}
