import "reflect-metadata";
import {
  cleanupProductionFixture,
  createProductionFixture,
  ProductionFixture,
} from "./release-production.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_PRODUCTION_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ReleaseProduction integration", () => {
  let fixture: ProductionFixture;

  beforeAll(async () => {
    fixture = await createProductionFixture();
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("freezes one exact Production input and creates one approval under concurrency", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const input = {
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `concurrent-${f.suffix}`,
    };
    const [first, second] = await Promise.all([
      f.repository.confirm(input),
      f.repository.confirm(input),
    ]);
    expect(second.id).toBe(first.id);
    expect(first.status).toBe("awaiting_approval");
    expect(first.operationApproval).toMatchObject({
      status: "pending",
      inputHash: preview.inputHash,
    });
    await expect(
      f.prisma.releaseRun.count({
        where: {
          releaseOrderId: f.orderId,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    ).resolves.toBe(1);
  });

  it("rejects cross-project lookup and an unknown Digest", async () => {
    const f = fixture;
    await expect(
      f.repository.preview(f.teamId, "other-project", f.orderId, f.manifestId),
    ).rejects.toThrow();
    await f.prisma.artifactManifestItem.update({
      where: { id: f.itemId },
      data: { digest: "sha256:unknown" },
    });
    await expect(
      f.repository.preview(f.teamId, f.projectId, f.orderId, f.manifestId),
    ).rejects.toThrow("Manifest Digest 未知");
    await f.prisma.artifactManifestItem.update({
      where: { id: f.itemId },
      data: { digest: `sha256:${"b".repeat(64)}` },
    });
  });

  it("rejects confirmation when the Production config pointer drifted", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const revision = await f.prisma.environmentConfigRevision.create({
      data: {
        teamId: f.teamId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        revision: 2,
        snapshotHash: "config-v2",
        resourceReferences: [],
        routeSnapshot: {},
        policyReferences: [],
      },
    });
    await f.prisma.projectEnvironment.update({
      where: { id: f.productionEnvironmentId },
      data: { currentConfigRevisionId: revision.id },
    });
    await expect(
      f.repository.confirm({
        teamId: f.teamId,
        projectId: f.projectId,
        releaseOrderId: f.orderId,
        manifestId: f.manifestId,
        actorId: f.userId,
        expectedInputHash: preview.inputHash,
        idempotencyKey: `stale-${f.suffix}`,
      }),
    ).rejects.toThrow("已变化");
  });
});
