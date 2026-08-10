import { mkdtemp, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import type { GenerateProjectRequestDto } from "../generator/dto/generate.dto";
import { GeneratedProjectArtifactMaterializationService } from "../generator/generated-project-artifact-materialization.service";
import { GeneratedProjectCreationService } from "../generator/generated-project-creation.service";
import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";

describeProjectIntakeIntegration("Generated artifact ownership", () => {
  const fixture = useProjectIntakeFinalizationIntegrationFixture();
  const previousRoot = process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
  let artifactRoot: string;

  beforeAll(async () => {
    artifactRoot = await mkdtemp(path.join(tmpdir(), "f414-artifact-owner-"));
    process.env.DEVPILOT_GENERATED_PROJECTS_DIR = artifactRoot;
  });

  afterAll(async () => {
    if (previousRoot === undefined) delete process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
    else process.env.DEVPILOT_GENERATED_PROJECTS_DIR = previousRoot;
    await rm(artifactRoot, { recursive: true, force: true });
  });

  it("keeps the selected ZIP when one concurrent attachment fails", async () => {
    let attachmentStarted!: () => void;
    let rejectAttachment!: () => void;
    const started = new Promise<void>((resolve) => { attachmentStarted = resolve; });
    const rejectNow = new Promise<void>((resolve) => { rejectAttachment = resolve; });
    const failingProjects = {
      attachGeneratedProjectArtifact: jest.fn(async () => {
        attachmentStarted();
        await rejectNow;
        throw new Error("injected sibling attachment failure");
      }),
    };
    const failingArtifacts = new GeneratedProjectArtifactMaterializationService(
      fixture.generator,
      failingProjects as never,
      fixture.generatedClaims,
    );
    const failingCreation = new GeneratedProjectCreationService(
      fixture.generatedDrafts,
      fixture.governance,
      failingArtifacts,
    );
    const dto = generatedDto();

    const failing = failingCreation.create(fixture.teamId, fixture.actorId, dto);
    await started;
    const winner = await fixture.generatedCreation.create(
      fixture.teamId,
      fixture.actorId,
      dto,
    );
    rejectAttachment();
    await expect(failing).rejects.toThrow("injected sibling attachment failure");
    const replay = await fixture.generatedCreation.create(
      fixture.teamId,
      fixture.actorId,
      dto,
    );

    expect(replay.projectId).toBe(winner.projectId);
    expect(replay.artifact.sha256).toBe(winner.artifact.sha256);
    const claim = await fixture.prisma.generatedProjectArtifactClaim.findUniqueOrThrow({
      where: { projectId: winner.projectId },
    });
    expect(claim.status).toBe("selected");
    expect((claim.artifact as { sha256: string }).sha256).toBe(winner.artifact.sha256);
    const resolved = await fixture.generator.resolveProjectZipArtifact(
      fixture.teamId,
      winner.projectId,
      dto.basicInfo.name,
      { generatedArtifact: winner.artifact },
    );
    await expect(stat(resolved.filePath)).resolves.toMatchObject({ size: winner.artifact.size });
    await expect(
      fixture.prisma.auditEvent.count({
        where: { projectId: winner.projectId, action: "project.generate.finalize" },
      }),
    ).resolves.toBe(1);
  });
});

function generatedDto(): GenerateProjectRequestDto {
  return {
    idempotencyKey: "artifact-owner-race",
    basicInfo: { name: "Artifact owner race", packageManager: "pnpm" },
    subProjects: { backend: true, admin: false, mobile: false },
    features: [],
    uiLibrary: { admin: false, mobile: false },
    hooks: false,
  };
}
