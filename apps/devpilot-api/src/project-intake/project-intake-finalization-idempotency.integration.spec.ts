import { createHash } from "crypto";
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
    });

    it("recovers a failed finalization record with the same input", async () => {
      const project = await fixture.seedProject(
        "recovery",
        `https://git.example/${fixture.suffix}/recovery.git`,
      );
      await fixture.seedEnvironment(
        project.projectId,
        "production",
        "Production",
      );
      const idempotencyKey = "finalize-recovery";
      const inputHash = createHash("sha256")
        .update(
          JSON.stringify({
            projectId: project.projectId,
            analysisRunId: project.runId,
          }),
        )
        .digest("hex");
      await fixture.prisma.projectIntakeFinalization.create({
        data: {
          teamId: fixture.teamId,
          projectId: project.projectId,
          analysisRunId: project.runId,
          actorId: fixture.actorId,
          idempotencyKey,
          inputHash,
          status: "failed",
          errorCode: "SIMULATED_CRASH",
        },
      });

      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          project.projectId,
          { analysisRunId: project.runId, idempotencyKey },
        ),
      ).resolves.toMatchObject({ projectId: project.projectId });

      const record =
        await fixture.prisma.projectIntakeFinalization.findUniqueOrThrow({
          where: {
            projectId_idempotencyKey: {
              projectId: project.projectId,
              idempotencyKey,
            },
          },
        });
      expect(record.status).toBe("succeeded");
      expect(record.errorCode).toBeNull();
    });

    it("rolls back a partial baseline conflict and resumes with the same key", async () => {
      const project = await fixture.seedProject(
        "partial-failure",
        `https://git.example/${fixture.suffix}/partial-failure.git`,
      );
      await fixture.seedEnvironment(
        project.projectId,
        "production",
        "Production",
      );
      const conflicting = await fixture.prisma.projectEnvironment.create({
        data: {
          teamId: fixture.teamId,
          projectId: project.projectId,
          key: "legacy-stage",
          name: "Legacy Stage",
          status: "active",
          sortOrder: 0,
          baselineRole: "staging",
        },
      });
      const dto = {
        analysisRunId: project.runId,
        idempotencyKey: "partial-failure-finalize",
      };

      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          project.projectId,
          dto,
        ),
      ).rejects.toMatchObject({
        response: { code: "PROJECT_INTAKE_BASELINE_CONFLICT" },
      });
      await fixture.expectCounts(project.projectId, {
        identities: 0,
        finalizations: 1,
        environments: 2,
      });
      await expect(
        fixture.prisma.project.findUniqueOrThrow({
          where: { id: project.projectId },
        }),
      ).resolves.toMatchObject({
        onboardingStatus: "review",
        onboardingRevision: 3,
      });

      await fixture.prisma.projectEnvironment.update({
        where: { id: conflicting.id },
        data: { baselineRole: null },
      });
      await expect(
        fixture.service.finalize(
          fixture.teamId,
          fixture.actorId,
          project.projectId,
          dto,
        ),
      ).resolves.toMatchObject({ projectId: project.projectId });
      await fixture.expectCounts(project.projectId, {
        identities: 1,
        finalizations: 1,
        environments: 3,
      });
    });

  },
);
