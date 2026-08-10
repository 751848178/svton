import type { GenerateProjectRequestDto } from "./dto/generate.dto";
import { GeneratedProjectCreationService } from "./generated-project-creation.service";

const dto = {
  idempotencyKey: "generate-demo",
  basicInfo: { name: "demo", packageManager: "pnpm" },
  subProjects: { backend: true, admin: false, mobile: false },
  features: [],
  uiLibrary: { admin: false, mobile: false },
  hooks: false,
} as GenerateProjectRequestDto;

const artifact = {
  kind: "project_zip" as const,
  storage: "local" as const,
  fileName: "attempt-demo.zip",
  size: 3,
  sha256: "a".repeat(64),
  generatedAt: "2026-08-04T00:00:00.000Z",
  downloadUrl: "/api/projects/project-1/download",
  retentionDays: 30,
  expiresAt: "2026-09-03T00:00:00.000Z",
};

describe("GeneratedProjectCreationService", () => {
  it("finalizes governance only after artifact materialization", async () => {
    const calls: string[] = [];
    const artifacts = {
      materialize: jest.fn(async () => {
        calls.push("materialize");
        return { projectId: "project-1", zipBuffer: Buffer.from("zip"), artifact };
      }),
    };
    const governance = {
      finalize: jest.fn(async () => {
        calls.push("finalize");
        return { projectId: "project-1" };
      }),
    };
    const service = new GeneratedProjectCreationService(
      { prepare: jest.fn().mockResolvedValue(draft()) } as never,
      governance as never,
      artifacts as never,
    );

    await expect(service.create("team-1", "user-1", dto)).resolves.toEqual({
      projectId: "project-1",
      zipBuffer: Buffer.from("zip"),
      artifact,
    });
    expect(calls).toEqual(["materialize", "finalize"]);
    expect(artifacts.materialize).toHaveBeenCalledWith({
      teamId: "team-1",
      actorId: "user-1",
      draft: draft(),
      dto,
    });
    expect(governance.finalize).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        expectedStatus: "draft",
        expectedRevision: 1,
        allowAlreadyReady: true,
        auditMetadata: {
          artifactSha256: artifact.sha256,
          idempotencyKey: dto.idempotencyKey,
        },
      }),
    );
  });

  it("keeps the draft unfinalized when materialization fails", async () => {
    const governance = { finalize: jest.fn() };
    const service = new GeneratedProjectCreationService(
      { prepare: jest.fn().mockResolvedValue(draft()) } as never,
      governance as never,
      {
        materialize: jest.fn().mockRejectedValue(new Error("generation failed")),
      } as never,
    );

    await expect(service.create("team-1", "user-1", dto)).rejects.toThrow(
      "generation failed",
    );
    expect(governance.finalize).not.toHaveBeenCalled();
  });
});

function draft() {
  return {
    id: "project-1",
    name: "demo",
    config: dto,
    onboardingStatus: "draft",
    onboardingRevision: 1,
    idempotencyKey: dto.idempotencyKey,
    inputHash: "input-hash",
  };
}
