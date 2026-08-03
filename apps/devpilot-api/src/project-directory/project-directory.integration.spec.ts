import "reflect-metadata";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectDirectoryRepository } from "./project-directory.repository";

const describeIntegration =
  process.env.RUN_PROJECT_DIRECTORY_INTEGRATION === "1"
    ? describe
    : describe.skip;

describeIntegration("ProjectDirectoryRepository integration", () => {
  const prisma = new PrismaClient();
  const repository = new ProjectDirectoryRepository(
    prisma as unknown as PrismaService,
  );
  const suffix = randomUUID();
  const userId = `user-${suffix}`;
  const teamA = `team-a-${suffix}`;
  const teamB = `team-b-${suffix}`;

  beforeAll(async () => {
    await prisma.user.create({
      data: { id: userId, email: `${suffix}@example.com`, role: "user" },
    });
    await prisma.team.createMany({
      data: [
        { id: teamA, name: "Team A" },
        { id: teamB, name: "Team B" },
      ],
    });
    await seedProject(teamA, "project-a", "Alpha Payments", "run-a");
    await seedProject(teamB, "project-b", "Beta Private", "run-b");
    await prisma.project.create({
      data: {
        id: `project-archived-${suffix}`,
        teamId: teamA,
        createdById: userId,
        name: "Archived Payments",
        config: {},
        archivedAt: new Date(),
      },
    });
  });

  afterAll(() => prisma.$disconnect());

  it("returns only searched, non-archived team projects and their own runs", async () => {
    const projects = await repository.list(teamA, "Payments");

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(`project-a-${suffix}`);
    expect(projects[0].repositoryAnalysisRuns.map((run) => run.id)).toEqual([
      `run-a-${suffix}`,
    ]);
    expect(JSON.stringify(projects)).not.toContain(`run-b-${suffix}`);
  });

  it("searches repository and domain fields within the same team scope", async () => {
    await expect(
      repository.list(teamA, "git.example/project-a"),
    ).resolves.toHaveLength(1);
    await expect(
      repository.list(teamA, "alpha-payments.example"),
    ).resolves.toHaveLength(1);
    await expect(
      repository.list(teamB, "alpha-payments.example"),
    ).resolves.toHaveLength(0);
  });

  async function seedProject(
    teamId: string,
    projectLabel: string,
    name: string,
    runLabel: string,
  ) {
    const projectId = `${projectLabel}-${suffix}`;
    const connectionId = `connection-${projectLabel}-${suffix}`;
    await prisma.project.create({
      data: { id: projectId, teamId, createdById: userId, name, config: {} },
    });
    await prisma.repositoryConnection.create({
      data: {
        id: connectionId,
        teamId,
        projectId,
        provider: "generic",
        repositoryUrl: `https://git.example/${projectId}.git`,
        status: "connected",
      },
    });
    await prisma.repositoryAnalysisRun.create({
      data: {
        id: `${runLabel}-${suffix}`,
        teamId,
        projectId,
        connectionId,
        repositoryUrl: `https://git.example/${projectId}.git`,
        branch: "main",
        commitSha: "a".repeat(40),
        status: "succeeded",
        idempotencyKey: `analysis-${projectId}`,
        parserVersion: "integration",
      },
    });
    await prisma.site.create({
      data: {
        id: `site-${projectLabel}-${suffix}`,
        teamId,
        createdById: userId,
        projectId,
        name: `${name} site`,
        primaryDomain: `${projectLabel === "project-a" ? "alpha-payments" : "beta-private"}.example.com`,
      },
    });
  }
});
