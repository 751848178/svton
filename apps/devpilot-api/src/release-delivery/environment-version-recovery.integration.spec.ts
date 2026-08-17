import "reflect-metadata";
import { Prisma } from "@prisma/client";
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
} from "./release-staging-executor.spec-utils";
import {
  cleanupProductionFixture,
  createProductionFixture,
  ProductionFixture,
} from "./release-production.integration-fixture";
import { SiteRouteActivationService } from "../site/site-route-activation.service";
import { SiteFinalProbeService } from "../site/site-final-probe.service";
import { SiteRouteSwitchSagaOrchestrator } from "../site/site-route-switch-saga.orchestrator";
import { SiteRouteSwitchSagaRepository } from "../site/site-route-switch-saga.repository";
import { siteRouteSwitchTestDouble } from "../site/site-route-switch.spec-utils";
import { EnvironmentVersionCompletionRepository } from "./environment-version-completion.repository";
import { ReleaseProductionWorkloadService } from "./release-production-workload.service";
import { ReleaseStagingWorkloadService } from "./release-staging-workload.service";
import { ReleaseStagingWorkloadStateRepository } from "./release-staging-workload-state.repository";
import { ProductionPromotionAwaitingRepository } from "./production-promotion-awaiting.repository";

const describeIntegration =
  process.env.RUN_ENVIRONMENT_VERSION_RECOVERY_INTEGRATION === "1"
    ? describe
    : describe.skip;

interface ServiceBundle {
  versions: EnvironmentVersionService;
  recovery: EnvironmentVersionRecoveryService;
  completion: EnvironmentVersionCompletionRepository;
  providerKey: string;
}

