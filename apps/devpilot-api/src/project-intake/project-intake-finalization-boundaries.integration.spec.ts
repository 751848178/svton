import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";

describeProjectIntakeIntegration(
  "ProjectIntakeFinalization boundary integration",
  () => {
    const fixture = useProjectIntakeFinalizationIntegrationFixture();

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
      await expect(fixture.service.finalize(
        fixture.teamId,
        fixture.actorId,
        project.projectId,
        {
          analysisRunId: project.runId,
          reviewSnapshotId: project.reviewSnapshotId,
          reviewSnapshotHash: "b".repeat(64),
          idempotencyKey: "review-mismatch",
        },
      )).rejects.toMatchObject({
        response: { code: "PROJECT_INTAKE_ANALYSIS_NOT_APPLIED" },
      });
      await expect(fixture.prisma.projectRepositoryIdentity.count({
        where: { projectId: project.projectId },
      })).resolves.toBe(0);
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

      expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(
        1,
      );
      const finalizations =
        await fixture.prisma.projectIntakeFinalization.findMany({
          where: { projectId: project.projectId },
        });
      expect(
        finalizations.filter(({ status }) => status === "succeeded"),
      ).toHaveLength(1);
    });
  },
);
