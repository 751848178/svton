import type { GenerateProjectRequestDto } from "./dto/generate.dto";
import { GeneratedProjectController } from "./generated-project.controller";

describe("GeneratedProjectController", () => {
  it("returns a reusable generated ZIP and project identity", async () => {
    const dto = createGenerateDto();
    const artifact = {
      kind: "project_zip" as const,
      storage: "local" as const,
      fileName: "demo.zip",
      size: 3,
      sha256: "a".repeat(64),
      generatedAt: "2026-06-29T00:00:00.000Z",
      downloadUrl: "/api/projects/project-1/download",
      retentionDays: 30,
      expiresAt: "2026-07-29T00:00:00.000Z",
    };
    const creationService = {
      create: jest.fn().mockResolvedValue({
        projectId: "project-1",
        zipBuffer: Buffer.from("zip"),
        artifact,
      }),
    };
    const accessPolicyService = {
      assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const response = { set: jest.fn(), send: jest.fn() };
    const controller = new GeneratedProjectController(
      creationService as never,
      accessPolicyService as never,
    );

    await controller.generateProject(
      dto,
      { user: { id: "user-1" }, teamId: "team-1" },
      response as never,
    );

    expect(creationService.create).toHaveBeenCalledWith(
      "team-1",
      "user-1",
      dto,
    );
    expect(response.set).toHaveBeenCalledWith(
      expect.objectContaining({
        "X-Project-Id": "project-1",
        "X-Project-Download-Url": "/api/projects/project-1/download",
        "Content-Disposition": 'attachment; filename="demo.zip"',
      }),
    );
    expect(response.send).toHaveBeenCalledWith(Buffer.from("zip"));
  });
});

function createGenerateDto(): GenerateProjectRequestDto {
  return {
    idempotencyKey: "generate-demo",
    basicInfo: {
      name: "demo",
      description: "Demo",
      packageManager: "pnpm",
    },
    subProjects: { backend: true, admin: false, mobile: false },
    features: [],
    resources: {},
    uiLibrary: { admin: false, mobile: false },
    hooks: false,
  };
}
