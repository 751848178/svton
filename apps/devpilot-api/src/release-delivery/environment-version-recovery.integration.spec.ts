import "reflect-metadata";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRecoveryRepository } from "./environment-version-recovery.repository";
import { EnvironmentVersionRecoveryService } from "./environment-version-recovery.service";
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
import { SiteRouteSwitchEvidenceRepository } from "../site/site-route-switch-evidence.repository";
import { siteRouteSwitchTestDouble } from "../site/site-route-switch.spec-utils";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";

const describeIntegration =
  process.env.RUN_ENVIRONMENT_VERSION_RECOVERY_INTEGRATION === "1"
    ? describe
    : describe.skip;

interface ServiceBundle {
  versions: EnvironmentVersionService;
  recovery: EnvironmentVersionRecoveryService;
}

describeIntegration("EnvironmentVersion production recovery integration", () => {
  let fixture: ProductionFixture;
  let bundle: ServiceBundle;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    bundle = buildServices(fixture);
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("creates a recovery ReleaseRun + fresh approval and executes to a new recovery EnvironmentVersion", async () => {
    const f = fixture;
    const first = await approvedUpgrade(f, bundle, "a");
    const second = await approvedUpgrade(f, bundle, "b");
    const firstReleaseRunId = await releaseRunIdOf(f, first.version!.id);

    const preview = await bundle.recovery.preview({
      teamId: f.teamId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: first.version!.id,
    });
    expect(preview.inputHash).toHaveLength(64);
    expect(preview.sourceReleaseRunId).toBe(firstReleaseRunId);

    const confirmed = await bundle.recovery.confirm({
      teamId: f.teamId,
      actorId: f.userId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: first.version!.id,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `recovery-${f.suffix}`,
    });
    expect(confirmed.mode).toBe("recovery");
    expect(confirmed.status).toBe("awaiting_approval");
    expect(confirmed.sourceReleaseRunId).toBe(firstReleaseRunId);
    expect(confirmed.operationApproval).toMatchObject({
      status: "pending",
      action: "project.release_order.deploy_production_recovery",
      inputHash: preview.inputHash,
    });
    const approval = await f.prisma.operationApproval.findUniqueOrThrow({
      where: { id: confirmed.operationApproval!.id },
    });
    expect(approval.action).toBe("project.release_order.deploy_production_recovery");
    expect(approval.category).toBe("release");
    expect(approval.risk).toBe("high");
    expect(approval.consumedAt).toBeNull();

    await f.prisma.operationApproval.update({
      where: { id: approval.id },
      data: { status: "approved", reviewerId: f.userId, reviewedAt: new Date() },
    });
    const executed = await bundle.versions.execute({
      ...baseInput(f, f.productionEnvironmentId),
      kind: "recovery",
      releaseRunId: confirmed.id,
    });
    expect(executed.version).toMatchObject({
      kind: "recovery",
      environmentId: f.productionEnvironmentId,
      previousVersionId: second.version!.id,
    });
    const finalRun = await f.prisma.releaseRun.findUniqueOrThrow({
      where: { id: confirmed.id },
    });
    const finalApproval = await f.prisma.operationApproval.findUniqueOrThrow({
      where: { id: approval.id },
    });
    expect(finalRun.status).toBe("succeeded");
    expect(finalApproval.consumedAt).not.toBeNull();
    const environment = await f.prisma.projectEnvironment.findUniqueOrThrow({
      where: { id: f.productionEnvironmentId },
    });
    expect(environment.currentEnvironmentVersionId).toBe(executed.version!.id);
    await expect(
      f.prisma.environmentVersion.count({
        where: { environmentId: f.productionEnvironmentId },
      }),
    ).resolves.toBe(3);
  });

  it("rejects a recovery backed by a consumed or non-recovery ReleaseRun", async () => {
    const f = fixture;
    const historical = await f.prisma.environmentVersion.findFirst({
      where: {
        environmentId: f.productionEnvironmentId,
        kind: "upgrade",
        NOT: { releaseRunId: null },
      },
      orderBy: { effectiveAt: "desc" },
    });
    const consumedRunId = (await releaseRunIdOf(f, historical!.id))!;
    const approval = await f.prisma.operationApproval.findUniqueOrThrow({
      where: { id: (await consumedApprovalId(f, consumedRunId))! },
    });
    expect(approval.consumedAt).not.toBeNull();
    await expect(
      bundle.versions.execute({
        ...baseInput(f, f.productionEnvironmentId),
        kind: "recovery",
        sourceVersionId: historical!.id,
        releaseRunId: consumedRunId,
      }),
    ).rejects.toThrow("Production ReleaseRun 未批准");
  });

  it("forces a fresh confirm when the Production config drifts", async () => {
    const f = fixture;
    const source = await historicalVersionId(f);
    const previewBefore = await bundle.recovery.preview({
      teamId: f.teamId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
    });
    const drifted = await bundle.recovery.confirm({
      teamId: f.teamId,
      actorId: f.userId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
      expectedInputHash: previewBefore.inputHash,
      idempotencyKey: `drift-${f.suffix}`,
    });
    const revision = await driftConfig(f);
    await expect(
      bundle.versions.execute({
        ...baseInput(f, f.productionEnvironmentId),
        kind: "recovery",
        releaseRunId: drifted.id,
      }),
    ).rejects.toThrow();
    const previewAfter = await bundle.recovery.preview({
      teamId: f.teamId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
    });
    expect(previewAfter.inputHash).not.toBe(previewBefore.inputHash);
    await expect(
      bundle.recovery.confirm({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: source,
        expectedInputHash: previewBefore.inputHash,
        idempotencyKey: `drift-stale-${f.suffix}`,
      }),
    ).rejects.toThrow("漂移");
    await restoreConfig(f, revision);
    await f.prisma.releaseRun.update({
      where: { id: drifted.id },
      data: { status: "failed" },
    });
  });

  it("rejects unknown, foreign and current source versions", async () => {
    const f = fixture;
    await expect(
      bundle.recovery.preview({
        teamId: f.teamId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: "unknown-version",
      }),
    ).rejects.toThrow("不存在或不属于当前环境");
    const current = await currentVersionId(f);
    await expect(
      bundle.recovery.preview({
        teamId: f.teamId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: current,
      }),
    ).rejects.toThrow("不能是当前环境版本");
    await expect(
      bundle.recovery.preview({
        teamId: "foreign-team",
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: await historicalVersionId(f),
      }),
    ).rejects.toThrow("生产环境不存在");
  });

  it("converges concurrent recovery confirmations to one run", async () => {
    const f = fixture;
    const source = await historicalVersionId(f);
    const preview = await bundle.recovery.preview({
      teamId: f.teamId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
    });
    const input = {
      teamId: f.teamId,
      actorId: f.userId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `concurrent-recovery-${f.suffix}`,
    };
    const [first, second] = await Promise.all([
      bundle.recovery.confirm(input),
      bundle.recovery.confirm(input),
    ]);
    expect(second.id).toBe(first.id);
    await expect(
      f.prisma.releaseRun.count({
        where: {
          releaseOrderId: f.orderId,
          idempotencyKey: input.idempotencyKey,
        },
      }),
    ).resolves.toBe(1);
    await f.prisma.releaseRun.update({
      where: { id: first.id },
      data: { status: "failed" },
    });
  });

  it("enforces per-environment max one active release run across standard and recovery confirms", async () => {
    const f = fixture;
    const source = await historicalVersionId(f);
    const recoveryPreview = await bundle.recovery.preview({
      teamId: f.teamId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
    });
    const recoveryRun = await bundle.recovery.confirm({
      teamId: f.teamId,
      actorId: f.userId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      sourceVersionId: source,
      expectedInputHash: recoveryPreview.inputHash,
      idempotencyKey: `guard-recovery-${f.suffix}`,
    });
    expect(recoveryRun.status).toBe("awaiting_approval");
    await expect(
      bundle.recovery.confirm({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: source,
        expectedInputHash: recoveryPreview.inputHash,
        idempotencyKey: `guard-recovery-2-${f.suffix}`,
      }),
    ).rejects.toThrow("同一环境同时只允许一个运行");
    const standardPreview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    await expect(
      f.repository.confirm({
        teamId: f.teamId,
        projectId: f.projectId,
        releaseOrderId: f.orderId,
        manifestId: f.manifestId,
        actorId: f.userId,
        expectedInputHash: standardPreview.inputHash,
        idempotencyKey: `guard-standard-${f.suffix}`,
      }),
    ).rejects.toThrow("同一环境同时只允许一个运行");
    await f.prisma.releaseRun.update({
      where: { id: recoveryRun.id },
      data: { status: "failed" },
    });
    const standardRun = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: standardPreview.inputHash,
      idempotencyKey: `guard-standard-${f.suffix}`,
    });
    expect(standardRun.status).toBe("awaiting_approval");
    await expect(
      bundle.recovery.confirm({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: source,
        expectedInputHash: recoveryPreview.inputHash,
        idempotencyKey: `guard-recovery-3-${f.suffix}`,
      }),
    ).rejects.toThrow("同一环境同时只允许一个运行");
    await f.prisma.releaseRun.update({
      where: { id: standardRun.id },
      data: { status: "failed" },
    });
  });
});

