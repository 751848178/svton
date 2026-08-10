import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import type { GenerateProjectRequestDto } from "../generator/dto/generate.dto";
import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";

describeProjectIntakeIntegration("Project governance convergence", () => {
  const fixture = useProjectIntakeFinalizationIntegrationFixture();
  const originalArtifactRoot = process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
  let artifactRoot: string;

  beforeAll(async () => {
    artifactRoot = await mkdtemp(path.join(tmpdir(), "f414-generated-projects-"));
    process.env.DEVPILOT_GENERATED_PROJECTS_DIR = artifactRoot;
  });

  afterAll(async () => {
    if (originalArtifactRoot === undefined) {
      delete process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
    } else {
      process.env.DEVPILOT_GENERATED_PROJECTS_DIR = originalArtifactRoot;
    }
    await rm(artifactRoot, { recursive: true, force: true });
  });

  const generatedDto = (idempotencyKey: string) => ({
    idempotencyKey,
    basicInfo: {
      name: `Generated ${idempotencyKey}`,
      packageManager: "pnpm",
    },
    subProjects: { backend: true, admin: false, mobile: false },
    features: [],
    uiLibrary: { admin: false, mobile: false },
    hooks: false,
  }) as GenerateProjectRequestDto;

  it("converges generated and imported projects on READY baselines and R1 pointers", async () => {
    const generated = await fixture.generatedCreation.create(
      fixture.teamId,
      fixture.actorId,
      generatedDto("converge-generated"),
    );
    const repeatedGenerated = await fixture.generatedCreation.create(
      fixture.teamId,
      fixture.actorId,
      generatedDto("converge-generated"),
    );
    expect(repeatedGenerated.projectId).toBe(generated.projectId);
    expect(repeatedGenerated.artifact.sha256).toBe(generated.artifact.sha256);
    await expect(
      fixture.generatedCreation.create(
        fixture.teamId,
        fixture.actorId,
        {
          ...generatedDto("converge-generated"),
          basicInfo: {
            ...generatedDto("converge-generated").basicInfo,
            name: "Different generated input",
          },
        },
      ),
    ).rejects.toMatchObject({
      response: { code: "GENERATED_PROJECT_IDEMPOTENCY_MISMATCH" },
    });

    const importedDraft = await fixture.seedProject(
      "converge-imported",
      `https://git.example/${fixture.suffix}/converge-imported.git`,
    );
    const imported = await fixture.service.finalize(
      fixture.teamId,
      fixture.actorId,
      importedDraft.projectId,
      {
        analysisRunId: importedDraft.runId,
        reviewSnapshotId: importedDraft.reviewSnapshotId,
        reviewSnapshotHash: importedDraft.reviewSnapshotHash,
        idempotencyKey: "converge-imported",
      },
    );

    for (const projectId of [generated.projectId, imported.projectId]) {
      const project = await fixture.prisma.project.findUniqueOrThrow({
        where: { id: projectId },
      });
      const environments = await fixture.prisma.projectEnvironment.findMany({
        where: { projectId, status: "active" },
      });
      const revisions = await fixture.prisma.environmentConfigRevision.findMany({
        where: { projectId },
      });
      expect(project.onboardingStatus).toBe("ready");
      expect(environments).toHaveLength(2);
      expect(environments.map(({ key }) => key).sort()).toEqual([
        "production",
        "staging",
      ]);
      expect(environments.every(({ currentConfigRevisionId }) => currentConfigRevisionId)).toBe(true);
      expect(revisions.map(({ revision }) => revision)).toEqual([1, 1]);
    }
  });

  it("rolls back a failed generated finalization and remains recoverable", async () => {
    const dto = generatedDto("generated-recovery");
    const draft = await fixture.generatedDrafts.prepare({
      teamId: fixture.teamId,
      actorId: fixture.actorId,
      name: dto.basicInfo.name,
      config: dto,
      idempotencyKey: dto.idempotencyKey,
    });
    const conflicting = await fixture.seedEnvironment(
      draft.id,
      "legacy-stage",
      "Legacy Stage",
    );
    await fixture.prisma.projectEnvironment.update({
      where: { id: conflicting.id },
      data: { baselineRole: "staging" },
    });

    await expect(
      fixture.generatedCreation.create(fixture.teamId, fixture.actorId, dto),
    ).rejects.toBeDefined();
    const failed = await fixture.prisma.project.findUniqueOrThrow({
      where: { id: draft.id },
    });
    expect(failed).toMatchObject({
      onboardingStatus: "draft",
      onboardingRevision: 1,
    });
    const failedConfig = failed.config as Record<string, unknown>;
    const reusableArtifact = failedConfig.generatedArtifact as Record<string, unknown>;
    expect(reusableArtifact.sha256).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      fixture.prisma.environmentConfigRevision.count({
        where: { projectId: draft.id },
      }),
    ).resolves.toBe(0);

    await fixture.prisma.projectEnvironment.update({
      where: { id: conflicting.id },
      data: { baselineRole: null },
    });
    const recovered = await fixture.generatedCreation.create(
      fixture.teamId,
      fixture.actorId,
      dto,
    );
    expect(recovered).toMatchObject({ projectId: draft.id });
    expect(recovered.artifact.sha256).toBe(reusableArtifact.sha256);
  });

});
