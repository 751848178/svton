import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RepositoryIdentityFinalizerService } from "../repository-identity/repository-identity-finalizer.service";
import { ProjectGovernanceBaselineService } from "../project/project-governance-baseline.service";
import { ProjectGovernanceServiceTopologyService } from "../project/project-governance-service-topology.service";
import { ProjectGovernanceFinalizationService } from "../project/project-governance-finalization.service";
import { GeneratedProjectDraftService } from "../project/generated-project-draft.service";
import { ProjectService } from "../project/project.service";
import { ProjectDuplicateGuardService } from "../project/project-duplicate-guard.service";
import { GeneratorService } from "../generator/generator.service";
import { GeneratedProjectCreationService } from "../generator/generated-project-creation.service";
import { GeneratedProjectArtifactClaimService } from "../generator/generated-project-artifact-claim.service";
import { GeneratedProjectArtifactMaterializationService } from "../generator/generated-project-artifact-materialization.service";
import { RegistryService } from "../registry/registry.service";
import { ProjectIntakeFinalizationExecutorService } from "./project-intake-finalization-executor.service";
import { ProjectIntakeFinalizationRecordRepository } from "./project-intake-finalization-record.repository";
import { ProjectIntakeFinalizationService } from "./project-intake-finalization.service";
import { RepositoryIntakeSnapshotIntegrityService } from "./repository-intake-snapshot-integrity.service";

export interface ProjectIntakeIntegrationProject {
  projectId: string;
  runId: string;
  reviewSnapshotId: string;
  reviewSnapshotHash: string;
  repositoryUrl: string;
}
export class ProjectIntakeFinalizationIntegrationFixture {
  readonly prisma = new PrismaClient();
  readonly suffix = randomUUID();
  readonly teamId = `team-${this.suffix}`;
  readonly actorId = `user-${this.suffix}`;
  readonly service: ProjectIntakeFinalizationService;
  readonly governance: ProjectGovernanceFinalizationService;
  readonly generatedDrafts: GeneratedProjectDraftService;
  readonly generatedCreation: GeneratedProjectCreationService;
  readonly generatedClaims: GeneratedProjectArtifactClaimService;
  readonly generator: GeneratorService;
  readonly projects: ProjectService;

  constructor() {
    const prisma = this.prisma as unknown as PrismaService;
    const records = new ProjectIntakeFinalizationRecordRepository(prisma);
    this.governance = new ProjectGovernanceFinalizationService(
      prisma,
      new ProjectGovernanceBaselineService(),
      new ProjectGovernanceServiceTopologyService(),
    );
    this.generatedDrafts = new GeneratedProjectDraftService(prisma);
    const registry = new RegistryService();
    registry.onModuleInit();
    this.generator = new GeneratorService(
      registry,
      {} as never,
      {} as never,
      {} as never,
    );
    this.projects = new ProjectService(
      prisma,
      {} as never,
      new ProjectDuplicateGuardService(prisma),
    );
    this.generatedClaims = new GeneratedProjectArtifactClaimService(prisma);
    const materialization = new GeneratedProjectArtifactMaterializationService(
      this.generator,
      this.projects,
      this.generatedClaims,
    );
    this.generatedCreation = new GeneratedProjectCreationService(
      this.generatedDrafts,
      this.governance,
      materialization,
    );
    const executor = new ProjectIntakeFinalizationExecutorService(
      prisma,
      this.governance,
      new RepositoryIdentityFinalizerService(),
      new RepositoryIntakeSnapshotIntegrityService(),
    );
    this.service = new ProjectIntakeFinalizationService(
      prisma,
      records,
      executor,
    );
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
    const reviewSnapshotId = `review-${label}-${this.suffix}`;
    const reviewSnapshotHash = createHash("sha256")
      .update(`${runId}:review`)
      .digest("hex");
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
    await this.prisma.repositoryIntakeReviewSnapshot.create({
      data: {
        id: reviewSnapshotId,
        teamId: this.teamId,
        projectId,
        runId,
        actorId: this.actorId,
        inputHash: createHash("sha256").update(`${runId}:input`).digest("hex"),
        snapshotHash: reviewSnapshotHash,
        branch: "main",
        commitSha: "a".repeat(40),
        parserVersion: "integration",
        decisions: [],
        references: [],
      },
    });
    return {
      projectId,
      runId,
      reviewSnapshotId,
      reviewSnapshotHash,
      repositoryUrl,
    };
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