function buildServices(fixture: ProductionFixture): ServiceBundle {
  const repository = new EnvironmentVersionRepository(fixture.prisma as never);
  const versions = new EnvironmentVersionService(
    repository,
    new EnvironmentVersionCompletionRepository(
      fixture.prisma as never,
      new SiteRouteSwitchEvidenceRepository(),
    ),
    new EnvironmentVersionReadRepository(fixture.prisma as never),
    new EnvironmentVersionPolicyService(repository),
    environmentVersionExecutorTestDouble() as never,
    productionGateTestDouble(fixture.prisma) as never,
    new EnvironmentVersionGateEvidenceRepository(fixture.prisma as never),
    environmentVersionInputTestDouble() as never,
    productionWorkloadTestDouble() as never,
    new SiteRouteActivationService(fixture.prisma as never),
    siteRouteSwitchTestDouble(),
    new SiteFinalProbeService(),
  );
  const recovery = new EnvironmentVersionRecoveryService(
    new EnvironmentVersionRecoveryRepository(fixture.prisma as never),
  );
  return { versions, recovery };
}

async function approvedUpgrade(
  f: ProductionFixture,
  bundle: ServiceBundle,
  label: string,
) {
  const preview = await f.repository.preview(
    f.teamId,
    f.projectId,
    f.orderId,
    f.manifestId,
  );
  const run = await f.repository.confirm({
    teamId: f.teamId,
    projectId: f.projectId,
    releaseOrderId: f.orderId,
    manifestId: f.manifestId,
    actorId: f.userId,
    expectedInputHash: preview.inputHash,
    idempotencyKey: `upgrade-${label}-${f.suffix}`,
  });
  await f.prisma.operationApproval.update({
    where: { id: run.operationApproval!.id },
    data: { status: "approved", reviewerId: f.userId, reviewedAt: new Date() },
  });
  return bundle.versions.execute({
    ...baseInput(f, f.productionEnvironmentId),
    kind: "upgrade",
    manifestId: f.manifestId,
    releaseRunId: run.id,
  });
}

