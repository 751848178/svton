import "reflect-metadata";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { EnvironmentVersionReadRepository } from "./environment-version-read.repository";
import { EnvironmentVersionRepository } from "./environment-version.repository";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseOrderDetailRepository } from "./release-order-detail.repository";
import { ReleaseOrderListRepository } from "./release-order-list.repository";
import { ReleaseOrderListService } from "./release-order-list.service";
import type { ReleaseOrderLifecycleStatus } from "./release-order-lifecycle.types";
import { ReleaseOrderWithdrawRepository } from "./release-order-withdraw.repository";
import { ReleaseOrderWithdrawService } from "./release-order-withdraw.service";
import { ReleaseProductionRepository } from "./release-production.repository";
import { ReleaseStagingRepository } from "./release-staging.repository";

const describeIntegration =
  process.env.RUN_RELEASE_ORDER_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration(
  "release order lifecycle and withdrawal real MySQL integration",
  () => {
    const prisma = new PrismaClient();
    const db = prisma as unknown as PrismaService;
    const list = new ReleaseOrderListService(
      new ReleaseOrderListRepository(db),
    );
    const details = new ReleaseOrderDetailRepository(db);
    const withdrawals = new ReleaseOrderWithdrawService(
      new ReleaseOrderWithdrawRepository(db),
      details,
    );
    const staging = new ReleaseStagingRepository(db);
    const suffix = randomUUID();
    const keepBrowserFixture = process.env.KEEP_F420_BROWSER_FIXTURE === "1";
    const actorId = `f420-user-${suffix}`;
    const teamId = `f420-team-${suffix}`;
    const otherTeamId = `f420-other-team-${suffix}`;
    const projectId = `f420-project-${suffix}`;
    const otherProjectId = `f420-other-project-${suffix}`;
    const inactiveStagingProjectId = `f420-inactive-staging-project-${suffix}`;
    const inactiveProductionProjectId = `f420-inactive-production-project-${suffix}`;
    const stagingId = `f420-staging-${suffix}`;
    const productionId = `f420-production-${suffix}`;
    const inactiveStagingOrderId = `f420-inactive-staging-order-${suffix}`;
    const inactiveProductionOrderId = `f420-inactive-production-order-${suffix}`;
    const archivedStagingId = `f420-archived-staging-${suffix}`;
    const inactiveStagingDevelopmentId = `f420-inactive-staging-dev-${suffix}`;
    const inactiveStagingProductionId = `f420-inactive-staging-prod-${suffix}`;
    const inactiveProductionStagingId = `f420-inactive-prod-staging-${suffix}`;
    const archivedProductionId = `f420-archived-production-${suffix}`;
    const inactiveProductionDevelopmentId = `f420-inactive-prod-dev-${suffix}`;
    const scopedProjectIds = [
      projectId,
      otherProjectId,
      inactiveStagingProjectId,
      inactiveProductionProjectId,
    ];
    const ids = Object.fromEntries(
      [
        "draft",
        "building",
        "staging",
        "awaiting",
        "production",
        "succeeded",
        "failed",
        "blocked",
        "canceledRun",
        "mismatch",
        "approvalMismatch",
        "legacy",
        "withdrawBefore",
        "withdrawAfter",
        "raceAction",
        "raceWithdraw",
        "invalidProduction",
        "otherTeam",
      ].map((key) => [key, `f420-${key}-${suffix}`]),
    ) as Record<string, string>;

    beforeAll(async () => {
      await seedScope();
      await seedLifecycleFixtures();
      await seedInactiveEvidenceFixtures();
    });

    afterAll(async () => {
      if (keepBrowserFixture) {
        console.log(
          "F420_BROWSER_FIXTURE",
          JSON.stringify({
            email: `${suffix}@f420.example`,
            teamId,
            otherTeamId,
            projectId,
            otherProjectId,
            ids,
          }),
        );
        await prisma.$disconnect();
        return;
      }
      await prisma.projectEnvironment.updateMany({
        where: { projectId: { in: scopedProjectIds } },
        data: { currentEnvironmentVersionId: null },
      });
      const projectScope = { projectId: { in: scopedProjectIds } };
      await prisma.environmentVersion.deleteMany({ where: projectScope });
      await prisma.deploymentRun.deleteMany({ where: projectScope });
      await prisma.releaseRun.deleteMany({ where: projectScope });
      await prisma.operationApproval.deleteMany({ where: projectScope });
      await prisma.auditEvent.deleteMany({ where: projectScope });
      await prisma.artifactManifest.deleteMany({ where: projectScope });
      await prisma.buildRun.deleteMany({ where: projectScope });
      await prisma.releaseOrder.deleteMany({
        where: { projectId: { in: scopedProjectIds } },
      });
      await prisma.projectEnvironment.deleteMany({ where: projectScope });
      await prisma.project.deleteMany({
        where: { id: { in: scopedProjectIds } },
      });
      await prisma.team.deleteMany({
        where: { id: { in: [teamId, otherTeamId] } },
      });
      await prisma.user.deleteMany({ where: { id: actorId } });
      await prisma.$disconnect();
    });

    it("projects all eight visible states from one list/detail contract and filters server-side", async () => {
      const expected: Record<string, ReleaseOrderLifecycleStatus> = {
        draft: "draft",
        building: "building",
        staging: "staging",
        awaiting: "awaiting_approval",
        production: "production",
        succeeded: "succeeded",
        failed: "failed",
        blocked: "failed",
        canceledRun: "failed",
        mismatch: "failed",
        approvalMismatch: "failed",
        legacy: "withdrawn",
      };
      const result = await orders();
      for (const [key, status] of Object.entries(expected)) {
        const item = required(
          result.items.find((candidate) => candidate.id === ids[key]),
        );
        expect(item.lifecycle.status).toBe(status);
        expect(
          required(await details.find(teamId, projectId, ids[key])).lifecycle,
        ).toEqual(item.lifecycle);
      }
      for (const status of [
        "draft",
        "building",
        "staging",
        "awaiting_approval",
        "production",
        "succeeded",
        "failed",
      ] as const) {
        const filtered = await orders(status);
        expect(filtered.items.length).toBeGreaterThan(0);
        expect(
          filtered.items.every((item) => item.lifecycle.status === status),
        ).toBe(true);
      }
      expect(
        result.items.some((item) => item.projectId === otherProjectId),
      ).toBe(false);
    });

    it("preserves exact failure kinds and fails closed on Production evidence mismatch", async () => {
      const result = await orders();
      expect(lifecycle(result, "failed")).toMatchObject({
        status: "failed",
        phase: "build",
        failureKind: "failed",
      });
      expect(lifecycle(result, "blocked")).toMatchObject({
        status: "failed",
        phase: "staging",
        failureKind: "blocked",
      });
      expect(lifecycle(result, "canceledRun")).toMatchObject({
        status: "failed",
        phase: "build",
        failureKind: "canceled",
      });
      expect(lifecycle(result, "mismatch")).toMatchObject({
        status: "failed",
        phase: "production",
        failureKind: "evidence_mismatch",
      });
      expect(lifecycle(result, "approvalMismatch")).toMatchObject({
        status: "failed",
        phase: "production",
        sourceStatus: "awaiting_approval",
        failureKind: "evidence_mismatch",
      });
      expect(lifecycle(result, "succeeded")).not.toHaveProperty("failureKind");
      expect(lifecycle(result, "legacy")).toEqual({
        status: "withdrawn",
        phase: "preflight",
        sourceType: "withdrawal",
        sourceId: ids.legacy,
        sourceStatus: "canceled",
        occurredAt: at(12, 9).toISOString(),
      });
    });

    it("excludes archived and non-baseline environments from lifecycle, counts, and lastExecution", async () => {
      const archivedStaging = required(
        (
          await list.list(teamId, actorId, inactiveStagingProjectId, {
            take: 50,
          })
        ).items[0],
      );
      expect(archivedStaging.lifecycle).toMatchObject({
        status: "staging",
        phase: "build",
        sourceType: "build_run",
      });
      expect(archivedStaging.deployment.count).toBe(0);
      expect(archivedStaging.lastExecution).toMatchObject({
        sourceType: "build_run",
        sourceId: `${inactiveStagingOrderId}-build`,
      });

      const archivedProduction = required(
        (
          await list.list(teamId, actorId, inactiveProductionProjectId, {
            take: 50,
          })
        ).items[0],
      );
      expect(archivedProduction.lifecycle).toMatchObject({
        status: "staging",
        phase: "staging",
        sourceType: "deployment_run",
      });
      expect(archivedProduction.deployment.count).toBe(1);
      expect(archivedProduction.lastExecution).toMatchObject({
        sourceType: "deployment_run",
        sourceId: `${inactiveProductionOrderId}-active-staging`,
      });
      expect(
        required(
          await details.find(
            teamId,
            inactiveProductionProjectId,
            inactiveProductionOrderId,
          ),
        ).lifecycle,
      ).toEqual(archivedProduction.lifecycle);
    });

    it("keeps every newest invalid Production deployment visible and fails closed", async () => {
      const cases = [
        "orphan",
        "wrongReleaseOrder",
        "wrongManifest",
        "wrongEnvironment",
        "wrongScope",
        "missingApproval",
        "wrongApproval",
        "foreignApproval",
        "failedRelease",
      ] as const;
      for (const [index, kind] of cases.entries()) {
        const deploymentId = await seedInvalidProductionEvidence(kind, index);
        const item = required(
          (await orders()).items.find(
            (candidate) => candidate.id === ids.invalidProduction,
          ),
        );
        expect(item.lifecycle).toMatchObject({
          status: "failed",
          phase: "production",
          sourceType: "deployment_run",
          sourceId: deploymentId,
          failureKind: "evidence_mismatch",
        });
        expect(
          required(await details.find(teamId, projectId, ids.invalidProduction))
            .lifecycle,
        ).toEqual(item.lifecycle);
      }
    });

    it("withdraws before and after execution idempotently while preserving history and current version", async () => {
      const versionBefore = await prisma.projectEnvironment.findUniqueOrThrow({
        where: { id: productionId },
        select: { currentEnvironmentVersionId: true },
      });
      const historyBefore = await historyCounts(ids.withdrawAfter);
      const [first, replay] = await Promise.all([
        withdrawals.withdraw({
          teamId,
          actorId,
          projectId,
          releaseOrderId: ids.withdrawAfter,
        }),
        withdrawals.withdraw({
          teamId,
          actorId,
          projectId,
          releaseOrderId: ids.withdrawAfter,
        }),
      ]);
      expect(replay).toEqual(first);
      expect(first).not.toHaveProperty("withdrawalChanged");
      expect(first).not.toHaveProperty("status");
      expect(first.lifecycle.status).toBe("withdrawn");
      expect(first.lifecycle.phase).toBe("production");
      expect(first.persistedStatus).toBe("canceled");
      expect(await historyCounts(ids.withdrawAfter)).toEqual(historyBefore);
      expect(
        await prisma.projectEnvironment.findUniqueOrThrow({
          where: { id: productionId },
          select: { currentEnvironmentVersionId: true },
        }),
      ).toEqual(versionBefore);
      expect(
        await prisma.auditEvent.count({
          where: {
            teamId,
            projectId,
            targetId: ids.withdrawAfter,
            action: "project.release_order.withdraw",
          },
        }),
      ).toBe(1);
      expect(
        (await orders("withdrawn")).items.map((item) => item.id),
      ).toContain(ids.withdrawAfter);
      expect(
        (
          await new EnvironmentVersionReadRepository(db).candidates(
            teamId,
            projectId,
          )
        ).staging.some((candidate) => candidate.releaseOrder.id === ids.withdrawAfter),
      ).toBe(false);

      const beforeExecution = await withdrawals.withdraw({
        teamId,
        actorId,
        projectId,
        releaseOrderId: ids.withdrawBefore,
      });
      expect(beforeExecution.lifecycle).toMatchObject({
        status: "withdrawn",
        phase: "preflight",
      });
    });

    it("rejects every future action boundary after withdrawal", async () => {
      const orderId = ids.withdrawAfter;
      const manifestId = manifestIdFor(orderId);
      const snapshot = {
        version: 2 as const,
        repositoryUrl: "https://example.invalid/f420.git",
        repositoryIdentity: {
          id: "unused",
          revisionId: "unused",
          revision: 1,
          provider: "github",
          canonicalUrl: "https://example.invalid/f420.git",
        },
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        components: [],
      };
      await expect(
        new ReleaseBuildRepository(db).reserve({
          teamId,
          projectId,
          releaseOrderId: orderId,
          actorId,
          snapshot,
          inputHash: "b".repeat(64),
          expectedCanonicalKey: "example.invalid/f420",
        }),
      ).rejects.toThrow("已撤回");
      await expect(
        staging.create({
          teamId,
          projectId,
          releaseOrderId: orderId,
          actorId,
          environmentId: stagingId,
          configRevisionId: null,
          manifestId,
          sourceBranch: "main",
          sourceCommitSha: "a".repeat(40),
          params: {},
        }),
      ).rejects.toThrow("已撤回");
      await expect(
        new ReleaseProductionRepository(db).confirm({
          teamId,
          projectId,
          releaseOrderId: orderId,
          manifestId,
          actorId,
          expectedInputHash: "c".repeat(64),
          idempotencyKey: "withdrawn-production",
        }),
      ).rejects.toThrow("已撤回");
      await expect(
        new EnvironmentVersionRepository(db).reserve({
          teamId,
          projectId,
          releaseOrderId: orderId,
          actorId,
          environmentId: productionId,
          configRevisionId: null,
          manifestId,
          mode: "deploy",
          branch: "main",
          commitSha: "a".repeat(40),
          params: {},
        }),
      ).rejects.toThrow("已撤回");
    });

    it("serializes action-wins and withdraw-wins races on the same ReleaseOrder row", async () => {
      const actionOrder = ids.raceAction;
      const actionLocked = deferred();
      const releaseAction = deferred();
      const actionPromise = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM ReleaseOrder WHERE id = ${actionOrder} FOR UPDATE`;
        actionLocked.resolve();
        await releaseAction.promise;
        await tx.deploymentRun.create({
          data: deployment(actionOrder, "running", 20),
        });
      });
      await actionLocked.promise;
      const withdrawAfterAction = new ReleaseOrderWithdrawRepository(
        db,
      ).withdraw({
        teamId,
        actorId,
        projectId,
        releaseOrderId: actionOrder,
      });
      releaseAction.resolve();
      await Promise.all([actionPromise, withdrawAfterAction]);
      expect(
        await prisma.deploymentRun.count({
          where: { artifactManifestId: manifestIdFor(actionOrder) },
        }),
      ).toBe(1);
      expect(
        required(await details.find(teamId, projectId, actionOrder)).lifecycle
          .status,
      ).toBe("withdrawn");

      const withdrawnOrder = ids.raceWithdraw;
      const withdrawLocked = deferred();
      const releaseWithdraw = deferred();
      const lockThenWithdraw = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM ReleaseOrder WHERE id = ${withdrawnOrder} FOR UPDATE`;
        await tx.releaseOrder.update({
          where: { id: withdrawnOrder },
          data: { status: "canceled" },
        });
        withdrawLocked.resolve();
        await releaseWithdraw.promise;
        await tx.auditEvent.create({ data: withdrawalAudit(withdrawnOrder) });
      });
      await withdrawLocked.promise;
      const blockedAction = staging.create({
        teamId,
        projectId,
        releaseOrderId: withdrawnOrder,
        actorId,
        environmentId: stagingId,
        configRevisionId: null,
        manifestId: manifestIdFor(withdrawnOrder),
        sourceBranch: "main",
        sourceCommitSha: "a".repeat(40),
        params: {},
      });
      releaseWithdraw.resolve();
      await lockThenWithdraw;
      await expect(blockedAction).rejects.toThrow("已撤回");
    });

    function orders(status?: ReleaseOrderLifecycleStatus) {
      return list.list(teamId, actorId, projectId, { status, take: 50 });
    }

    function lifecycle(
      result: Awaited<ReturnType<typeof orders>>,
      key: string,
    ) {
      return required(result.items.find((item) => item.id === ids[key]))
        .lifecycle;
    }

    async function historyCounts(releaseOrderId: string) {
      const [builds, releases, deployments, versions] = await Promise.all([
        prisma.buildRun.count({ where: { releaseOrderId } }),
        prisma.releaseRun.count({ where: { releaseOrderId } }),
        prisma.deploymentRun.count({
          where: { artifactManifest: { releaseOrderId } },
        }),
        prisma.environmentVersion.count({ where: { releaseOrderId } }),
      ]);
      return { builds, releases, deployments, versions };
    }

    async function seedScope() {
      await prisma.user.create({
        data: {
          id: actorId,
          email: `${suffix}@f420.example`,
          role: keepBrowserFixture ? "admin" : "user",
          passwordHash: keepBrowserFixture
            ? await bcrypt.hash(process.env.F420_BROWSER_PASSWORD || "", 10)
            : null,
        },
      });
      await prisma.team.createMany({
        data: [
          { id: teamId, name: "F420 Team" },
          { id: otherTeamId, name: "F420 Other Team" },
        ],
      });
      await prisma.project.createMany({
        data: [
          {
            id: projectId,
            teamId,
            createdById: actorId,
            name: "F420",
            config: {},
          },
          {
            id: otherProjectId,
            teamId: otherTeamId,
            createdById: actorId,
            name: "F420 Other",
            config: {},
          },
          {
            id: inactiveStagingProjectId,
            teamId,
            createdById: actorId,
            name: "F420 Inactive Staging Evidence",
            config: {},
          },
          {
            id: inactiveProductionProjectId,
            teamId,
            createdById: actorId,
            name: "F420 Inactive Production Evidence",
            config: {},
          },
        ],
      });
      await prisma.teamMember.createMany({
        data: [
          { teamId, userId: actorId, role: "owner" },
          { teamId: otherTeamId, userId: actorId, role: "owner" },
        ],
      });
      await prisma.projectEnvironment.createMany({
        data: [
          {
            id: stagingId,
            teamId,
            projectId,
            key: "staging",
            name: "Staging",
            baselineRole: "staging",
          },
          {
            id: productionId,
            teamId,
            projectId,
            key: "production",
            name: "Production",
            baselineRole: "production",
          },
          {
            id: archivedStagingId,
            teamId,
            projectId: inactiveStagingProjectId,
            key: "archived-staging",
            name: "Archived Staging",
            status: "archived",
            baselineRole: "staging",
          },
          {
            id: inactiveStagingProductionId,
            teamId,
            projectId: inactiveStagingProjectId,
            key: "production",
            name: "Production",
            baselineRole: "production",
          },
          {
            id: inactiveStagingDevelopmentId,
            teamId,
            projectId: inactiveStagingProjectId,
            key: "development",
            name: "Development",
            baselineRole: "development",
          },
          {
            id: inactiveProductionStagingId,
            teamId,
            projectId: inactiveProductionProjectId,
            key: "staging",
            name: "Staging",
            baselineRole: "staging",
          },
          {
            id: archivedProductionId,
            teamId,
            projectId: inactiveProductionProjectId,
            key: "archived-production",
            name: "Archived Production",
            status: "archived",
            baselineRole: "production",
          },
          {
            id: inactiveProductionDevelopmentId,
            teamId,
            projectId: inactiveProductionProjectId,
            key: "development",
            name: "Development",
            baselineRole: "development",
          },
        ],
      });
    }

    async function seedLifecycleFixtures() {
      const keys = Object.keys(ids);
      await prisma.releaseOrder.createMany({
        data: keys.map((key, index) => ({
          id: ids[key],
          teamId: key === "otherTeam" ? otherTeamId : teamId,
          projectId: key === "otherTeam" ? otherProjectId : projectId,
          createdById: actorId,
          releaseVersion: `f420-${String(index).padStart(2, "0")}`,
          status: key === "legacy" ? "canceled" : "draft",
          note: `F420 ${key}`,
          createdAt: at(index, 0),
          updatedAt: key === "legacy" ? at(12, 9) : at(index, 0),
        })),
      });
      await seedBuild("building", "running", 1);
      await seedBuild("staging", "succeeded", 2, true);
      await seedProduction("awaiting", "awaiting_approval", "pending", 3);
      await seedProduction("production", "awaiting_approval", "approved", 4);
      const success = await seedProduction(
        "succeeded",
        "succeeded",
        "approved",
        5,
        true,
      );
      const productionDeployment = `${ids.succeeded}-deployment`;
      const version = await prisma.environmentVersion.create({
        data: {
          id: `${ids.succeeded}-version`,
          teamId,
          projectId,
          environmentId: productionId,
          releaseOrderId: ids.succeeded,
          artifactManifestId: success.manifestId,
          deploymentRunId: productionDeployment,
          releaseRunId: success.releaseRunId,
          effectiveAt: at(5, 8),
        },
      });
      await prisma.projectEnvironment.update({
        where: { id: productionId },
        data: { currentEnvironmentVersionId: version.id },
      });
      const withdrawAfter = await seedProduction(
        "withdrawAfter",
        "succeeded",
        "approved",
        13,
        true,
      );
      const withdrawVersion = await prisma.environmentVersion.create({
        data: {
          id: `${ids.withdrawAfter}-version`,
          teamId,
          projectId,
          environmentId: productionId,
          releaseOrderId: ids.withdrawAfter,
          artifactManifestId: withdrawAfter.manifestId,
          deploymentRunId: `${ids.withdrawAfter}-deployment`,
          releaseRunId: withdrawAfter.releaseRunId,
          previousVersionId: version.id,
          effectiveAt: at(13, 8),
        },
      });
      await prisma.projectEnvironment.update({
        where: { id: productionId },
        data: { currentEnvironmentVersionId: withdrawVersion.id },
      });
      await seedBuild("failed", "failed", 6);
      await seedBuild("blocked", "succeeded", 7, true);
      await prisma.deploymentRun.create({
        data: deployment(ids.blocked, "blocked", 7),
      });
      await seedBuild("canceledRun", "canceled", 8);
      await seedProduction("mismatch", "succeeded", null, 9, false, true);
      const approvalMismatch = await seedProduction(
        "approvalMismatch",
        "awaiting_approval",
        null,
        14,
      );
      await seedMismatchedApproval(approvalMismatch.releaseRunId, 14);
      await seedBuild("raceAction", "succeeded", 10, true);
      await seedBuild("raceWithdraw", "succeeded", 11, true);
      await seedBuild("invalidProduction", "succeeded", 15, true);
    }

    async function seedInactiveEvidenceFixtures() {
      const fixtures = [
        {
          projectId: inactiveStagingProjectId,
          orderId: inactiveStagingOrderId,
          digest: `sha256:${"c".repeat(64)}`,
        },
        {
          projectId: inactiveProductionProjectId,
          orderId: inactiveProductionOrderId,
          digest: `sha256:${"d".repeat(64)}`,
        },
      ];
      await prisma.releaseOrder.createMany({
        data: fixtures.map((fixture) => ({
          id: fixture.orderId,
          teamId,
          projectId: fixture.projectId,
          createdById: actorId,
          releaseVersion: fixture.orderId,
          status: "draft",
          createdAt: at(16, 0),
        })),
      });
      for (const fixture of fixtures) {
        await prisma.buildRun.create({
          data: {
            id: `${fixture.orderId}-build`,
            teamId,
            projectId: fixture.projectId,
            releaseOrderId: fixture.orderId,
            triggeredById: actorId,
            revision: 1,
            sourceBranch: "main",
            sourceCommitSha: "a".repeat(40),
            inputSnapshot: {},
            inputHash: "b".repeat(64),
            status: "succeeded",
            startedAt: at(16, 1),
            finishedAt: at(16, 2),
            createdAt: at(16, 1),
          },
        });
        await prisma.artifactManifest.create({
          data: {
            id: `${fixture.orderId}-manifest`,
            teamId,
            projectId: fixture.projectId,
            releaseOrderId: fixture.orderId,
            buildRunId: `${fixture.orderId}-build`,
            digest: fixture.digest,
            createdAt: at(16, 3),
          },
        });
      }
      await prisma.deploymentRun.createMany({
        data: [
          inactiveDeployment(
            inactiveStagingProjectId,
            inactiveStagingOrderId,
            archivedStagingId,
            "archived-staging",
            17,
          ),
          inactiveDeployment(
            inactiveStagingProjectId,
            inactiveStagingOrderId,
            inactiveStagingDevelopmentId,
            "non-baseline",
            18,
          ),
          inactiveDeployment(
            inactiveProductionProjectId,
            inactiveProductionOrderId,
            inactiveProductionStagingId,
            "active-staging",
            17,
          ),
          inactiveDeployment(
            inactiveProductionProjectId,
            inactiveProductionOrderId,
            archivedProductionId,
            "archived-production",
            18,
          ),
          inactiveDeployment(
            inactiveProductionProjectId,
            inactiveProductionOrderId,
            inactiveProductionDevelopmentId,
            "non-baseline",
            19,
          ),
        ],
      });
    }

    function inactiveDeployment(
      fixtureProjectId: string,
      orderId: string,
      environmentId: string,
      idSuffix: string,
      day: number,
    ): Prisma.DeploymentRunUncheckedCreateInput {
      return {
        id: `${orderId}-${idSuffix}`,
        teamId,
        projectId: fixtureProjectId,
        actorId,
        environmentId,
        artifactManifestId: `${orderId}-manifest`,
        environment: idSuffix,
        source: "release_order",
        targetType: "release-artifact",
        dryRun: false,
        status: "completed",
        startedAt: at(day, 4),
        finishedAt: at(day, 4),
        createdAt: at(day, 4),
      };
    }

    async function seedBuild(
      key: string,
      status: string,
      day: number,
      withManifest = false,
    ) {
      const releaseOrderId = ids[key];
      const buildRunId = `${releaseOrderId}-build`;
      await prisma.buildRun.create({
        data: {
          id: buildRunId,
          teamId,
          projectId,
          releaseOrderId,
          triggeredById: actorId,
          revision: 1,
          sourceBranch: "main",
          sourceCommitSha: "a".repeat(40),
          inputSnapshot: {},
          inputHash: "b".repeat(64),
          status,
          startedAt: at(day, 1),
          finishedAt: status === "running" ? null : at(day, 2),
          createdAt: at(day, 1),
        },
      });
      if (withManifest) {
        await prisma.artifactManifest.create({
          data: {
            id: manifestIdFor(releaseOrderId),
            teamId,
            projectId,
            releaseOrderId,
            buildRunId,
            digest: digestFor(releaseOrderId),
            createdAt: at(day, 3),
          },
        });
      }
      return { buildRunId, manifestId: manifestIdFor(releaseOrderId) };
    }

    async function seedProduction(
      key: string,
      releaseStatus: string,
      approvalStatus: "pending" | "approved" | null,
      day: number,
      exactDeployment = false,
      mismatchedDeployment = false,
    ) {
      const releaseOrderId = ids[key];
      const { manifestId } = await seedBuild(key, "succeeded", day, true);
      await prisma.deploymentRun.create({
        data: deployment(releaseOrderId, "completed", day),
      });
      const releaseRunId = `${releaseOrderId}-release`;
      await prisma.releaseRun.create({
        data: {
          id: releaseRunId,
          teamId,
          projectId,
          releaseOrderId,
          environmentId: productionId,
          artifactManifestId: manifestId,
          actorId,
          status: releaseStatus,
          verifiedDigest: digestFor(releaseOrderId),
          inputHash: "f".repeat(64),
          idempotencyKey: `${releaseOrderId}-key`,
          startedAt: releaseStatus === "succeeded" ? at(day, 6) : null,
          finishedAt: releaseStatus === "succeeded" ? at(day, 7) : null,
          createdAt: at(day, 5),
        },
      });
      if (approvalStatus) await seedApproval(releaseRunId, approvalStatus, day);
      if (exactDeployment || mismatchedDeployment) {
        await prisma.deploymentRun.create({
          data: {
            ...deployment(releaseOrderId, "completed", day, productionId),
            id: `${releaseOrderId}-deployment`,
            releaseRunId,
            dryRun: mismatchedDeployment,
            startedAt: at(day, 8),
            finishedAt: at(day, 8),
            createdAt: at(day, 8),
          },
        });
      }
      return { manifestId, releaseRunId };
    }

    async function seedApproval(
      releaseRunId: string,
      status: "pending" | "approved",
      day: number,
    ) {
      const id = `${releaseRunId}-approval`;
      await prisma.operationApproval.create({
        data: {
          id,
          teamId,
          requesterId: actorId,
          reviewerId: status === "approved" ? actorId : null,
          projectId,
          environmentId: productionId,
          category: "release",
          action: "project.release_order.deploy_production",
          targetType: "release_run",
          targetId: releaseRunId,
          risk: "high",
          status,
          inputHash: "f".repeat(64),
          requestedAt: at(day, 5),
          reviewedAt: status === "approved" ? at(day, 6) : null,
        },
      });
      await prisma.releaseRun.update({
        where: { id: releaseRunId },
        data: { operationApprovalId: id },
      });
    }

    async function seedMismatchedApproval(releaseRunId: string, day: number) {
      const id = `${releaseRunId}-mismatched-approval`;
      await prisma.operationApproval.create({
        data: {
          id,
          teamId,
          requesterId: actorId,
          projectId,
          environmentId: productionId,
          category: "release",
          action: "project.release_order.deploy_production",
          targetType: "release_run",
          targetId: `${releaseRunId}-wrong-target`,
          risk: "high",
          status: "pending",
          inputHash: "0".repeat(64),
          requestedAt: at(day, 9),
        },
      });
      await prisma.releaseRun.update({
        where: { id: releaseRunId },
        data: { operationApprovalId: id },
      });
    }

    async function seedInvalidProductionEvidence(
      kind:
        | "orphan"
        | "wrongReleaseOrder"
        | "wrongManifest"
        | "wrongEnvironment"
        | "wrongScope"
        | "missingApproval"
        | "wrongApproval"
        | "foreignApproval"
        | "failedRelease",
      index: number,
    ) {
      const day = 20 + index;
      let releaseRunId: string | null = null;
      if (kind === "wrongReleaseOrder") {
        releaseRunId = `${ids.succeeded}-release`;
      } else if (kind !== "orphan") {
        releaseRunId = `${ids.invalidProduction}-${kind}-release`;
        const releaseTeamId = kind === "wrongScope" ? otherTeamId : teamId;
        const releaseProjectId =
          kind === "wrongScope" ? otherProjectId : projectId;
        const releaseEnvironmentId =
          kind === "wrongEnvironment" ? stagingId : productionId;
        const releaseManifestId =
          kind === "wrongManifest"
            ? manifestIdFor(ids.succeeded)
            : manifestIdFor(ids.invalidProduction);
        const releaseDigest =
          kind === "wrongManifest"
            ? digestFor(ids.succeeded)
            : digestFor(ids.invalidProduction);
        await prisma.releaseRun.create({
          data: {
            id: releaseRunId,
            teamId: releaseTeamId,
            projectId: releaseProjectId,
            releaseOrderId: ids.invalidProduction,
            environmentId: releaseEnvironmentId,
            artifactManifestId: releaseManifestId,
            actorId,
            status: kind === "failedRelease" ? "failed" : "running",
            verifiedDigest: releaseDigest,
            inputHash: "f".repeat(64),
            idempotencyKey: `${ids.invalidProduction}-${kind}`,
            startedAt: at(day, 5),
            finishedAt: kind === "failedRelease" ? at(day, 6) : null,
            createdAt: at(day, 5),
          },
        });
        if (kind !== "missingApproval") {
          const approvalId = `${releaseRunId}-approval`;
          const approvalTeamId =
            kind === "foreignApproval" ? otherTeamId : releaseTeamId;
          const approvalProjectId =
            kind === "foreignApproval" ? otherProjectId : releaseProjectId;
          await prisma.operationApproval.create({
            data: {
              id: approvalId,
              teamId: approvalTeamId,
              requesterId: actorId,
              reviewerId: actorId,
              projectId: approvalProjectId,
              environmentId: releaseEnvironmentId,
              category: "release",
              action: "project.release_order.deploy_production",
              targetType: "release_run",
              targetId:
                kind === "wrongApproval"
                  ? `${releaseRunId}-wrong-target`
                  : releaseRunId,
              risk: "high",
              status: "approved",
              inputHash:
                kind === "wrongApproval" ? "0".repeat(64) : "f".repeat(64),
              requestedAt: at(day, 5),
              reviewedAt: at(day, 6),
            },
          });
          await prisma.releaseRun.update({
            where: { id: releaseRunId },
            data: { operationApprovalId: approvalId },
          });
        }
      }
      const statuses = ["completed", "running", "failed", "blocked"] as const;
      const status = statuses[index % statuses.length]!;
      const deploymentId = `${ids.invalidProduction}-${kind}-deployment`;
      await prisma.deploymentRun.create({
        data: {
          ...deployment(ids.invalidProduction, status, day, productionId),
          id: deploymentId,
          releaseRunId,
          startedAt: at(day, 8),
          finishedAt: status === "running" ? null : at(day, 8),
          createdAt: at(day, 8),
        },
      });
      return deploymentId;
    }

    function deployment(
      releaseOrderId: string,
      status: string,
      day: number,
      environmentId = stagingId,
    ) {
      return {
        id: `${releaseOrderId}-${environmentId === stagingId ? "staging" : "production"}-${status}`,
        teamId,
        projectId,
        actorId,
        environmentId,
        artifactManifestId: manifestIdFor(releaseOrderId),
        environment: environmentId === stagingId ? "staging" : "production",
        source: "release_order",
        targetType: "release-artifact",
        dryRun: false,
        status,
        startedAt: at(day, 4),
        finishedAt: status === "running" ? null : at(day, 4),
        createdAt: at(day, 4),
      };
    }

    function withdrawalAudit(
      releaseOrderId: string,
    ): Prisma.AuditEventUncheckedCreateInput {
      return {
        teamId,
        actorId,
        projectId,
        category: "release",
        action: "project.release_order.withdraw",
        targetType: "release_order",
        targetId: releaseOrderId,
        risk: "high",
        status: "completed",
        summary: "Deterministic withdraw-wins fixture",
      };
    }

    function manifestIdFor(releaseOrderId: string) {
      return `${releaseOrderId}-manifest`;
    }

    function digestFor(releaseOrderId: string) {
      return `sha256:${releaseOrderId
        .replace(/[^a-f0-9]/gi, "a")
        .slice(-1)
        .repeat(64)}`;
    }

    function at(day: number, hour: number) {
      return new Date(
        `2026-07-${String(day + 1).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00.000Z`,
      );
    }

    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      return { promise, resolve };
    }

    function required<T>(value: T | null | undefined): T {
      if (value === null || value === undefined) {
        throw new Error("Required F420 fixture was not found");
      }
      return value;
    }
  },
);
