import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { ProjectIntakeBaselineFinalizerService } from "./project-intake-baseline-finalizer.service";
import { ProjectIntakeFinalizationExecutorService } from "./project-intake-finalization-executor.service";
import { ProjectIntakeFinalizationRecordRepository } from "./project-intake-finalization-record.repository";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";

export interface ProjectIntakeIntegrationProject {
  projectId: string;
  runId: string;
  repositoryUrl: string;
}

export class ProjectIntakeFinalizationIntegrationFixture {
  readonly prisma = new PrismaClient();
  readonly suffix = randomUUID();
  readonly teamId = `team-${this.suffix}`;
  readonly actorId = `user-${this.suffix}`;
  readonly service: ProjectIntakeFinalizationService;

  constructor() {
    const prisma = this.prisma as unknown as PrismaService;
    const records = new ProjectIntakeFinalizationRecordRepository(prisma);
    const executor = new ProjectIntakeFinalizationExecutorService(
      prisma,
      new ProjectIntakeBaselineFinalizerService(),
    );
    this.service = new ProjectIntakeFinalizationService(records, executor);
  }

  async setup(): Promise<void> {
    await this.prisma.user.create({
      data: {
        id: this.actorId,
        email: `${this.suffix}@example.com`,
        role: "user",
      },
    });
    await this.prisma.team.create({
      data: { id: this.teamId, name: `Team ${this.suffix}` },
    });
  }

  async teardown(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async seedProject(
    label: string,
    repositoryUrl: string,
  ): Promise<ProjectIntakeIntegrationProject> {
    const projectId = `project-${label}-${this.suffix}`;
    const connectionId = `connection-${label}-${this.suffix}`;
    const runId = `run-${label}-${this.suffix}`;
    await this.prisma.project.create({
      data: {
        id: projectId,
        teamId: this.teamId,
        createdById: this.actorId,
        name: label,
        config: {},
        onboardingStatus: "review",
        onboardingRevision: 3,
      },
    });
    await this.prisma.repositoryConnection.create({
      data: {
        id: connectionId,
        teamId: this.teamId,
        projectId,
        connectedById: this.actorId,
        provider: "generic",
        repositoryUrl,
        selectedBranch: "main",
        defaultBranch: "main",
        commitSha: "a".repeat(40),
        status: "connected",
      },
    });
    await this.prisma.repositoryAnalysisRun.create({
      data: {
        id: runId,
        teamId: this.teamId,
        projectId,
        connectionId,
        triggeredById: this.actorId,
        repositoryUrl,
        branch: "main",
        commitSha: "a".repeat(40),
        status: "succeeded",
        idempotencyKey: `analysis-${label}`,
        parserVersion: "integration",
      },
    });
    await this.prisma.repositoryConnection.update({
      where: { id: connectionId },
      data: { lastAppliedRunId: runId, appliedAt: new Date() },
    });
    return { projectId, runId, repositoryUrl };
  }

  seedEnvironment(projectId: string, key: string, name: string) {
    return this.prisma.projectEnvironment.create({
      data: {
        teamId: this.teamId,
        projectId,
        key,
        name,
        status: "active",
        sortOrder: 0,
      },
    });
  }

  async expectCounts(
    projectId: string,
    expected: {
      identities: number;
      finalizations: number;
      environments: number;
    },
  ): Promise<void> {
    const [identities, finalizations, environments] = await Promise.all([
      this.prisma.projectRepositoryIdentity.count({ where: { projectId } }),
      this.prisma.projectIntakeFinalization.count({ where: { projectId } }),
      this.prisma.projectEnvironment.count({ where: { projectId } }),
    ]);
    expect({ identities, finalizations, environments }).toEqual(expected);
  }
}

export function useProjectIntakeFinalizationIntegrationFixture() {
  const fixture = new ProjectIntakeFinalizationIntegrationFixture();
  beforeAll(() => fixture.setup());
  afterAll(() => fixture.teardown());
  return fixture;
}

export const describeProjectIntakeIntegration =
  process.env.RUN_PROJECT_INTAKE_INTEGRATION === "1" ? describe : describe.skip;
