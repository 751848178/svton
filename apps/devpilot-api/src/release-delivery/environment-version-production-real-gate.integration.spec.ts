import "reflect-metadata";
import type { PrismaClient } from "@prisma/client";
import {
  approveProductionReleaseRun,
  confirmProductionRun,
  createProductionRealGateFixture,
  type ProductionRealGateFixture,
} from "./release-production-real-gate.integration-fixture";

const describeIntegration =
  process.env.RUN_F437_PRODUCTION_REAL_GATE_INTEGRATION === "1"
    ? describe
    : describe.skip;

jest.setTimeout(120_000);

describeIntegration(
  "F437 Production real gate + real provider execution",
  () => {
    let fixture: ProductionRealGateFixture;
    let prisma: PrismaClient;

    beforeAll(async () => {
      fixture = await createProductionRealGateFixture();
      prisma = fixture.prisma;
    });

    afterAll(async () => fixture.stop());

    it("succeeds end to end through the real gate + filesystem provider", async () => {
      const f = fixture;
      const releaseRun = await confirmProductionRun(f, `success-${f.scope}`);
      await approveProductionReleaseRun(f, releaseRun.id);
      const executed = await f.service.execute({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        kind: "upgrade",
        manifestId: f.manifestId,
        releaseRunId: releaseRun.id,
      });

      expect(executed.version).toMatchObject({
        environmentId: f.productionEnvironmentId,
        artifactManifestId: f.manifestId,
      });
      expect(executed.run).toMatchObject({ status: "completed" });

      const run = await prisma.deploymentRun.findUniqueOrThrow({
        where: { id: executed.run.id },
      });
      expect(run.result).toMatchObject({
        providerActivated: true,
        artifactVerified: true,
        checkoutInvoked: false,
        pullInvoked: false,
        buildInvoked: false,
        gitInvoked: false,
        workloadReady: { status: "passed", serviceCount: 1 },
        healthProbe: { status: "passed", processChecks: 1 },
      });
      expect(run.commandPlan).toMatchObject({
        checkout: false,
        pull: false,
        build: false,
      });
      expect(run.params).toMatchObject({
        configRevisionId: expect.any(String),
        deploymentInput: {
          configRevision: { snapshotHash: "f".repeat(64) },
          target: { providerKey: "local-filesystem-v1" },
        },
        workload: {
          services: [
            expect.objectContaining({
              serviceId: f.serviceId,
              executionMode: "managed-command-v1",
            }),
          ],
        },
      });

      const environment = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
      });
      expect(environment.currentEnvironmentVersionId).toBe(
        executed.version!.id,
      );
      expect(environment.currentEnvironmentVersionId).not.toBe(undefined);

      const finalRun = await prisma.releaseRun.findUniqueOrThrow({
        where: { id: releaseRun.id },
      });
      expect(finalRun.status).toBe("succeeded");
      expect(finalRun.errorCode).toBeNull();
      const approval = await prisma.operationApproval.findUniqueOrThrow({
        where: { id: releaseRun.operationApprovalId! },
      });
      expect(approval.status).toBe("approved");
      expect(approval.consumedAt).not.toBeNull();
    });

    it("defers D06/D09 at admit and finalize while preflight evidence stays unavailable", async () => {
      const f = fixture;
      const decisions = await prisma.releaseGateDecision.findMany({
        where: {
          teamId: f.teamId,
          projectId: f.projectId,
          releaseOrderId: f.orderId,
          stage: "production",
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      const pre = decisions.find((item) => item.requestKey?.startsWith("pre:"));
      const post = decisions.find((item) =>
        item.requestKey?.startsWith("final:"),
      );
      expect(pre).toBeDefined();
      expect(post).toBeDefined();
      expect(pre!.deferredGateIds).toEqual(
        expect.arrayContaining(["D06", "D09", "D17", "D20"]),
      );
      expect(post!.deferredGateIds).toEqual(
        expect.arrayContaining(["D06", "D09", "D20"]),
      );
      expect(post!.deferredGateIds).not.toContain("D17");
      expect(post!.allowed).toBe(true);

      const evaluations = await prisma.gateEvaluation.findMany({
        where: {
          teamId: f.teamId,
          projectId: f.projectId,
          releaseOrderId: f.orderId,
          gateId: { in: ["D06", "D09"] },
        },
        distinct: ["gateId", "reasonCode"],
      });
      expect(
        evaluations.some(
          (item) =>
            item.gateId === "D06" &&
            item.reasonCode === "traffic_strategy_provider_missing",
        ),
      ).toBe(true);
      expect(
        evaluations.some(
          (item) =>
            item.gateId === "D09" &&
            item.reasonCode === "network_policy_provider_missing",
        ),
      ).toBe(true);
    });

    it("keeps a failed DeploymentRun, moves no pointer, and fails the ReleaseRun on health failure", async () => {
      const f = fixture;
      await prisma.applicationService.update({
        where: { id: f.serviceId },
        data: {
          deployConfig: {
            workingDirectory: ".",
            workloadExecutionMode: "managed-command-v1",
            deployCommand: "test -f dist/missing.txt",
            statusCommand: "test -f dist/missing.txt",
            failureCleanupCommand: "true",
          },
        },
      });
      const releaseRun = await confirmProductionRun(f, `failure-${f.scope}`);
      await approveProductionReleaseRun(f, releaseRun.id);
      const before = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
        select: { currentEnvironmentVersionId: true },
      });
      const executed = await f.service.execute({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        kind: "upgrade",
        manifestId: f.manifestId,
        releaseRunId: releaseRun.id,
      });

      expect(executed.version).toBeNull();
      expect(executed.run).toMatchObject({ status: "failed" });
      const run = await prisma.deploymentRun.findUniqueOrThrow({
        where: { id: executed.run.id },
      });
      expect(JSON.stringify(run.logs)).toContain("WORKLOAD_START_FAILED");
      expect(run.error).toContain("WORKLOAD_START_FAILED");

      const after = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
        select: { currentEnvironmentVersionId: true },
      });
      expect(after.currentEnvironmentVersionId).toBe(
        before.currentEnvironmentVersionId,
      );

      const failedRun = await prisma.releaseRun.findUniqueOrThrow({
        where: { id: releaseRun.id },
      });
      expect(failedRun.status).toBe("failed");
      expect(failedRun.errorCode).toBe("ENVIRONMENT_DEPLOYMENT_FAILED");
      const approval = await prisma.operationApproval.findUniqueOrThrow({
        where: { id: releaseRun.operationApprovalId! },
      });
      expect(approval.consumedAt).toBeNull();
    });
  },
);
