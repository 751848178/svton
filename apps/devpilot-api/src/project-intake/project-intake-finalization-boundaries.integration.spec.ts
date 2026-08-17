import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";
import { ProjectArchiveService } from "../project/project-archive.service";
import { PrismaService } from "../prisma/prisma.service";
import { RepositoryIdentityCoordinatorService } from "../repository-identity/repository-identity-coordinator.service";
import { RepositoryAnalysisRunClaimRepository } from "../repository-analysis/repository-analysis-run-claim.repository";
import { RepositoryAnalysisRunRepository } from "../repository-analysis/repository-analysis-run.repository";

describeProjectIntakeIntegration(
  "ProjectIntakeFinalization boundary integration",
  () => {
    const fixture = useProjectIntakeFinalizationIntegrationFixture();

    it("keeps archived intake history immutable and rejects finalization", async () => {
      const project = await fixture.seedProject(
        "archived-write",
        `https://git.example/${fixture.suffix}/archived-write.git`,
      );
      const before =
        await fixture.prisma.repositoryConnection.findUniqueOrThrow({
          where: { projectId: project.projectId },
        });
      await new ProjectArchiveService(
        fixture.prisma as unknown as PrismaService,
      ).archive(fixture.teamId, fixture.actorId, project.projectId);

      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          project.projectId,
          {
            analysisRunId: project.runId,
            reviewSnapshotId: project.reviewSnapshotId,
            reviewSnapshotHash: project.reviewSnapshotHash,
            idempotencyKey: "archived-write",
          },
        ),
      ).rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
      });
      await expect(
        fixture.prisma.repositoryConnection.findUniqueOrThrow({
          where: { projectId: project.projectId },
        }),
      ).resolves.toEqual(before);
      await expect(
        fixture.prisma.projectIntakeFinalization.count({
          where: { projectId: project.projectId },
        }),
      ).resolves.toBe(0);
      await expect(
        fixture.prisma.projectRepositoryIdentityRevision.count({
          where: { projectId: project.projectId },
        }),
      ).resolves.toBe(0);
    });

    it("rejects a canonical repository already finalized by another project", async () => {
      const repositoryUrl = `https://git.example/${fixture.suffix}/duplicate.git`;
      const first = await fixture.seedProject("duplicate-a", repositoryUrl);
      await fixture.seedEnvironment(
        first.projectId,
        "production",
        "Production",
      );
      await fixture.service.finalize(
        fixture.teamId,
        fixture.actorId,
        first.projectId,
        {
          analysisRunId: first.runId,
          reviewSnapshotId: first.reviewSnapshotId,
          reviewSnapshotHash: first.reviewSnapshotHash,
          idempotencyKey: "duplicate-a",
        },
      );
      const second = await fixture.seedProject("duplicate-b", repositoryUrl);
      await fixture.seedEnvironment(
        second.projectId,
        "production",
        "Production",
      );

      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          second.projectId,
          {
            analysisRunId: second.runId,
            reviewSnapshotId: second.reviewSnapshotId,
            reviewSnapshotHash: second.reviewSnapshotHash,
            idempotencyKey: "duplicate-b",
          },
        ),
      ).rejects.toMatchObject({
        response: { code: "PROJECT_REPOSITORY_DUPLICATE" },
      });
    });

    it("retains historical environments while assigning the two baseline roles", async () => {
      const project = await fixture.seedProject(
        "legacy",
        `https://git.example/${fixture.suffix}/legacy.git`,
      );
      await fixture.seedEnvironment(
        project.projectId,
        "production",
        "Production",
      );
      await fixture.seedEnvironment(project.projectId, "qa", "QA");

      await fixture.service.finalize(
        fixture.teamId,
        fixture.actorId,
        project.projectId,
        {
          analysisRunId: project.runId,
          reviewSnapshotId: project.reviewSnapshotId,
          reviewSnapshotHash: project.reviewSnapshotHash,
          idempotencyKey: "legacy-finalize",
        },
      );

      const environments = await fixture.prisma.projectEnvironment.findMany({
        where: { projectId: project.projectId },
        orderBy: { key: "asc" },
      });
      expect(environments.map(({ key }) => key)).toEqual([
        "production",
        "qa",
        "staging",
      ]);
      expect(
        environments.find(({ key }) => key === "qa")?.baselineRole,
      ).toBeNull();
    });

    it("rejects a project outside the caller team before creating a finalization record", async () => {
      const project = await fixture.seedProject(
        "wrong-team",
        `https://git.example/${fixture.suffix}/wrong-team.git`,
      );

      await expect(
        fixture.service.finalize(
          `other-${fixture.teamId}`,
          fixture.actorId,
          project.projectId,
          {
            analysisRunId: project.runId,
            reviewSnapshotId: project.reviewSnapshotId,
            reviewSnapshotHash: project.reviewSnapshotHash,
            idempotencyKey: "wrong-team-finalize",
          },
        ),
      ).rejects.toMatchObject({ response: { code: "PROJECT_NOT_FOUND" } });
      await expect(
        fixture.prisma.projectIntakeFinalization.count({
          where: { projectId: project.projectId },
        }),
      ).resolves.toBe(0);
    });

    it("rejects a mismatched immutable review snapshot hash", async () => {
      const project = await fixture.seedProject(
        "review-mismatch",
        `https://git.example/${fixture.suffix}/review-mismatch.git`,
      );
      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          project.projectId,
          {
            analysisRunId: project.runId,
            reviewSnapshotId: project.reviewSnapshotId,
            reviewSnapshotHash: "b".repeat(64),
            idempotencyKey: "review-mismatch",
          },
        ),
      ).rejects.toMatchObject({
        response: { code: "PROJECT_INTAKE_ANALYSIS_NOT_APPLIED" },
      });
      await expect(
        fixture.prisma.projectRepositoryIdentity.count({
          where: { projectId: project.projectId },
        }),
      ).resolves.toBe(0);
    });

    it("allows only one winner for concurrent finalization keys", async () => {
      const project = await fixture.seedProject(
        "concurrent",
        `https://git.example/${fixture.suffix}/concurrent.git`,
      );
      await fixture.seedEnvironment(
        project.projectId,
        "production",
        "Production",
      );

      const outcomes = await Promise.allSettled(
        ["concurrent-a", "concurrent-b"].map((idempotencyKey) =>
          fixture.service.finalize(
            fixture.teamId,
            fixture.actorId,
            project.projectId,
            {
              analysisRunId: project.runId,
              reviewSnapshotId: project.reviewSnapshotId,
              reviewSnapshotHash: project.reviewSnapshotHash,
              idempotencyKey,
            },
          ),
        ),
      );

      expect(
        outcomes.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      const finalizations =
        await fixture.prisma.projectIntakeFinalization.findMany({
          where: { projectId: project.projectId },
        });
      expect(
        finalizations.filter(({ status }) => status === "succeeded"),
      ).toHaveLength(1);
    });

    it("serializes archive and analysis claim with one domain winner", async () => {
      const project = await fixture.seedProject(
        "archive-claim-race",
        `https://git.example/${fixture.suffix}/archive-claim-race.git`,
      );
      const prisma = fixture.prisma as unknown as PrismaService;
      const claims = new RepositoryAnalysisRunClaimRepository(
        new RepositoryIdentityCoordinatorService(prisma),
      );
      const archive = new ProjectArchiveService(prisma);

      const outcomes = await Promise.allSettled([
        claims.start({
          teamId: fixture.teamId,
          projectId: project.projectId,
          triggeredById: fixture.actorId,
          branch: "main",
          idempotencyKey: "archive-claim-race",
          parserVersion: "integration",
        }),
        archive.archive(fixture.teamId, fixture.actorId, project.projectId),
      ]);

      expect(outcomes.filter(({ status }) => status === "fulfilled"))
        .toHaveLength(1);
      const state = await fixture.prisma.project.findUniqueOrThrow({
        where: { id: project.projectId },
        select: { archivedAt: true },
      });
      const activeRuns = await fixture.prisma.repositoryAnalysisRun.count({
        where: { projectId: project.projectId, status: { in: ["queued", "running"] } },
      });
      expect(
        (state.archivedAt !== null && activeRuns === 0)
        || (state.archivedAt === null && activeRuns === 1),
      ).toBe(true);
      const rejected = outcomes.find(({ status }) => status === "rejected");
      expect(rejected).toMatchObject({ status: "rejected" });
      const reason = (rejected as PromiseRejectedResult).reason;
      const detail = reason instanceof Error
        ? `${(reason as Error & { code?: string }).code ?? ""}:${reason.message}`
        : JSON.stringify(reason);
      expect(detail).not.toContain("P2034");
    });

    it("rejects archive after a queued claim and rejects a claim after archive", async () => {
      const prisma = fixture.prisma as unknown as PrismaService;
      const claims = new RepositoryAnalysisRunClaimRepository(
        new RepositoryIdentityCoordinatorService(prisma),
      );
      const archive = new ProjectArchiveService(prisma);
      const claimed = await fixture.seedProject(
        "claim-before-archive",
        `https://git.example/${fixture.suffix}/claim-before-archive.git`,
      );
      await claims.start({
        teamId: fixture.teamId,
        projectId: claimed.projectId,
        triggeredById: fixture.actorId,
        branch: "main",
        idempotencyKey: "claim-before-archive",
        parserVersion: "integration",
      });
      await expect(archive.archive(
        fixture.teamId, fixture.actorId, claimed.projectId,
      )).rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVE_REPOSITORY_ANALYSIS_ACTIVE" },
      });

      const archived = await fixture.seedProject(
        "archive-before-claim",
        `https://git.example/${fixture.suffix}/archive-before-claim.git`,
      );
      await archive.archive(fixture.teamId, fixture.actorId, archived.projectId);
      await expect(claims.start({
        teamId: fixture.teamId,
        projectId: archived.projectId,
        triggeredById: fixture.actorId,
        branch: "main",
        idempotencyKey: "archive-before-claim",
        parserVersion: "integration",
      })).rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
      });
    });

    it("keeps a legacy archived queued run unchanged on start and cancel", async () => {
      const project = await fixture.seedProject(
        "archived-queued",
        `https://git.example/${fixture.suffix}/archived-queued.git`,
      );
      const prisma = fixture.prisma as unknown as PrismaService;
      await new ProjectArchiveService(prisma)
        .archive(fixture.teamId, fixture.actorId, project.projectId);
      const connection = await fixture.prisma.repositoryConnection.findUniqueOrThrow({
        where: { projectId: project.projectId },
      });
      const run = await fixture.prisma.repositoryAnalysisRun.create({
        data: {
          teamId: fixture.teamId,
          projectId: project.projectId,
          connectionId: connection.id,
          triggeredById: fixture.actorId,
          repositoryUrl: project.repositoryUrl,
          branch: "main",
          commitSha: "a".repeat(40),
          status: "queued",
          activeKey: "active",
          idempotencyKey: "legacy-archived-queued",
          parserVersion: "integration",
        },
      });
      const runs = new RepositoryAnalysisRunRepository(prisma);

      await expect(runs.start(run.id, "archived-worker-token")).rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
      });
      await expect(runs.requestCancel(
        fixture.teamId, project.projectId, run.id,
      )).rejects.toMatchObject({
        response: { code: "PROJECT_ARCHIVED_READ_ONLY" },
      });
      await expect(fixture.prisma.repositoryAnalysisRun.findUniqueOrThrow({
        where: { id: run.id },
      })).resolves.toMatchObject({
        status: "queued", startedAt: null, cancelRequestedAt: null,
      });
      await expect(fixture.prisma.repositoryAnalysisStage.count({
        where: { runId: run.id },
      })).resolves.toBe(0);
    });
  },
);
