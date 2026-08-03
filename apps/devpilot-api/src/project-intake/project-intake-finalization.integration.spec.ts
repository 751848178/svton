import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectIntakeBaselineFinalizerService } from "./project-intake-baseline-finalizer.service";
import { ProjectIntakeFinalizationExecutorService } from "./project-intake-finalization-executor.service";
import { ProjectIntakeFinalizationRecordRepository } from "./project-intake-finalization-record.repository";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";

const enabled = process.env.RUN_PROJECT_INTAKE_INTEGRATION === "1";
const describeIntegration = enabled ? describe : describe.skip;

interface Fixture {
  projectId: string;
  runId: string;
  repositoryUrl: string;
}

describeIntegration("ProjectIntakeFinalization integration", () => {
  const prisma = new PrismaClient();
  const suffix = randomUUID();
  const teamId = `team-${suffix}`;
  const actorId = `user-${suffix}`;
  const records = new ProjectIntakeFinalizationRecordRepository(
    prisma as unknown as PrismaService,
  );
  const executor = new ProjectIntakeFinalizationExecutorService(
    prisma as unknown as PrismaService,
    new ProjectIntakeBaselineFinalizerService(),
  );
  const service = new ProjectIntakeFinalizationService(records, executor);

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: actorId, email: `${suffix}@example.com`, role: "user" },
    });
    await prisma.team.create({ data: { id: teamId, name: `Team ${suffix}` } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("finalizes once and returns the stored result for a repeated idempotency key", async () => {
    const fixture = await seedFixture(
      "standard",
      `https://git.example/${suffix}/standard.git`,
    );
    await seedEnvironment(fixture.projectId, "production", "Production");
    const dto = {
      analysisRunId: fixture.runId,
      idempotencyKey: "finalize-standard",
    };

    const first = await service.finalize(
      teamId,
      actorId,
      fixture.projectId,
      dto,
    );
    const second = await service.finalize(
      teamId,
      actorId,
      fixture.projectId,
      dto,
    );

    expect(second).toEqual(first);
    expect(
      first.environments.map((environment) => environment.key).sort(),
    ).toEqual(["production", "staging"]);
    await expectCounts(fixture.projectId, {
      identities: 1,
      finalizations: 1,
      environments: 2,
    });
  });

  it("recovers a failed finalization record with the same input", async () => {
    const fixture = await seedFixture(
      "recovery",
      `https://git.example/${suffix}/recovery.git`,
    );
    await seedEnvironment(fixture.projectId, "production", "Production");
    const idempotencyKey = "finalize-recovery";
    const inputHash = createHash("sha256")
      .update(
        JSON.stringify({
          projectId: fixture.projectId,
          analysisRunId: fixture.runId,
        }),
      )
      .digest("hex");
    await prisma.projectIntakeFinalization.create({
      data: {
        teamId,
        projectId: fixture.projectId,
        analysisRunId: fixture.runId,
        actorId,
        idempotencyKey,
        inputHash,
        status: "failed",
        errorCode: "SIMULATED_CRASH",
      },
    });

    await expect(
      service.finalize(teamId, actorId, fixture.projectId, {
        analysisRunId: fixture.runId,
        idempotencyKey,
      }),
    ).resolves.toMatchObject({ projectId: fixture.projectId });

    const record = await prisma.projectIntakeFinalization.findUniqueOrThrow({
      where: {
        projectId_idempotencyKey: {
          projectId: fixture.projectId,
          idempotencyKey,
        },
      },
    });
    expect(record.status).toBe("succeeded");
    expect(record.errorCode).toBeNull();
  });

  it("rolls back a partial baseline conflict and resumes with the same key", async () => {
    const fixture = await seedFixture(
      "partial-failure",
      `https://git.example/${suffix}/partial-failure.git`,
    );
    await seedEnvironment(fixture.projectId, "production", "Production");
    const conflicting = await prisma.projectEnvironment.create({
      data: {
        teamId,
        projectId: fixture.projectId,
        key: "legacy-stage",
        name: "Legacy Stage",
        status: "active",
        sortOrder: 0,
        baselineRole: "staging",
      },
    });
    const dto = {
      analysisRunId: fixture.runId,
      idempotencyKey: "partial-failure-finalize",
    };

    await expect(
      service.finalize(teamId, actorId, fixture.projectId, dto),
    ).rejects.toMatchObject({
      response: { code: "PROJECT_INTAKE_BASELINE_CONFLICT" },
    });
    await expectCounts(fixture.projectId, {
      identities: 0,
      finalizations: 1,
      environments: 2,
    });
    await expect(
      prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } }),
    ).resolves.toMatchObject({
      onboardingStatus: "review",
      onboardingRevision: 3,
    });

    await prisma.projectEnvironment.update({
      where: { id: conflicting.id },
      data: { baselineRole: null },
    });
    await expect(
      service.finalize(teamId, actorId, fixture.projectId, dto),
    ).resolves.toMatchObject({ projectId: fixture.projectId });
    await expectCounts(fixture.projectId, {
      identities: 1,
      finalizations: 1,
      environments: 3,
    });
  });

  it("allows only one winner for concurrent finalization keys", async () => {
    const fixture = await seedFixture(
      "concurrent",
      `https://git.example/${suffix}/concurrent.git`,
    );
    await seedEnvironment(fixture.projectId, "production", "Production");

    const outcomes = await Promise.allSettled(
      ["concurrent-a", "concurrent-b"].map((idempotencyKey) =>
        service.finalize(teamId, actorId, fixture.projectId, {
          analysisRunId: fixture.runId,
          idempotencyKey,
        }),
      ),
    );

    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    const finalizations = await prisma.projectIntakeFinalization.findMany({
      where: { projectId: fixture.projectId },
    });
    expect(
      finalizations.filter((record) => record.status === "succeeded"),
    ).toHaveLength(1);
  });

  it("rejects a canonical repository already finalized by another project", async () => {
    const repositoryUrl = `https://git.example/${suffix}/duplicate.git`;
    const first = await seedFixture("duplicate-a", repositoryUrl);
    await seedEnvironment(first.projectId, "production", "Production");
    await service.finalize(teamId, actorId, first.projectId, {
      analysisRunId: first.runId,
      idempotencyKey: "duplicate-a",
    });
    const second = await seedFixture("duplicate-b", repositoryUrl);
    await seedEnvironment(second.projectId, "production", "Production");

    await expect(
      service.finalize(teamId, actorId, second.projectId, {
        analysisRunId: second.runId,
        idempotencyKey: "duplicate-b",
      }),
    ).rejects.toMatchObject({
      response: { code: "PROJECT_REPOSITORY_DUPLICATE" },
    });
  });

  it("retains historical environments while assigning the two baseline roles", async () => {
    const fixture = await seedFixture(
      "legacy",
      `https://git.example/${suffix}/legacy.git`,
    );
    await seedEnvironment(fixture.projectId, "production", "Production");
    await seedEnvironment(fixture.projectId, "qa", "QA");

    await service.finalize(teamId, actorId, fixture.projectId, {
      analysisRunId: fixture.runId,
      idempotencyKey: "legacy-finalize",
    });

    const environments = await prisma.projectEnvironment.findMany({
      where: { projectId: fixture.projectId },
      orderBy: { key: "asc" },
    });
    expect(environments.map((environment) => environment.key)).toEqual([
      "production",
      "qa",
      "staging",
    ]);
    expect(
      environments.find((environment) => environment.key === "qa")
        ?.baselineRole,
    ).toBeNull();
  });

  it("rejects a project outside the caller team before creating a finalization record", async () => {
    const fixture = await seedFixture(
      "wrong-team",
      `https://git.example/${suffix}/wrong-team.git`,
    );

    await expect(
      service.finalize(`other-${teamId}`, actorId, fixture.projectId, {
        analysisRunId: fixture.runId,
        idempotencyKey: "wrong-team-finalize",
      }),
    ).rejects.toMatchObject({ response: { code: "PROJECT_NOT_FOUND" } });
    await expect(
      prisma.projectIntakeFinalization.count({
        where: { projectId: fixture.projectId },
      }),
    ).resolves.toBe(0);
  });

  async function seedFixture(
    label: string,
    repositoryUrl: string,
  ): Promise<Fixture> {
    const projectId = `project-${label}-${suffix}`;
    const connectionId = `connection-${label}-${suffix}`;
    const runId = `run-${label}-${suffix}`;
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: actorId,
        name: label,
        config: {},
        onboardingStatus: "review",
        onboardingRevision: 3,
      },
    });
    await prisma.repositoryConnection.create({
      data: {
        id: connectionId,
        teamId,
        projectId,
        connectedById: actorId,
        provider: "generic",
        repositoryUrl,
        selectedBranch: "main",
        defaultBranch: "main",
        commitSha: "a".repeat(40),
        status: "connected",
      },
    });
    await prisma.repositoryAnalysisRun.create({
      data: {
        id: runId,
        teamId,
        projectId,
        connectionId,
        triggeredById: actorId,
        repositoryUrl,
        branch: "main",
        commitSha: "a".repeat(40),
        status: "succeeded",
        idempotencyKey: `analysis-${label}`,
        parserVersion: "integration",
      },
    });
    await prisma.repositoryConnection.update({
      where: { id: connectionId },
      data: { lastAppliedRunId: runId, appliedAt: new Date() },
    });
    return { projectId, runId, repositoryUrl };
  }

  async function seedEnvironment(projectId: string, key: string, name: string) {
    return prisma.projectEnvironment.create({
      data: { teamId, projectId, key, name, status: "active", sortOrder: 0 },
    });
  }

  async function expectCounts(
    projectId: string,
    expected: {
      identities: number;
      finalizations: number;
      environments: number;
    },
  ) {
    const [identities, finalizations, environments] = await Promise.all([
      prisma.projectRepositoryIdentity.count({ where: { projectId } }),
      prisma.projectIntakeFinalization.count({ where: { projectId } }),
      prisma.projectEnvironment.count({ where: { projectId } }),
    ]);
    expect({ identities, finalizations, environments }).toEqual(expected);
  }
});
