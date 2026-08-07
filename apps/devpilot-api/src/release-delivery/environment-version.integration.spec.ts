import "reflect-metadata";
import type { Prisma } from "@prisma/client";
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

  it("returns the per-environment candidate arrays from list", async () => {
    const { candidates } = await service.list(fixture.teamId, fixture.projectId);
    expect(Array.isArray(candidates.staging)).toBe(true);
    expect(Array.isArray(candidates.production)).toBe(true);
    expect(candidates.staging.map((item) => item.id)).toContain(fixture.manifestId);
    expect(candidates.production.map((item) => item.id)).toContain(fixture.manifestId);
  });
});

describeIntegration("EnvironmentVersion candidate filtering", () => {
  let fixture: ProductionFixture;
  let readRepository: EnvironmentVersionReadRepository;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    readRepository = new EnvironmentVersionReadRepository(fixture.prisma as never);
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("excludes cross-project manifests, failed builds and canceled release orders", async () => {
    const f = fixture;
    const foreignProject = await f.prisma.project.create({
      data: {
        id: `foreign-project-${f.suffix}`,
        teamId: f.teamId,
        createdById: f.userId,
        name: "Foreign Project",
        config: {},
      },
    });
    const foreign = await createManifest(f, "foreign", foreignProject.id);
    const failed = await createManifest(f, "failed");
    await f.prisma.buildRun.update({
      where: { id: failed.buildId },
      data: { status: "failed" },
    });
    const canceled = await createManifest(f, "canceled");
    await f.prisma.releaseOrder.update({
      where: { id: canceled.orderId },
      data: { status: "canceled" },
    });
    const { staging, production } = await readRepository.candidates(
      f.teamId,
      f.projectId,
    );
    const ids = [...staging.map((item) => item.id), ...production.map((item) => item.id)];
    expect(ids).toContain(f.manifestId);
    expect(ids).not.toContain(foreign.manifestId);
    expect(ids).not.toContain(failed.manifestId);
    expect(ids).not.toContain(canceled.manifestId);
  });

  it("keeps Staging candidates unfiltered and lists Production only with a verified Staging proof", async () => {
    const f = fixture;
    const withoutProof = await createManifest(f, "no-proof");
    const dryRunOnly = await createManifest(f, "dry-run");
    const dryRunDigest = await f.prisma.artifactManifest.findUniqueOrThrow({
      where: { id: dryRunOnly.manifestId },
      select: { digest: true },
    });
    await createStagingDeployment(f, dryRunOnly.manifestId, {
      dryRun: true,
      result: {
        artifactVerified: true,
        manifestId: dryRunOnly.manifestId,
        manifestDigest: dryRunDigest.digest,
      },
    });
    const wrongDigest = await createManifest(f, "wrong-digest");
    await createStagingDeployment(f, wrongDigest.manifestId, {
      result: {
        artifactVerified: true,
        manifestId: wrongDigest.manifestId,
        manifestDigest: "sha256:" + "e".repeat(64),
      },
    });
    const { staging, production } = await readRepository.candidates(
      f.teamId,
      f.projectId,
    );
    expect(staging.map((item) => item.id)).toContain(withoutProof.manifestId);
    expect(staging.map((item) => item.id)).toContain(dryRunOnly.manifestId);
    expect(staging.map((item) => item.id)).toContain(wrongDigest.manifestId);
    expect(production.map((item) => item.id)).toContain(f.manifestId);
    expect(production.map((item) => item.id)).not.toContain(withoutProof.manifestId);
    expect(production.map((item) => item.id)).not.toContain(dryRunOnly.manifestId);
    expect(production.map((item) => item.id)).not.toContain(wrongDigest.manifestId);
  });

  async function createManifest(f: ProductionFixture, label: string, projectId?: string) {
    const order = await f.prisma.releaseOrder.create({
      data: {
        teamId: f.teamId,
        projectId: projectId ?? f.projectId,
        createdById: f.userId,
        releaseVersion: `1.0.0-${label}`,
      },
    });
    const build = await f.prisma.buildRun.create({
      data: {
        teamId: f.teamId,
        projectId: projectId ?? f.projectId,
        releaseOrderId: order.id,
        triggeredById: f.userId,
        revision: 1,
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        inputSnapshot: {},
        inputHash: `build-hash-${label}`,
        status: "succeeded",
      },
    });
    const manifest = await f.prisma.artifactManifest.create({
      data: {
        teamId: f.teamId,
        projectId: projectId ?? f.projectId,
        releaseOrderId: order.id,
        buildRunId: build.id,
        digest: `sha256:${label}`.padEnd(64 + 7, "f"),
      },
    });
    return { orderId: order.id, buildId: build.id, manifestId: manifest.id };
  }

  async function createStagingDeployment(
    f: ProductionFixture,
    manifestId: string,
    overrides: Partial<{
      dryRun: boolean;
      result: Record<string, unknown>;
    }> = {},
  ) {
    await f.prisma.deploymentRun.create({
      data: {
        teamId: f.teamId,
        projectId: f.projectId,
        actorId: f.userId,
        environmentId: f.stagingEnvironmentId,
        artifactManifestId: manifestId,
        source: "release_order",
        targetType: "release-artifact",
        status: "completed",
        dryRun: overrides.dryRun ?? false,
        finishedAt: new Date(),
        result:
          (overrides.result ??
          ({
            artifactVerified: true,
            manifestId,
            manifestDigest: `sha256:${manifestId}`.padEnd(64 + 7, "f"),
          } as Record<string, unknown>)) as Prisma.InputJsonValue,
      },
    });
  }
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
