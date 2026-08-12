import "reflect-metadata";
import type { PrismaClient } from "@prisma/client";
import {
  approveProductionReleaseRun,
  confirmProductionRun,
  createProductionRealGateFixture,
  type ProductionRealGateFixture,
} from "./release-production-real-gate.integration-fixture";
import { managedCommandWorkloadConfig } from "./release-workload.integration-fixtures";

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
      expect(f.siteProbe.probe).toHaveBeenCalledWith(
        expect.objectContaining({
          environmentId: f.productionEnvironmentId,
          primaryDomain: "parity.example.test",
          tlsRequired: false,
        }),
      );
      expect(releaseRun.policySnapshot).toMatchObject({
        deploymentProviderKey: "local-filesystem-v1",
        acceptanceMode: "technical_acceptance",
      });
      await approveProductionReleaseRun(f, releaseRun.id);
      const awaiting = await f.service.execute({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        kind: "upgrade",
        manifestId: f.manifestId,
        releaseRunId: releaseRun.id,
      });

      expect(awaiting).toMatchObject({
        version: null,
        run: { status: "awaiting_validation" },
        candidate: { candidateHash: expect.any(String) },
      });
      expect(f.gates.assertAllowed).toHaveBeenCalledWith(
        expect.objectContaining({
          checkpoint: "production_pre_execution",
          target: expect.objectContaining({
            capacitySnapshotId: expect.any(String),
            dnsProbeReceiptId: expect.any(String),
          }),
        }),
      );

      const run = await prisma.deploymentRun.findUniqueOrThrow({
        where: { id: awaiting.run.id },
      });
      expect(run.result).toMatchObject({
        providerActivated: true,
        artifactVerified: true,
        checkoutInvoked: false,
        pullInvoked: false,
        buildInvoked: false,
        gitInvoked: false,
        workloadReady: { status: "passed", serviceCount: 1 },
        healthProbe: {
          status: "passed",
          processChecks: 1,
          httpChecks: 1,
        },
        httpProbe: { status: "passed", checkedServices: 1 },
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

      const candidate = exactCandidate(run.result);
      const blocked = await f.service.resumeProductionPromotion({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        releaseRunId: releaseRun.id,
        deploymentRunId: awaiting.run.id,
        candidateHash: candidate.candidateHash,
        idempotencyKey: `promote-blocked-${f.scope}`,
      });
      expect(blocked).toMatchObject({
        status: "blocked",
        awaitingValidation: true,
        manualChecks: [
          expect.objectContaining({
            gateId: "P03",
            evaluationId: expect.any(String),
          }),
        ],
      });
      const p03 = await prisma.gateEvaluation.findFirstOrThrow({
        where: {
          teamId: f.teamId,
          projectId: f.projectId,
          releaseOrderId: f.orderId,
          releaseRunId: releaseRun.id,
          gateId: "P03",
          status: "needs_human",
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      expect(p03.summary).toMatchObject({
        evidenceIdentity: { deploymentRunId: awaiting.run.id },
      });
      await f.gateEvaluations.confirmManual({
        teamId: f.teamId,
        projectId: f.projectId,
        releaseOrderId: f.orderId,
        evaluationId: p03.id,
        gateId: "P03",
        actorId: f.reviewerId,
        reason: "F437 independent candidate validation",
      });
      const completed = await f.service.resumeProductionPromotion({
        teamId: f.teamId,
        actorId: f.userId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        releaseRunId: releaseRun.id,
        deploymentRunId: awaiting.run.id,
        candidateHash: candidate.candidateHash,
        idempotencyKey: `promote-confirmed-${f.scope}`,
      });
      expect(completed).toMatchObject({
        version: {
          environmentId: f.productionEnvironmentId,
          artifactManifestId: f.manifestId,
        },
        run: { id: awaiting.run.id, status: "completed" },
      });

      const environment = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: f.productionEnvironmentId },
      });
      expect(environment.currentEnvironmentVersionId).not.toBeNull();

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

    it("records exact standard and single-host applicability without generic deferral", async () => {
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
      expect(pre!.deferredGateIds).toEqual([]);
      expect(post!.deferredGateIds).toEqual([]);
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
            item.reasonCode === "d06_not_applicable_standard_strategy",
        ),
      ).toBe(true);
      expect(
        evaluations.some(
          (item) =>
            item.gateId === "D09" &&
            item.reasonCode === "network_policy_not_applicable_single_host",
        ),
      ).toBe(true);
    });

    it("keeps a failed DeploymentRun, moves no pointer, and fails the ReleaseRun on health failure", async () => {
      const f = fixture;
      await prisma.applicationService.update({
        where: { id: f.serviceId },
        data: {
          deployConfig: {
            ...managedCommandWorkloadConfig({
              healthCheckUrl: f.healthCheckUrl,
            }),
            deployCommand: "test -f dist/missing.txt",
            statusCommand: "test -f dist/missing.txt",
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

function exactCandidate(value: unknown) {
  const result = record(value);
  const candidate = record(result.productionCandidate);
  if (typeof candidate.candidateHash !== "string") {
    throw new Error("F437 Production candidate hash missing");
  }
  return { candidateHash: candidate.candidateHash };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describeIntegration("Production first-release preflight admission", () => {
  let fixture: ProductionRealGateFixture;

  afterEach(async () => fixture?.stop());

  it("creates approval from real runless capability and evidence paths", async () => {
    fixture = await createProductionRealGateFixture(undefined, {
      firstRelease: true,
    });
    const f = fixture;
    const configured = await f.prisma.applicationService.findUniqueOrThrow({
      where: { id: f.serviceId },
      select: { name: true, ports: true },
    });
    const revision = await f.prisma.environmentConfigRevision.findUniqueOrThrow(
      {
        where: { id: f.configRevisionId },
        select: { routeSnapshot: true },
      },
    );
    expect({
      service: configured,
      route: revision.routeSnapshot,
    }).toMatchObject({
      service: { name: "api", ports: [8080] },
      route: {
        entries: [{ serviceId: f.serviceId, component: "api", port: 8080 }],
      },
    });
    const refreshed = await f.production.refreshPreflight(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
      f.userId,
    );
    expect(
      refreshed.preflight.checks.filter((check) =>
        ["D06", "D19"].includes(check.id),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "D06", status: "checked" }),
        expect.objectContaining({
          id: "D19",
          status: "checked",
          evidenceIdentity: expect.objectContaining({
            currentVersionId: null,
            historyCount: 0,
            releaseRunId: null,
          }),
        }),
      ]),
    );
    expect(
      await f.prisma.releaseRun.count({
        where: {
          environmentId: f.productionEnvironmentId,
        },
      }),
    ).toBe(0);
    const run = await f.production.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: refreshed.inputHash,
      idempotencyKey: `first-preflight-${f.scope}`,
    });
    expect(run).toMatchObject({
      status: "awaiting_approval",
      operationApproval: { status: "pending" },
    });
  });

  it("rejects first-release history drift with zero approval side effects", async () => {
    fixture = await createProductionRealGateFixture(undefined, {
      firstRelease: true,
    });
    const f = fixture;
    const refreshed = await f.production.refreshPreflight(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
      f.userId,
    );
    const admissionProof = refreshed.preflight.admissionProof;
    const deployment = await f.prisma.deploymentRun.create({
      data: {
        teamId: f.teamId,
        projectId: f.projectId,
        actorId: f.userId,
        environmentId: f.productionEnvironmentId,
        artifactManifestId: f.manifestId,
        source: "release_order",
        targetType: "release-artifact",
        status: "completed",
        dryRun: false,
        finishedAt: new Date(),
        result: { artifactVerified: true },
      },
    });
    const version = await f.prisma.environmentVersion.create({
      data: {
        teamId: f.teamId,
        projectId: f.projectId,
        environmentId: f.productionEnvironmentId,
        releaseOrderId: f.orderId,
        artifactManifestId: f.manifestId,
        deploymentRunId: deployment.id,
        effectiveAt: new Date(),
      },
    });
    await f.prisma.projectEnvironment.update({
      where: { id: f.productionEnvironmentId },
      data: { currentEnvironmentVersionId: version.id },
    });
    await expect(
      f.repository.confirm({
        teamId: f.teamId,
        projectId: f.projectId,
        releaseOrderId: f.orderId,
        manifestId: f.manifestId,
        actorId: f.userId,
        expectedInputHash: refreshed.inputHash,
        idempotencyKey: `first-drift-${f.scope}`,
        providerKey: "local-filesystem-v1",
        admissionProof,
      }),
    ).rejects.toThrow("Production 前置检查已过期或漂移");
    expect(
      await f.prisma.releaseRun.count({
        where: {
          environmentId: f.productionEnvironmentId,
        },
      }),
    ).toBe(0);
    expect(
      await f.prisma.operationApproval.count({
        where: {
          projectId: f.projectId,
          targetType: "release_run",
        },
      }),
    ).toBe(0);
  });

  it("rechecks an existing current version through real MySQL row locks", async () => {
    fixture = await createProductionRealGateFixture();
    const f = fixture;
    const refreshed = await f.production.refreshPreflight(
      f.teamId,
      f.projectId,
      f.orderId,
      f.manifestId,
      f.userId,
    );
    expect(
      refreshed.preflight.checks.find((check) => check.id === "D19"),
    ).toMatchObject({
      status: "checked",
      evidenceIdentity: {
        environmentId: f.productionEnvironmentId,
        versionId: expect.any(String),
        deploymentRunId: expect.any(String),
        deploymentStatus: "completed",
        deploymentDryRun: "false",
        manifestId: f.manifestId,
        manifestDigest: expect.stringMatching(/^sha256:/),
        manifestItemCount: 2,
      },
    });
    const run = await f.repository.confirm({
      teamId: f.teamId,
      projectId: f.projectId,
      releaseOrderId: f.orderId,
      manifestId: f.manifestId,
      actorId: f.userId,
      expectedInputHash: refreshed.inputHash,
      idempotencyKey: `existing-current-${f.scope}`,
      providerKey: "local-filesystem-v1",
      admissionProof: refreshed.preflight.admissionProof,
    });
    expect(run).toMatchObject({ status: "awaiting_approval" });
  });
});
