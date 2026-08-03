import "reflect-metadata";
import { ReleasePolicyRepository } from "./release-policy.repository";
import { PrismaService } from "../prisma/prisma.service";
import {
  cleanupProductionFixture,
  createProductionFixture,
  type ProductionFixture,
} from "./release-production.integration-fixture";

const describeIntegration = process.env.RUN_RELEASE_PRODUCTION_INTEGRATION === "1"
  ? describe
  : describe.skip;

describeIntegration("ReleasePolicyRepository integration", () => {
  let fixture: ProductionFixture;
  let repository: ReleasePolicyRepository;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    repository = new ReleasePolicyRepository(
      fixture.prisma as unknown as PrismaService,
    );
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("appends immutable revisions and rejects a stale concurrent pointer", async () => {
    const first = await repository.create(
      fixture.teamId,
      fixture.projectId,
      fixture.userId,
      { strategy: "standard", requireProductionApproval: true },
    );
    const attempts = await Promise.allSettled([
      repository.create(fixture.teamId, fixture.projectId, fixture.userId, {
        strategy: "standard",
        expectedCurrentRevisionId: first.id,
      }),
      repository.create(fixture.teamId, fixture.projectId, fixture.userId, {
        strategy: "standard",
        expectedCurrentRevisionId: first.id,
      }),
    ]);
    expect(attempts.filter((item) => item.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((item) => item.status === "rejected")).toHaveLength(1);
    await expect(fixture.prisma.releasePolicyRevision.count({
      where: { projectId: fixture.projectId },
    })).resolves.toBe(2);
    await expect(fixture.prisma.releasePolicyRevision.findUnique({
      where: { id: first.id },
      select: { revision: true, strategy: true, snapshotHash: true },
    })).resolves.toEqual({
      revision: 1,
      strategy: "standard",
      snapshotHash: first.snapshotHash,
    });
  });
});
