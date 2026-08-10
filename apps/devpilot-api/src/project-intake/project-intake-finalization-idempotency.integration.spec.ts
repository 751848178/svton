import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";

describeProjectIntakeIntegration(
  "ProjectIntakeFinalization idempotency integration",
  () => {
    const fixture = useProjectIntakeFinalizationIntegrationFixture();

    it("finalizes once and returns the stored result for a repeated idempotency key", async () => {
      const project = await fixture.seedProject(
        "standard",
        `https://git.example/${fixture.suffix}/standard.git`,
      );
      await fixture.seedEnvironment(
        project.projectId,
        "production",
        "Production",
      );
      const dto = {
        analysisRunId: project.runId,
        reviewSnapshotId: project.reviewSnapshotId,
        reviewSnapshotHash: project.reviewSnapshotHash,
        idempotencyKey: "finalize-standard",
      };

      const first = await fixture.service.finalize(
        fixture.teamId,
        fixture.actorId,
        project.projectId,
        dto,
      );
      const second = await fixture.service.finalize(
        fixture.teamId,
        fixture.actorId,
        project.projectId,
        dto,
      );

      expect(second).toEqual(first);
      expect(first.environments.map(({ key }) => key).sort()).toEqual([
        "production",
        "staging",
      ]);
      await fixture.expectCounts(project.projectId, {
        identities: 1,
        finalizations: 1,
        environments: 2,
      });
      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          project.projectId,
          {
            analysisRunId: `different-${project.runId}`,
            reviewSnapshotId: project.reviewSnapshotId,
            reviewSnapshotHash: project.reviewSnapshotHash,
            idempotencyKey: dto.idempotencyKey,
          },
        ),
      ).rejects.toMatchObject({
        response: { code: "PROJECT_INTAKE_IDEMPOTENCY_MISMATCH" },
      });
    });

  },
);