function baseInput(f: ProductionFixture, environmentId: string) {
  return {
    teamId: f.teamId,
    actorId: f.userId,
    projectId: f.projectId,
    environmentId,
  };
}

async function releaseRunIdOf(f: ProductionFixture, versionId: string) {
  const version = await f.prisma.environmentVersion.findUniqueOrThrow({
    where: { id: versionId },
    select: { releaseRunId: true },
  });
  return version.releaseRunId!;
}

async function consumedApprovalId(f: ProductionFixture, runId: string) {
  const run = await f.prisma.releaseRun.findUniqueOrThrow({
    where: { id: runId },
    select: { operationApprovalId: true },
  });
  return run.operationApprovalId!;
}

async function currentVersionId(f: ProductionFixture) {
  const environment = await f.prisma.projectEnvironment.findUniqueOrThrow({
    where: { id: f.productionEnvironmentId },
  });
  return environment.currentEnvironmentVersionId!;
}

async function historicalVersionId(f: ProductionFixture) {
  const current = await currentVersionId(f);
  const version = await f.prisma.environmentVersion.findFirst({
    where: {
      environmentId: f.productionEnvironmentId,
      id: { not: current },
    },
    orderBy: { effectiveAt: "desc" },
  });
  return version!.id;
}

async function driftConfig(f: ProductionFixture) {
  const environment = await f.prisma.projectEnvironment.findUniqueOrThrow({
    where: { id: f.productionEnvironmentId },
  });
  const revision = await f.prisma.environmentConfigRevision.create({
    data: {
      teamId: f.teamId,
      projectId: f.projectId,
      environmentId: f.productionEnvironmentId,
      revision: 2,
      snapshotHash: "config-v2-drifted",
      resourceReferences: [{ changed: true }],
      routeSnapshot: {},
      policyReferences: [],
    },
  });
  await f.prisma.projectEnvironment.update({
    where: { id: f.productionEnvironmentId },
    data: { currentConfigRevisionId: revision.id },
  });
  return environment.currentConfigRevisionId!;
}

async function restoreConfig(f: ProductionFixture, revisionId: string) {
  await f.prisma.projectEnvironment.update({
    where: { id: f.productionEnvironmentId },
    data: { currentConfigRevisionId: revisionId },
  });
}
