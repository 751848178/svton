import "reflect-metadata";
import { EnvironmentVersionPolicyService } from "./environment-version-policy.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { EnvironmentVersionService } from "./environment-version.service";
import { EnvironmentVersionGateEvidenceRepository } from "./environment-version-gate-evidence.repository";
import { productionGateTestDouble } from "./release-gate-test-decision.spec-utils";
import { environmentVersionExecutorTestDouble } from "./release-staging-executor.spec-utils";
import {
  cleanupProductionFixture,
  createProductionFixture,
  ProductionFixture,
} from "./release-production.integration-fixture";

const describeIntegration =
  process.env.RUN_ENVIRONMENT_VERSION_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("EnvironmentVersion execute-after-approval policy", () => {
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
    );
  });

  afterAll(async () => cleanupProductionFixture(fixture));

  it("reject cannot execute: a rejected approval is refused by the service", async () => {
    const f = fixture;
    const run = await confirmRun(f, "reject-no-execute");
    await f.prisma.operationApproval.update({
      where: { id: run.operationApproval!.id },
      data: {
        status: "rejected",
        reviewerId: f.userId,
        reviewComment: "blocked by change window",
        reviewedAt: new Date(),
      },
    });

    await expect(
      service.execute({
        ...upgradeInput(f),
        releaseRunId: run.id,
      }),
    ).rejects.toThrow("未批准");

    const persisted = await f.prisma.releaseRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    expect(persisted.status).toBe("awaiting_approval");
    await expect(
      f.prisma.deploymentRun.count({ where: { releaseRunId: run.id } }),
    ).resolves.toBe(0);
  });

  it("expired, consumed and input-drifted approvals cannot execute", async () => {
    const f = fixture;
    const run = await confirmRun(f, "negative-matrix");
    const approvalId = run.operationApproval!.id;
    await approve(f, approvalId);

    await f.prisma.operationApproval.update({
      where: { id: approvalId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    await expect(execute(service, f, run.id)).rejects.toThrow("未批准");

    await f.prisma.operationApproval.update({
      where: { id: approvalId },
      data: { expiresAt: null },
    });
    await f.prisma.operationApproval.update({
      where: { id: approvalId },
      data: { consumedAt: new Date() },
    });
    await expect(execute(service, f, run.id)).rejects.toThrow("未批准");

    await f.prisma.operationApproval.update({
      where: { id: approvalId },
      data: { consumedAt: null },
    });
    await f.prisma.operationApproval.update({
      where: { id: approvalId },
      data: { inputHash: "drifted-input-hash" },
    });
    await expect(execute(service, f, run.id)).rejects.toThrow("未批准");

    const persisted = await f.prisma.releaseRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    expect(persisted.status).toBe("awaiting_approval");
  });

  it("concurrent execute converges to exactly one Production DeploymentRun", async () => {
    const f = fixture;
    const run = await confirmRun(f, "concurrent-execute");
    await approve(f, run.operationApproval!.id);

    const results = await Promise.allSettled([
      execute(service, f, run.id),
      execute(service, f, run.id),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);

    await expect(
      f.prisma.deploymentRun.count({ where: { releaseRunId: run.id } }),
    ).resolves.toBe(1);
    const finalRun = await f.prisma.releaseRun.findUniqueOrThrow({
      where: { id: run.id },
    });
    expect(finalRun.status).toBe("succeeded");
  });
});

async function confirmRun(f: ProductionFixture, key: string) {
  const preview = await f.repository.preview(
    f.teamId,
    f.projectId,
    f.orderId,
    f.manifestId,
  );
  return f.repository.confirm({
    teamId: f.teamId,
    projectId: f.projectId,
    releaseOrderId: f.orderId,
    manifestId: f.manifestId,
    actorId: f.userId,
    expectedInputHash: preview.inputHash,
    idempotencyKey: `${key}-${f.suffix}`,
  });
}

async function approve(f: ProductionFixture, approvalId: string) {
  await f.prisma.operationApproval.update({
    where: { id: approvalId },
    data: { status: "approved", reviewerId: f.userId, reviewedAt: new Date() },
  });
}

function upgradeInput(f: ProductionFixture) {
  return {
    teamId: f.teamId,
    actorId: f.userId,
    projectId: f.projectId,
    environmentId: f.productionEnvironmentId,
    kind: "upgrade" as const,
    manifestId: f.manifestId,
  };
}

function execute(
  service: EnvironmentVersionService,
  f: ProductionFixture,
  releaseRunId: string,
) {
  return service.execute({
    ...upgradeInput(f),
    releaseRunId,
  });
}
