import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import type { GenerateProjectRequestDto } from "./dto/generate.dto";
import { GeneratedProjectArtifactMaterializationService } from "./generated-project-artifact-materialization.service";

const dto = {
  idempotencyKey: "recover-generated-project",
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
const selection = { artifact, resolvedResources: [] };

describe("GeneratedProjectArtifactMaterializationService", () => {
  let directory: string;
  let filePath: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "f414-artifact-attempt-"));
    filePath = path.join(directory, artifact.fileName);
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it("retains a selected ZIP after attachment failure and reuses it on retry", async () => {
    const { generator, claims } = dependencies(filePath);
    const projects = {
      attachGeneratedProjectArtifact: jest
        .fn()
        .mockRejectedValueOnce(new Error("attachment failed"))
        .mockResolvedValueOnce({ id: "project-1" }),
    };
    const service = new GeneratedProjectArtifactMaterializationService(
      generator as never,
      projects as never,
      claims as never,
    );

    await expect(service.materialize(input())).rejects.toThrow("attachment failed");
    await expect(readFile(filePath)).resolves.toEqual(Buffer.from("zip"));
    await expect(service.materialize(input())).resolves.toMatchObject({
      projectId: "project-1",
      artifact,
    });
    expect(generator.persistProjectZipArtifact).toHaveBeenCalledTimes(1);
    expect(projects.attachGeneratedProjectArtifact).toHaveBeenCalledTimes(2);
  });

  it("deletes only its unique file and releases ownership before selection", async () => {
    const { generator, claims } = dependencies(filePath);
    claims.select.mockRejectedValue(new Error("selection failed"));
    claims.findSelected.mockResolvedValue(null);
    const service = new GeneratedProjectArtifactMaterializationService(
      generator as never,
      { attachGeneratedProjectArtifact: jest.fn() } as never,
      claims as never,
    );

    await expect(service.materialize(input())).rejects.toThrow("selection failed");
    await expect(readFile(filePath)).rejects.toThrow();
    expect(claims.release).toHaveBeenCalledWith("team-1", "project-1", "owner-1");
  });
});

function dependencies(filePath: string) {
  const generator = {
    resolveProjectResources: jest.fn().mockResolvedValue({ credentials: [], summary: [] }),
    generateProject: jest.fn().mockResolvedValue([{ path: "README.md", content: "demo" }]),
    createZipBuffer: jest.fn().mockResolvedValue(Buffer.from("zip")),
    persistProjectZipArtifact: jest.fn(async () => {
      await writeFile(filePath, Buffer.from("zip"));
      return artifact;
    }),
    resolveProjectZipArtifact: jest.fn().mockResolvedValue({ ...artifact, filePath }),
  };
  const claims = {
    acquire: jest
      .fn()
      .mockResolvedValueOnce({ kind: "owned", ownerToken: "owner-1" })
      .mockResolvedValueOnce({ kind: "selected", ...selection }),
    adoptSelected: jest.fn(),
    select: jest.fn().mockResolvedValue(selection),
    findSelected: jest.fn().mockResolvedValue(selection),
    release: jest.fn().mockResolvedValue({ count: 1 }),
  };
  return { generator, claims };
}

function input() {
  return {
    teamId: "team-1",
    actorId: "user-1",
    dto,
    draft: {
      id: "project-1",
      name: "demo",
      config: dto,
      idempotencyKey: dto.idempotencyKey,
      inputHash: "input-hash",
    },
  };
}
