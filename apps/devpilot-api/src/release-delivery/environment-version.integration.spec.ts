import "reflect-metadata";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { productionGateTestDouble } from "./release-gate-test-decision.spec-utils";
import {
  environmentVersionExecutorTestDouble,
  environmentVersionInputTestDouble,
  productionWorkloadTestDouble,
} from "./release-staging-executor.spec-utils";
import {
  cleanupProductionFixture,
  createProductionFixture,
  ProductionFixture,
} from "./release-production.integration-fixture";
import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteFinalProbeService } from "../site/site-final-probe.service";

const describeIntegration =
  process.env.RUN_ENVIRONMENT_VERSION_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("EnvironmentVersion integration", () => {
  let fixture: ProductionFixture;
  let service: EnvironmentVersionService;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    const repository = new EnvironmentVersionRepository(
      fixture.prisma as never,
    );
    service = new EnvironmentVersionService(
      repository,
      new EnvironmentVersionReadRepository(fixture.prisma as never),
      new EnvironmentVersionPolicyService(repository),
      environmentVersionExecutorTestDouble() as never,
      productionGateTestDouble(fixture.prisma) as never,
      new EnvironmentVersionGateEvidenceRepository(fixture.prisma as never),
      environmentVersionInputTestDouble() as never,
      productionWorkloadTestDouble() as never,
      new SiteRouteActivationService(fixture.prisma as never),
      new SiteFinalProbeService(),
    );
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("appends upgrade and recovery versions without overwriting history", async () => {
    const f = fixture;
    const first = await service.execute(
      upgradeInput(f, f.stagingEnvironmentId),
    );
    const second = await service.execute(
      upgradeInput(f, f.stagingEnvironmentId),
    );
    const recovery = await service.execute({
      ...baseInput(f, f.stagingEnvironmentId),
      kind: "recovery",
      sourceVersionId: first.version!.id,
    });
    expect(new Set([first.run.id, second.run.id, recovery.run.id]).size).toBe(
      3,
    );
    expect(recovery.version).toMatchObject({
      kind: "recovery",
      previousVersionId: second.version!.id,
      artifactManifestId: f.manifestId,
    });
    const environment = await f.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: f.stagingEnvironmentId },
    });
    expect(environment.currentEnvironmentVersionId).toBe(recovery.version!.id);
    await expect(
      f.prisma.environmentVersion.count({
        where: { environmentId: f.stagingEnvironmentId },
      }),
    ).resolves.toBe(3);
  });

  it("executes Production only with a matching approved unconsumed ReleaseRun", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const releaseRun = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `production-${f.suffix}`,
    });
    await f.prisma.operationApproval.update({
      where: { id: releaseRun.operationApproval!.id },
      data: {
        status: "approved",
        reviewerId: f.userId,
        reviewedAt: new Date(),
      },
    });
    const executed = await service.execute({
      ...upgradeInput(f, f.productionEnvironmentId),
      releaseRunId: releaseRun.id,
    });
    expect(executed.version).toMatchObject({
      environmentId: f.productionEnvironmentId,
    });
    const finalRun = await f.prisma.releaseRun.findUniqueOrThrow({
      where: { id: releaseRun.id },
    });
    const approval = await f.prisma.operationApproval.findUniqueOrThrow({
      where: { id: releaseRun.operationApproval!.id },
    });
    expect(finalRun.status).toBe("succeeded");
    expect(approval.consumedAt).not.toBeNull();
  });

  it("rejects arbitrary recovery IDs and Production without approval", async () => {
    const f = fixture;
    await expect(
      service.execute({
        ...baseInput(f, f.stagingEnvironmentId),
        kind: "recovery",
        sourceVersionId: "unknown-version",
      }),
    ).rejects.toThrow("不存在或不属于当前环境");
    await expect(
      service.execute(upgradeInput(f, f.productionEnvironmentId)),
    ).rejects.toThrow("必须绑定已批准");
  });

  it("lists exact per-version payloads reverse-chronologically with the previous-version chain", async () => {
    const f = fixture;
    const first = await service.execute(upgradeInput(f, f.stagingEnvironmentId));
    const second = await service.execute(upgradeInput(f, f.stagingEnvironmentId));
    const { environments } = await service.list(f.teamId, f.projectId);
    const staging = environments.find((item) => item.id === f.stagingEnvironmentId);
    expect(staging).toBeDefined();
    expect(staging!.environmentVersions.length).toBeGreaterThanOrEqual(2);
    const [latest, older] = staging!.environmentVersions;
    expect(latest.id).toBe(second.version!.id);
    expect(older.id).toBe(first.version!.id);
    expect(latest.previousVersionId).toBe(first.version!.id);
    expect(latest.releaseOrder.id).toBe(f.orderId);
    expect(latest.releaseOrder.releaseVersion).toBe("1.0.0");
    expect(latest.artifactManifest.id).toBe(f.manifestId);
    expect(latest.artifactManifest.digest).toMatch(/^sha256:/);
    expect(latest.artifactManifest.buildRun.revision).toBe(1);
    expect(latest.deploymentRun.id).toBe(second.run.id);
    expect(latest.deploymentRun.status).toBe("completed");
    expect(latest.deploymentRun.createdAt).toBeInstanceOf(Date);
    expect(latest.deploymentRun.finishedAt).toBeInstanceOf(Date);
    expect(new Date(latest.effectiveAt).getTime()).toBeGreaterThanOrEqual(
      new Date(older.effectiveAt).getTime(),
    );
    expect(staging!.currentEnvironmentVersionId).toBe(second.version!.id);
  });

  it("derives current from completed runs only and keeps the full history when the pointer is stale", async () => {
    const f = fixture;
    const first = await service.execute(upgradeInput(f, f.stagingEnvironmentId));
    await f.prisma.deploymentRun.update({
      where: { id: first.version!.deploymentRunId },
      data: { status: "failed" },
    });
    await f.prisma.projectEnvironment.update({
      where: { id: f.stagingEnvironmentId },
      data: { currentEnvironmentVersionId: first.version!.id },
    });
    const { environments } = await service.list(f.teamId, f.projectId);
    const staging = environments.find((item) => item.id === f.stagingEnvironmentId);
    expect(staging!.currentEnvironmentVersionId).toBeNull();
    expect(
      staging!.environmentVersions.some((item) => item.id === first.version!.id),
    ).toBe(true);
    const stale = staging!.environmentVersions.find((item) => item.id === first.version!.id)!;
    expect(stale.deploymentRun.status).toBe("failed");
    expect(staging!.environmentVersions[0].id).toBe(first.version!.id);
  });
});

function baseInput(f: ProductionFixture, environmentId: string) {
  return {
    teamId: f.teamId,
    actorId: f.userId,
    projectId: f.projectId,
    environmentId,
  };
}

function upgradeInput(f: ProductionFixture, environmentId: string) {
  return {
    ...baseInput(f, environmentId),
    kind: "upgrade" as const,
    manifestId: f.manifestId,
  };
}
