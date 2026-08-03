import { UnprocessableEntityException } from "@nestjs/common";
import { LegacyDeploymentWriteGuardService } from "./legacy-deployment-write-guard.service";

describe("LegacyDeploymentWriteGuardService", () => {
  const prisma = { project: { findFirst: jest.fn() } };
  const service = new LegacyDeploymentWriteGuardService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it("allows only projects that have not entered the governed delivery model", async () => {
    prisma.project.findFirst.mockResolvedValue({
      archivedAt: null,
      onboardingStatus: null,
      _count: { releaseOrders: 0 },
    });
    await expect(service.assertAllowed("team-1", "project-1")).resolves.toBeUndefined();
  });

  it.each([
    { archivedAt: new Date(), onboardingStatus: "ready", releaseOrders: 1 },
    { archivedAt: null, onboardingStatus: "ready", releaseOrders: 0 },
    { archivedAt: null, onboardingStatus: null, releaseOrders: 1 },
  ])("rejects archived or governed projects before branch deployment", async (input) => {
    prisma.project.findFirst.mockResolvedValue({
      archivedAt: input.archivedAt,
      onboardingStatus: input.onboardingStatus,
      _count: { releaseOrders: input.releaseOrders },
    });
    await expect(service.assertAllowed("team-1", "project-1"))
      .rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
