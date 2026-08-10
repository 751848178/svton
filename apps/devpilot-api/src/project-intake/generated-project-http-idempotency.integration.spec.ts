import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import * as path from "path";
import type { GenerateProjectRequestDto } from "../generator/dto/generate.dto";
import { GeneratedProjectController } from "../generator/generated-project.controller";
import {
  describeProjectIntakeIntegration,
  useProjectIntakeFinalizationIntegrationFixture,
} from "./project-intake-finalization.integration-fixture";

describeProjectIntakeIntegration("Generated project HTTP idempotency", () => {
  const fixture = useProjectIntakeFinalizationIntegrationFixture();
  const originalArtifactRoot = process.env.DEVPILOT_GENERATED_PROJECTS_DIR;
  const accessPolicy = {
    assertCanSelfServiceWrite: jest.fn().mockResolvedValue({ allowed: true }),
  };
  const controller = new GeneratedProjectController(
    fixture.generatedCreation,
    accessPolicy as never,
  );
  const request = () => ({
    user: { id: fixture.actorId },
    teamId: fixture.teamId,
  });
  let artifactRoot: string;

  beforeAll(async () => {
    artifactRoot = await mkdtemp(path.join(tmpdir(), "f414-http-idempotency-"));
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

  it("replays one READY project after response loss and rejects changed input", async () => {
    const dto = generatedDto("http-response-loss", "HTTP response loss");
    const lostResponse = responseMock(true);

    await expect(
      controller.generateProject(dto, request(), lostResponse as never),
    ).rejects.toThrow("simulated response loss");
    const retryResponse = responseMock();
    await controller.generateProject(dto, request(), retryResponse as never);

    const projectId = readProjectId(retryResponse);
    await expect(
      controller.generateProject(
        { ...dto, basicInfo: { ...dto.basicInfo, name: "Changed input" } },
        request(),
        responseMock() as never,
      ),
    ).rejects.toMatchObject({
      response: { code: "GENERATED_PROJECT_IDEMPOTENCY_MISMATCH" },
    });
    await expect(
      fixture.prisma.project.count({ where: { id: projectId } }),
    ).resolves.toBe(1);
    await expect(
      fixture.prisma.projectEnvironment.count({
        where: { projectId, baselineRole: { not: null } },
      }),
    ).resolves.toBe(2);
    await expect(
      fixture.prisma.environmentConfigRevision.count({ where: { projectId } }),
    ).resolves.toBe(2);
  });

  it("concurrent transport calls converge and remain replayable", async () => {
    const dto = generatedDto("http-concurrent", "HTTP concurrent");
    const responses = [responseMock(), responseMock()];
    const outcomes = await Promise.allSettled(
      responses.map((response) =>
        controller.generateProject(dto, request(), response as never),
      ),
    );
    expect(outcomes.some(({ status }) => status === "fulfilled")).toBe(true);

    const replay = responseMock();
    await controller.generateProject(dto, request(), replay as never);
    const projectId = readProjectId(replay);
    await expect(
      fixture.prisma.project.count({
        where: { id: projectId, name: "HTTP concurrent" },
      }),
    ).resolves.toBe(1);
    await expect(
      fixture.prisma.auditEvent.count({
        where: { projectId, action: "project.generate.finalize" },
      }),
    ).resolves.toBe(1);
  });
});

function generatedDto(
  idempotencyKey: string,
  name: string,
): GenerateProjectRequestDto {
  return {
    idempotencyKey,
    basicInfo: { name, packageManager: "pnpm" },
    subProjects: { backend: true, admin: false, mobile: false },
    features: [],
    uiLibrary: { admin: false, mobile: false },
    hooks: false,
  };
}

function responseMock(throwOnSend = false) {
  return {
    set: jest.fn(),
    send: jest.fn(() => {
      if (throwOnSend) throw new Error("simulated response loss");
    }),
  };
}

function readProjectId(response: ReturnType<typeof responseMock>): string {
  const headers = response.set.mock.calls.at(-1)?.[0] as Record<string, string>;
  return headers["X-Project-Id"];
}
