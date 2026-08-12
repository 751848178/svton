import "reflect-metadata";
import { Prisma, PrismaClient } from "@prisma/client";
import { ReleasePolicyRepository } from "./release-policy.repository";
import { releaseGateCheckpointPolicy } from "./release-gate-checkpoint.policy";
import { loadReleaseDeploymentInputState } from "./release-deployment-input-state.repository";
import { buildReleaseDeploymentInputSnapshot } from "./release-deployment-input-snapshot.utils";
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
      action: "project.release_order.deploy_production",
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

  it("rejects a new confirm while route compensation is required", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const site = await f.prisma.site.create({
      data: {
        teamId: f.teamId,
        createdById: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        name: "Blocked route saga",
        primaryDomain: `blocked-${f.suffix}.example.test`,
        status: "active",
      },
    });
    const saga = await f.prisma.siteRouteSwitchRun.create({
      data: {
        operationId: `blocked-confirm-${f.suffix}`,
        providerKey: "test-route-provider",
        teamId: f.teamId,
        siteId: site.id,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        desiredRoute: {},
        status: "compensation_required",
      },
    });
    try {
      await expect(
        f.repository.confirm({
          teamId: f.teamId,
          projectId: f.projectId,
          releaseOrderId: f.orderId,
          manifestId: f.manifestId,
          actorId: f.userId,
          expectedInputHash: preview.inputHash,
          idempotencyKey: `blocked-confirm-${f.suffix}`,
        }),
      ).rejects.toThrow("compensation_required");
    } finally {
      await f.prisma.siteRouteSwitchRun.delete({ where: { id: saga.id } });
      await f.prisma.site.delete({ where: { id: site.id } });
    }
  });

  it("rejects cross-project lookup and every tampered artifact Digest", async () => {
    const f = fixture;
    await expect(
      f.repository.preview(f.teamId, "other-project", f.orderId, f.manifestId),
    ).rejects.toThrow();
    await f.prisma.artifactManifestItem.update({
      where: { id: f.componentItemId },
      data: { digest: "sha256:unknown" },
    });
    await expect(
      f.repository.preview(f.teamId, f.projectId, f.orderId, f.manifestId),
    ).rejects.toThrow("Manifest Digest 未知");
    await f.prisma.artifactManifestItem.update({
      where: { id: f.componentItemId },
      data: { digest: `sha256:${"d".repeat(64)}` },
    });
    await expect(
      f.repository.preview(f.teamId, f.projectId, f.orderId, f.manifestId),
    ).rejects.toThrow("Staging 验证制品不一致");
    await f.prisma.artifactManifestItem.update({
      where: { id: f.componentItemId },
      data: { digest: `sha256:${"c".repeat(64)}` },
    });
    await f.prisma.artifactManifestItem.update({
      where: { id: f.bundleItemId },
      data: { digest: `sha256:${"e".repeat(64)}` },
    });
    await expect(
      f.repository.preview(f.teamId, f.projectId, f.orderId, f.manifestId),
    ).rejects.toThrow("Manifest Digest");
    await f.prisma.artifactManifestItem.update({
      where: { id: f.bundleItemId },
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

describeIntegration("ReleaseProduction serializable input barrier", () => {
  let fixture: ProductionFixture;
  beforeAll(async () => { fixture = await createProductionFixture(); });
  afterAll(async () => cleanupProductionFixture(fixture));

  it("rejects a server drift committed while confirm waits for its exact row lock", async () => {
    const f = fixture;
    const server = await f.prisma.server.create({ data: {
      teamId: f.teamId, createdById: f.userId, name: "locked-production",
      host: "10.0.0.10", port: 22, username: "deploy", authType: "key",
      credentials: "encrypted", status: "online",
    } });
    await f.prisma.projectEnvironmentServer.create({ data: {
      teamId: f.teamId, projectId: f.projectId,
      environmentId: f.productionEnvironmentId, serverId: server.id,
      metadata: { releaseDeployment: { providerKey: "ssh-v1", root: "/srv/app" } },
    } });
    const preview = await f.repository.preview(
      f.teamId, f.projectId, f.orderId, f.manifestId,
    );
    const state = await loadReleaseDeploymentInputState(f.prisma as never, {
      teamId: f.teamId, projectId: f.projectId,
      environmentId: f.productionEnvironmentId, label: "Production",
    });
    const deployment = buildReleaseDeploymentInputSnapshot(state, "ssh-v1", []);
    const admissionProof = proofFor(preview, deployment.snapshot);
    const mutator = new PrismaClient();
    const locked = deferred();
    const release = deferred();
    const mutation = mutator.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM Server
        WHERE id = ${server.id} FOR UPDATE`);
      locked.resolve();
      await release.promise;
      await tx.server.update({ where: { id: server.id },
        data: { host: "10.0.0.11" } });
    });
    await locked.promise;
    const confirmation = f.repository.confirm({
      teamId: f.teamId, projectId: f.projectId,
      releaseOrderId: f.orderId, manifestId: f.manifestId,
      actorId: f.userId, expectedInputHash: preview.inputHash,
      idempotencyKey: `server-drift-${f.suffix}`, providerKey: "ssh-v1",
      admissionProof,
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    release.resolve();
    await mutation;
    await expect(confirmation).rejects.toThrow("前置检查已过期或漂移");
    await expect(f.prisma.releaseRun.count({ where: {
      releaseOrderId: f.orderId,
    } })).resolves.toBe(0);
    await expect(f.prisma.operationApproval.count({ where: {
      projectId: f.projectId, targetType: "release_run",
    } })).resolves.toBe(0);
    await mutator.$disconnect();
  }, 30_000);
});

function proofFor(preview: any, deploymentSnapshot: any) {
  return {
    preApprovalAllowed: true, previewInputHash: preview.inputHash,
    deploymentInputHash: deploymentSnapshot.inputHash,
    workloadInputHash: preview.snapshot.workload.inputHash,
    deploymentSnapshot,
    checks: releaseGateCheckpointPolicy("production_pre_execution")
      .requiredGateIds.map((id) => ({
        id, status: id === "D13" ? "manual" : "checked",
        fresh: true, expiresAt: "2099-01-01T00:00:00.000Z",
        evidenceIdentity: ["D14", "D15"].includes(id)
          ? { configRevisionId: deploymentSnapshot.configRevision.id }
          : undefined,
      })),
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describeIntegration("ReleaseProduction per-environment concurrency guard", () => {
  let fixture: ProductionFixture;

  beforeAll(async () => {
    fixture = await createProductionFixture();
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("rejects a second confirm while the first run is still active", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const first = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `guard-1-${f.suffix}`,
    });
    await expect(
      f.repository.confirm({
        teamId: f.teamId,
        projectId: f.projectId,
        releaseOrderId: f.orderId,
        manifestId: f.manifestId,
        actorId: f.userId,
        expectedInputHash: preview.inputHash,
        idempotencyKey: `guard-2-${f.suffix}`,
      }),
    ).rejects.toThrow("同一环境同时只允许一个运行");
    await f.prisma.releaseRun.update({
      where: { id: first.id },
      data: { status: "failed" },
    });
  });

  it("replays the existing run by idempotency key even while an active run exists", async () => {
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
      idempotencyKey: `guard-replay-${f.suffix}`,
    };
    const [first, second] = await Promise.all([
      f.repository.confirm(input),
      f.repository.confirm(input),
    ]);
    expect(second.id).toBe(first.id);
    await f.prisma.releaseRun.update({
      where: { id: first.id },
      data: { status: "failed" },
    });
  });

  it("allows a fresh confirm after the active run resolves", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const first = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `guard-resolve-${f.suffix}`,
    });
    await f.prisma.releaseRun.update({
      where: { id: first.id },
      data: { status: "succeeded" },
    });
    const next = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `guard-resolve-next-${f.suffix}`,
    });
    expect(next.id).not.toBe(first.id);
    await f.prisma.releaseRun.update({
      where: { id: next.id },
      data: { status: "failed" },
    });
  });

  it("pins the freeze/D13 protection in the run snapshot: synthetic verified, real revision fail-closed", async () => {
    const f = fixture;
    const preview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    const synthetic = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: preview.inputHash,
      idempotencyKey: `freeze-synthetic-${f.suffix}`,
    });
    expect(snapshotProtection(synthetic.policySnapshot)).toEqual({
      changeWindowVerified: true,
      freezeVerified: true,
    });
    await f.prisma.releaseRun.update({
      where: { id: synthetic.id },
      data: { status: "failed" },
    });

    const repository = new ReleasePolicyRepository(f.prisma as never);
    const revision = await repository.create(
      f.teamId,
      f.projectId,
      f.userId,
      { strategy: "standard", requireProductionApproval: true },
    );
    expect(revision.snapshotHash).toMatch(/^[0-9a-f]{64}$/);
    const realPreview = await f.repository.preview(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
    );
    expect(realPreview.inputHash).not.toBe(preview.inputHash);
    const real = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: realPreview.inputHash,
      idempotencyKey: `freeze-real-${f.suffix}`,
    });
    expect(real.releasePolicyRevisionId).toBe(revision.id);
    expect(snapshotProtection(real.policySnapshot)).toEqual({
      changeWindowVerified: false,
      freezeVerified: false,
    });
    await f.prisma.releaseRun.update({
      where: { id: real.id },
      data: { status: "failed" },
    });
  });
});

function snapshotProtection(value: unknown) {
  const recordValue =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const protection = recordValue.releaseProtection;
  return protection && typeof protection === "object" && !Array.isArray(protection)
    ? (protection as Record<string, unknown>)
    : null;
}