describeIntegration(
  "EnvironmentVersion production recovery integration",
  () => {
    let fixture: ProductionFixture;
    let bundle: ServiceBundle;

    beforeAll(async () => {
      fixture = await createProductionFixture();
      bundle = buildServices(fixture);
    });

    afterAll(async () => cleanupProductionFixture(fixture));
    afterEach(async () => {
      await fixture.prisma.releaseRun.updateMany({
        where: {
          environmentId: fixture.productionEnvironmentId,
          status: { in: ["awaiting_approval", "running", "awaiting_validation"] },
        },
        data: { status: "failed", finishedAt: new Date() },
      });
    });

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
      const frozenPolicy = await f.prisma.releaseRun.findUniqueOrThrow({
        where: { id: confirmed.id }, select: { policySnapshot: true },
      });
      expect(frozenPolicy.policySnapshot).toMatchObject({
        acceptanceMode: "technical_acceptance",
        deploymentProviderKey: "local-filesystem-v1",
        approvedWorkload: { identityHash: expect.any(String) },
      });
      expect(confirmed.operationApproval).toMatchObject({
        status: "pending",
        action: "project.release_order.deploy_production_recovery",
        inputHash: preview.inputHash,
      });
      const approval = await f.prisma.operationApproval.findUniqueOrThrow({
        where: { id: confirmed.operationApproval!.id },
      });
      expect(approval.action).toBe(
        "project.release_order.deploy_production_recovery",
      );
      expect(approval.category).toBe("release");
      expect(approval.risk).toBe("high");
      expect(approval.consumedAt).toBeNull();

      await f.prisma.operationApproval.update({
        where: { id: approval.id },
        data: {
          status: "approved",
          reviewerId: f.userId,
          reviewedAt: new Date(),
        },
      });
      const executed = await executeAcceptedPromotion(f, bundle, {
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
      expect(environment.currentEnvironmentVersionId).toBe(
        executed.version!.id,
      );
      await expect(
        f.prisma.environmentVersion.count({
          where: { environmentId: f.productionEnvironmentId },
        }),
      ).resolves.toBe(3);
    });

    it("rejects a recovery backed by a consumed or non-recovery ReleaseRun", async () => {
      const f = fixture;
      const current = await currentVersionId(f);
      const historical = await f.prisma.environmentVersion.findFirst({
        where: {
          environmentId: f.productionEnvironmentId,
          id: { not: current },
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

    it("rejects recovery confirmation without run or approval side effects while compensation is required", async () => {
      const f = fixture;
      const source = await historicalVersionId(f);
      const preview = await bundle.recovery.preview({
        teamId: f.teamId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        sourceVersionId: source,
      });
      const site = await f.prisma.site.create({
        data: {
          teamId: f.teamId,
          createdById: f.userId,
          projectId: f.projectId,
          environmentId: f.productionEnvironmentId,
          name: "Recovery route guard",
          primaryDomain: `recovery-guard-${f.suffix}.example.test`,
          status: "active",
        },
      });
      const saga = await f.prisma.siteRouteSwitchRun.create({
        data: {
          operationId: `recovery-guard-${f.suffix}`,
          providerKey: "test-route-provider",
          teamId: f.teamId,
          siteId: site.id,
          projectId: f.projectId,
          environmentId: f.productionEnvironmentId,
          desiredRoute: {},
          status: "compensation_required",
        },
      });
      const before = await Promise.all([
        f.prisma.releaseRun.count({ where: { teamId: f.teamId } }),
        f.prisma.operationApproval.count({ where: { teamId: f.teamId } }),
      ]);
      try {
        await expect(
          bundle.recovery.confirm({
            teamId: f.teamId,
            actorId: f.userId,
            projectId: f.projectId,
            environmentId: f.productionEnvironmentId,
            sourceVersionId: source,
            expectedInputHash: preview.inputHash,
            idempotencyKey: `recovery-guard-confirm-${f.suffix}`,
          }),
        ).rejects.toThrow("compensation_required");
        await expect(
          Promise.all([
            f.prisma.releaseRun.count({ where: { teamId: f.teamId } }),
            f.prisma.operationApproval.count({ where: { teamId: f.teamId } }),
          ]),
        ).resolves.toEqual(before);
      } finally {
        await f.prisma.siteRouteSwitchRun.delete({ where: { id: saga.id } });
        await f.prisma.site.delete({ where: { id: site.id } });
      }
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
  },
);

describeIntegration("Production standard/recovery lock-order barrier", () => {
  let fixture: ProductionFixture;
  let bundle: ServiceBundle;

  beforeAll(async () => {
    fixture = await createProductionFixture();
    bundle = buildServices(fixture);
  });
  afterAll(async () => cleanupProductionFixture(fixture));

  it("serializes concurrent standard and recovery confirms without a deadlock", async () => {
    const f = fixture;
    const first = await approvedUpgrade(f, bundle, "barrier-a");
    await approvedUpgrade(f, bundle, "barrier-b");
    const sourceVersionId = first.version!.id;
    const [standardPreview, recoveryPreview] = await Promise.all([
      f.repository.preview(f.teamId, f.projectId, f.orderId, f.manifestId),
      bundle.recovery.preview({ ...baseInput(f, f.productionEnvironmentId),
        sourceVersionId }),
    ]);
    const locked = deferred();
    const release = deferred();
    const holder = f.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM ProjectEnvironment
        WHERE id = ${f.productionEnvironmentId} FOR UPDATE`);
      locked.resolve();
      await release.promise;
    });
    await locked.promise;
    let attempts: Promise<unknown>[] = [];
    try {
      const standard = f.repository.confirm({
        teamId: f.teamId, projectId: f.projectId,
        releaseOrderId: f.orderId, manifestId: f.manifestId,
        actorId: f.userId, expectedInputHash: standardPreview.inputHash,
        idempotencyKey: `barrier-standard-${f.suffix}`,
      });
      await waitForRowLock(f, "ReleaseOrder", f.orderId);
      const recovery = bundle.recovery.confirm({
        ...baseInput(f, f.productionEnvironmentId), actorId: f.userId,
        sourceVersionId, expectedInputHash: recoveryPreview.inputHash,
        idempotencyKey: `barrier-recovery-${f.suffix}`,
      });
      attempts = [standard, recovery];
      release.resolve();
      await holder;
      const results = await Promise.allSettled(attempts);
      expect(results.filter((item) => item.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((item) => item.status === "rejected");
      expect(rejected).toMatchObject({ status: "rejected",
        reason: expect.objectContaining({ message: expect.stringContaining(
          "同一环境同时只允许一个运行",
        ) }) });
      const active = await f.prisma.releaseRun.findMany({ where: {
        environmentId: f.productionEnvironmentId,
        status: { in: ["awaiting_approval", "running", "awaiting_validation"] },
      } });
      expect(active).toHaveLength(1);
      await f.prisma.releaseRun.update({ where: { id: active[0].id },
        data: { status: "failed" } });
    } finally {
      release.resolve();
      await Promise.allSettled([holder, ...attempts]);
    }
  }, 30_000);
});

describeIntegration("Production execution/confirm lock-order barrier", () => {
  let fixture: ProductionFixture;

  beforeAll(async () => { fixture = await createProductionFixture(); });
  afterAll(async () => cleanupProductionFixture(fixture));

  it("lets execution reserve first and rejects concurrent confirm without P2034", async () => {
    const f = fixture;
    const deployStarted = deferred();
    const releaseDeploy = deferred();
    const baseExecutor = environmentVersionExecutorTestDouble();
    const bundle = buildServices(f, {
      ...baseExecutor,
      deploy: async (input: Parameters<typeof baseExecutor.deploy>[0]) => {
        deployStarted.resolve();
        await releaseDeploy.promise;
        return baseExecutor.deploy(input);
      },
    });
    const preview = await f.repository.preview(
      f.teamId, f.projectId, f.orderId, f.manifestId,
    );
    const approved = await f.repository.confirm({
      teamId: f.teamId, projectId: f.projectId,
      releaseOrderId: f.orderId, manifestId: f.manifestId,
      actorId: f.userId, expectedInputHash: preview.inputHash,
      idempotencyKey: `execution-barrier-approved-${f.suffix}`,
      providerKey: bundle.providerKey,
    });
    await f.prisma.operationApproval.update({
      where: { id: approved.operationApproval!.id },
      data: { status: "approved", reviewerId: f.userId, reviewedAt: new Date() },
    });
    const environmentLocked = deferred();
    const releaseEnvironment = deferred();
    const holder = f.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM ProjectEnvironment
        WHERE id = ${f.productionEnvironmentId} FOR UPDATE`);
      environmentLocked.resolve();
      await releaseEnvironment.promise;
    });
    await environmentLocked.promise;
    let execution: Promise<unknown> | undefined;
    let competing: Promise<unknown> | undefined;
    try {
      execution = bundle.versions.execute({
        ...baseInput(f, f.productionEnvironmentId), kind: "upgrade",
        manifestId: f.manifestId, releaseRunId: approved.id,
      });
      await waitForRowLock(f, "ReleaseOrder", f.orderId);
      competing = f.repository.confirm({
        teamId: f.teamId, projectId: f.projectId,
        releaseOrderId: f.orderId, manifestId: f.manifestId,
        actorId: f.userId, expectedInputHash: preview.inputHash,
        idempotencyKey: `execution-barrier-standard-${f.suffix}`,
      });
      releaseEnvironment.resolve();
      await holder;
      await stage(deployStarted.promise, execution, "execution deploy start");
      await expect(competing).rejects.toThrow("同一环境同时只允许一个运行");
      releaseDeploy.resolve();
      await expect(execution).resolves.toMatchObject({
        run: { status: "awaiting_validation" },
      });
    } finally {
      releaseEnvironment.resolve();
      releaseDeploy.resolve();
      await Promise.allSettled([
        holder,
        ...(execution ? [execution] : []),
        ...(competing ? [competing] : []),
      ]);
    }
  }, 30_000);
});

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

async function stage(
  signal: Promise<void>,
  operation: Promise<unknown>,
  label: string,
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      signal,
      operation.then(() => Promise.reject(new Error(
        `${label}: operation completed before stage`,
      ))),
      operation.catch((error) => Promise.reject(error)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label}: timeout`)), 5_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForRowLock(
  fixture: ProductionFixture,
  table: "ReleaseOrder",
  id: string,
) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      await fixture.prisma.$transaction((tx) => tx.$queryRaw(
        Prisma.sql`SELECT id FROM ${Prisma.raw(table)}
          WHERE id = ${id} FOR UPDATE NOWAIT`,
      ));
    } catch (error) {
      if (lockUnavailable(error)) return;
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`${table}:${id} lock stage timeout`);
}

function lockUnavailable(error: unknown) {
  const value = error as { message?: string; meta?: { code?: string } };
  return value.meta?.code === "3572" || /3572|NOWAIT/i.test(value.message ?? "");
}

function buildServices(
  fixture: ProductionFixture,
  executor = localExecutor(),
): ServiceBundle {
  const repository = new EnvironmentVersionRepository(fixture.prisma as never);
  const workloadState = new ReleaseStagingWorkloadStateRepository(
    fixture.prisma as never,
  );
  const routeSwitch = siteRouteSwitchTestDouble();
  const routeSagaRepository = new SiteRouteSwitchSagaRepository(
    fixture.prisma as never,
  );
  const completion = new EnvironmentVersionCompletionRepository(
    fixture.prisma as never,
    routeSagaRepository,
  );
  const versions = new EnvironmentVersionService(
    repository,
    completion,
    new EnvironmentVersionReadRepository(fixture.prisma as never),
    new EnvironmentVersionPolicyService(repository),
    executor as never,
    productionGateTestDouble(fixture.prisma) as never,
    new EnvironmentVersionGateEvidenceRepository(fixture.prisma as never),
    environmentVersionInputTestDouble(executor.providerKey) as never,
    {} as never,
    new ReleaseStagingWorkloadService(workloadState),
    new ReleaseProductionWorkloadService(workloadState),
    new SiteRouteActivationService(fixture.prisma as never),
    routeSwitch,
    new SiteRouteSwitchSagaOrchestrator(routeSagaRepository, routeSwitch),
    { assertClear: jest.fn() } as never,
    new SiteFinalProbeService(),
    new ProductionPromotionAwaitingRepository(fixture.prisma as never),
  );
  const recovery = new EnvironmentVersionRecoveryService(
    new EnvironmentVersionRecoveryRepository(fixture.prisma as never),
    executor as never,
  );
  return { versions, recovery, completion, providerKey: executor.providerKey };
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
    providerKey: bundle.providerKey,
  });
  await f.prisma.operationApproval.update({
    where: { id: run.operationApproval!.id },
    data: { status: "approved", reviewerId: f.userId, reviewedAt: new Date() },
  });
  return executeAcceptedPromotion(f, bundle, {
    ...baseInput(f, f.productionEnvironmentId),
    kind: "upgrade",
    manifestId: f.manifestId,
    releaseRunId: run.id,
  });
}

function localExecutor() {
  return {
    ...environmentVersionExecutorTestDouble(),
    providerKey: "local-filesystem-v1",
  };
}

async function executeAcceptedPromotion(
  f: ProductionFixture,
  bundle: ServiceBundle,
  input: Parameters<EnvironmentVersionService["execute"]>[0],
) {
  const awaiting = await bundle.versions.execute(input);
  expect(awaiting.run.status).toBe("awaiting_validation");
  return bundle.completion.complete({
    deploymentRunId: awaiting.run.id,
    kind: input.kind,
    teamId: f.teamId,
    actorId: f.userId,
    projectId: f.projectId,
    releaseOrderId: f.orderId,
    status: "completed",
    expectedStatus: "awaiting_validation",
    logs: ["fixture promotion accepted"],
    result: { fixturePromotionAccepted: true },
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
