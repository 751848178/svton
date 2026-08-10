import "reflect-metadata";
import { PrismaService } from "../prisma/prisma.service";
import { ReleaseGateDeployEvidenceRepository } from "./release-gate-deploy-evidence.repository";
import { ReleaseGateDeployOperationEvidenceRepository } from "./release-gate-deploy-operation-evidence.repository";
import { ReleaseGateDeployResourceEvidenceRepository } from "./release-gate-deploy-resource-evidence.repository";
import {
  cleanupProductionFixture,
  createProductionFixture,
  type ProductionFixture,
} from "./release-production.integration-fixture";

const describeIntegration =
  process.env.RUN_RELEASE_GATE_DECISION_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ReleaseGate deploy evidence targeting", () => {
  let fixture: ProductionFixture;
  let repository: ReleaseGateDeployEvidenceRepository;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    const db = fixture.prisma as unknown as PrismaService;
    repository = new ReleaseGateDeployEvidenceRepository(
      db,
      new ReleaseGateDeployResourceEvidenceRepository(db),
      new ReleaseGateDeployOperationEvidenceRepository(db),
    );
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("loads the exact Production environment and frozen config revision", async () => {
    const production =
      await fixture.prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: fixture.productionEnvironmentId },
        select: { currentConfigRevisionId: true },
      });
    const evidence = await repository.load(
      fixture.teamId,
      fixture.projectId,
      fixture.orderId,
      fixture.manifestId,
      fixture.productionEnvironmentId,
      production.currentConfigRevisionId,
    );
    expect(evidence.environment).toMatchObject({
      id: fixture.productionEnvironmentId,
      baselineRole: "production",
      currentConfigRevision: { id: production.currentConfigRevisionId },
    });
  });

  it("fails closed when the requested Production config revision drifted", async () => {
    await expect(
      repository.load(
        fixture.teamId,
        fixture.projectId,
        fixture.orderId,
        fixture.manifestId,
        fixture.productionEnvironmentId,
        "foreign-config-revision",
      ),
    ).resolves.toMatchObject({ environment: null });
  });

  it("does not reuse an older same-Manifest run during pre-admission", async () => {
    const evidence = await repository.load(
      fixture.teamId,
      fixture.projectId,
      fixture.orderId,
      fixture.manifestId,
      fixture.stagingEnvironmentId,
      null,
    );
    expect(evidence).toMatchObject({
      environment: { id: fixture.stagingEnvironmentId },
      deployments: [],
    });
  });
});
