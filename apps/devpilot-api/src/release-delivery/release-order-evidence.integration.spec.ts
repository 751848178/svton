import "reflect-metadata";
import { PrismaService } from "../prisma/prisma.service";
import {
  cleanupProductionFixture,
  createProductionFixture,
  ProductionFixture,
} from "./release-production.integration-fixture";
import { ReleaseOrderEvidenceRepository } from "./release-order-evidence.repository";
import { ReleaseOrderEvidenceService } from "./release-order-evidence.service";
import { seedCorrectedProductionEvidence } from "./release-order-evidence-correction.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_ORDER_EVIDENCE_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ReleaseOrderEvidence integration", () => {
  let fixture: ProductionFixture;
  let service: ReleaseOrderEvidenceService;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    service = new ReleaseOrderEvidenceService(
      new ReleaseOrderEvidenceRepository(
        fixture.prisma as unknown as PrismaService,
      ),
    );
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("aggregates exact Build, Manifest and repeated Staging identities", async () => {
    const original = await service.get(
      fixture.teamId,
      fixture.projectId,
      fixture.orderId,
      50,
    );
    expect(original.buildRuns).toMatchObject({ total: 1, hasMore: false });
    expect(original.buildRuns.items[0].manifest).toMatchObject({
      id: fixture.manifestId,
      buildRun: { id: original.buildRuns.items[0].id, revision: 1 },
      items: [{ componentKey: "project-bundle" }],
    });
    const repeated = await fixture.prisma.deploymentRun.create({
      data: {
        teamId: fixture.teamId,
        projectId: fixture.projectId,
        actorId: fixture.userId,
        environmentId: fixture.stagingEnvironmentId,
        artifactManifestId: fixture.manifestId,
        source: "release_order",
        targetType: "release-artifact",
        status: "completed",
        dryRun: false,
        finishedAt: new Date(),
        result: {
          artifactVerified: true,
          manifestId: fixture.manifestId,
          manifestDigest: `sha256:${"b".repeat(64)}`,
        },
      },
    });
    const next = await service.get(
      fixture.teamId,
      fixture.projectId,
      fixture.orderId,
      50,
    );
    expect(next.buildRuns.total).toBe(1);
    expect(next.stagingDeploymentRuns.total).toBe(2);
    expect(next.stagingDeploymentRuns.items.map((run) => run.id)).toEqual(
      expect.arrayContaining([
        repeated.id,
        original.stagingDeploymentRuns.items[0].id,
      ]),
    );
  });

  it("joins one governed ReleaseRun only to its exact Production DeploymentRun", async () => {
    const seeded = await seedCorrectedProductionEvidence(fixture);
    const evidence = await service.get(
      fixture.teamId,
      fixture.projectId,
      fixture.orderId,
      1,
    );
    expect(evidence.productionReleaseRuns.items).toHaveLength(1);
    expect(evidence.productionReleaseRuns).toMatchObject({
      total: 1,
      hasMore: false,
    });
    expect(evidence.productionReleaseRuns.items[0]).toMatchObject({
      id: seeded.releaseId,
      artifactManifestId: fixture.manifestId,
      stagingProof: {
        deploymentRunId: seeded.proofId,
      },
    });
    expect(
      evidence.productionReleaseRuns.items[0].deploymentRuns.map(
        (run) => run.id,
      ),
    ).toEqual(expect.arrayContaining(seeded.deploymentIds));
    expect(evidence.productionReleaseRuns.items[0].deploymentRuns).toHaveLength(
      2,
    );
  });

  it("does not disclose a release order through another project scope", async () => {
    await expect(
      service.get(fixture.teamId, "foreign-project", fixture.orderId, 50),
    ).rejects.toThrow("不存在");
  });
});
