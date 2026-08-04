import { GeneratedProjectArtifactCleanupController } from "./generated-project-artifact-cleanup.controller";

describe("GeneratedProjectArtifactCleanupController", () => {
  it("cleans current-team artifacts and redacts storage paths", async () => {
    const generatorService = {
      cleanupExpiredProjectZipArtifacts: jest.fn().mockResolvedValue({
        dryRun: false,
        scanned: 2,
        expired: 1,
        deleted: 1,
        artifacts: [
          {
            filePath: "/var/private/team-1/project-1/demo.zip",
            teamId: "team-1",
            projectId: "project-1",
            fileName: "demo.zip",
            size: 3,
            generatedAt: "2026-06-01T00:00:00.000Z",
            expiresAt: "2026-06-08T00:00:00.000Z",
            deleted: true,
          },
        ],
      }),
    };
    const accessPolicyService = {
      assertCanWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    };
    const controller = new GeneratedProjectArtifactCleanupController(
      generatorService as never,
      accessPolicyService as never,
      auditEventService as never,
    );

    const result = await controller.cleanupGeneratedProjectArtifacts(
      { dryRun: false, projectId: "project-1" },
      { user: { id: "user-1" }, teamId: "team-1" },
    );

    expect(accessPolicyService.assertCanWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        actorId: "user-1",
        action: "project.artifact.cleanup",
        risk: "high",
      }),
    );
    expect(auditEventService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ deleted: 1 }),
      }),
    );
    expect(result).toEqual({
      dryRun: false,
      scanned: 2,
      expired: 1,
      deleted: 1,
      artifacts: [
        {
          teamId: "team-1",
          projectId: "project-1",
          fileName: "demo.zip",
          size: 3,
          generatedAt: "2026-06-01T00:00:00.000Z",
          expiresAt: "2026-06-08T00:00:00.000Z",
          deleted: true,
        },
      ],
    });
  });
});
