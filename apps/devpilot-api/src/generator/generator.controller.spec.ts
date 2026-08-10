import { GeneratorController } from "./generator.controller";

describe("GeneratorController artifact download", () => {
  const req = { user: { id: "user-1" }, teamId: "team-1" };

  it("checks project read access before returning a generated artifact stream", async () => {
    const generatorService = {
      resolveProjectZipArtifact: jest.fn().mockResolvedValue({
        kind: "project_zip",
        storage: "local",
        fileName: "demo.zip",
        size: 3,
        sha256: "a".repeat(64),
        generatedAt: "2026-06-29T00:00:00.000Z",
        downloadUrl: "/api/projects/project-1/download",
        retentionDays: 30,
        expiresAt: "2026-07-29T00:00:00.000Z",
        downloadCount: 5,
        filePath: __filename,
      }),
    };
    const projectService = {
      findGeneratedArtifactProject: jest.fn().mockResolvedValue({
        id: "project-1",
        name: "demo",
        config: { generatedArtifact: { fileName: "demo.zip" } },
        downloadUrl: "/api/projects/project-1/download",
      }),
      recordGeneratedProjectArtifactDownload: jest.fn().mockResolvedValue({
        id: "project-1",
        config: { generatedArtifact: { downloadCount: 6 } },
      }),
    };
    const accessPolicyService = {
      assertCanRead: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const auditEventService = {
      create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    };
    const response = { set: jest.fn() };
    const controller = new GeneratorController(
      generatorService as never,
      projectService as never,
      accessPolicyService as never,
      auditEventService as never,
    );

    const result = await controller.downloadGeneratedProject(
      "project-1",
      req,
      response as never,
    );

    expect(projectService.findGeneratedArtifactProject).toHaveBeenCalledWith(
      "team-1",
      "project-1",
    );
    expect(accessPolicyService.assertCanRead).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: "team-1",
        actorId: "user-1",
        projectId: "project-1",
        action: "project.download",
      }),
    );
    expect(projectService.recordGeneratedProjectArtifactDownload).toHaveBeenCalledWith(
      "team-1",
      "project-1",
      "user-1",
      expect.objectContaining({ fileName: "demo.zip" }),
    );
    expect(auditEventService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project.artifact.download",
        metadata: expect.objectContaining({ downloadCount: 6 }),
      }),
    );
    expect(auditEventService.create.mock.calls[0][0].metadata).not.toHaveProperty(
      "filePath",
    );
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "Content-Disposition": 'attachment; filename="demo.zip"',
        "X-Project-Download-Url": "/api/projects/project-1/download",
      }),
    );
    expect(result).toBeDefined();
  });
});
