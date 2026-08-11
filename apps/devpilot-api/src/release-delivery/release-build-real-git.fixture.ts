import { ConfigService } from "@nestjs/config";
import { PrismaClient } from "@prisma/client";
import { execFile } from "node:child_process";
import { mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createTestCryptoService } from "../common/crypto/crypto.test-helpers";
import { PrismaService } from "../prisma/prisma.service";
import { RepositoryIdentityCoordinatorService } from "../repository-identity/repository-identity-coordinator.service";
import { RepositoryIdentityReadRepository } from "../repository-identity/repository-identity-read.repository";
import { RepositoryIdentityRevisionRepository } from "../repository-identity/repository-identity-revision.repository";
import { RepositoryCredentialService } from "../repository-analysis/repository-credential.service";
import { RepositoryGitCommandService } from "../repository-analysis/repository-git-command.service";
import { RepositoryGitExecutorService } from "../repository-analysis/repository-git-executor.service";
import { RepositoryGitInspectionService } from "../repository-analysis/repository-git-inspection.service";
import { RepositoryIdentityBranchService } from "../repository-analysis/repository-identity-branch.service";
import { seedReleaseBuildRealGitDatabase } from "./release-build-real-git-database.fixture";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildRunnerService } from "./release-build-runner.service";
import { ReleaseBuildRuntimeProfileService } from "./release-build-runtime-profile.service";
import { ReleaseBuildRuntimeSupervisorService } from "./release-build-runtime-supervisor.service";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import { gatePolicyTestDouble } from "./release-gate-test-decision.spec-utils";
import type { ReleaseBuildExecutionInput } from "./release-build.types";
import { ReleaseBuildSourceEvidenceService } from "./release-build-source-evidence.service";
import { LocalReleaseEvidenceArtifactService } from "./local-release-evidence-artifact.service";
import { SourcePolicyRevisionRepository } from "./source-policy-revision.repository";

const git = promisify(execFile);

export class ReleaseBuildRealGitFixture {
  readonly prisma = new PrismaClient();
  readonly db = this.prisma as unknown as PrismaService;
  readonly suffix = Math.random().toString(36).slice(2);
  readonly teamId = `f416-git-team-${this.suffix}`;
  readonly userId = `f416-git-user-${this.suffix}`;
  readonly projectId = `f416-git-project-${this.suffix}`;
  readonly executedCommits: string[] = [];
  repositoryRoot = "";
  parentRoot = "";
  releaseCommit = "";
  orderId = "";
  service!: ReleaseBuildService;
  branches!: RepositoryIdentityBranchService;

  async start() {
    this.parentRoot = await mkdtemp(join(tmpdir(), "f416-real-git-"));
    this.repositoryRoot = join(this.parentRoot, "source");
    await git("git", ["init", "-b", "main", this.repositoryRoot]);
    await git("git", [
      "-C",
      this.repositoryRoot,
      "config",
      "user.email",
      "f416@example.com",
    ]);
    await git("git", [
      "-C",
      this.repositoryRoot,
      "config",
      "user.name",
      "F416",
    ]);
    await writeFile(join(this.repositoryRoot, "app.txt"), "main\n");
    await git("git", ["-C", this.repositoryRoot, "add", "."]);
    await git("git", ["-C", this.repositoryRoot, "commit", "-m", "main"]);
    const mainCommit = await this.revParse("HEAD");
    await git("git", ["-C", this.repositoryRoot, "switch", "-c", "release"]);
    await writeFile(join(this.repositoryRoot, "app.txt"), "release-1\n");
    await git("git", ["-C", this.repositoryRoot, "commit", "-am", "release-1"]);
    this.releaseCommit = await this.revParse("HEAD");
    await git("git", ["-C", this.repositoryRoot, "switch", "main"]);
    await this.prisma.user.create({
      data: {
        id: this.userId,
        email: `${this.suffix}@f416-git.example`,
        role: "user",
      },
    });
    await this.prisma.team.create({
      data: { id: this.teamId, name: "F416 Git Team" },
    });
    this.orderId = await seedReleaseBuildRealGitDatabase({
      prisma: this.prisma,
      suffix: this.suffix,
      teamId: this.teamId,
      userId: this.userId,
      projectId: this.projectId,
      repositoryRoot: this.repositoryRoot,
      mainCommit,
    });
    this.composeServices();
  }

  async stop() {
    await this.prisma.team.delete({ where: { id: this.teamId } });
    await this.prisma.user.delete({ where: { id: this.userId } });
    await this.prisma.$disconnect();
    await rm(this.parentRoot, { recursive: true, force: true });
  }

  async takeOffline() {
    await rename(this.repositoryRoot, `${this.repositoryRoot}-offline`);
  }

  async restoreOnline() {
    await rename(`${this.repositoryRoot}-offline`, this.repositoryRoot);
  }

  async advanceRelease() {
    await git("git", ["-C", this.repositoryRoot, "switch", "release"]);
    await writeFile(join(this.repositoryRoot, "app.txt"), "release-2\n");
    await git("git", ["-C", this.repositoryRoot, "commit", "-am", "release-2"]);
    const commit = await this.revParse("HEAD");
    await git("git", ["-C", this.repositoryRoot, "switch", "main"]);
    return commit;
  }

  revParse(ref: string) {
    return git("git", ["-C", this.repositoryRoot, "rev-parse", ref]).then(
      (result) => result.stdout.trim(),
    );
  }

  async fingerprint() {
    return {
      commit: await this.revParse("refs/heads/main"),
      tree: await this.revParse("refs/heads/main^{tree}"),
      status: (
        await git("git", ["-C", this.repositoryRoot, "status", "--porcelain"])
      ).stdout.trim(),
    };
  }

  private composeServices() {
    const config = new ConfigService({
      REPOSITORY_ANALYSIS_LOCAL_ROOTS: this.parentRoot,
      RELEASE_BUILD_EXECUTION_ENABLED: true,
      RELEASE_BUILD_EXECUTOR_PROFILE: "controlled-local-acceptance-v2",
      RELEASE_BUILD_WORK_ROOT: join(this.parentRoot, "build-work"),
      RELEASE_BUILD_ARTIFACT_ROOT: join(this.parentRoot, "artifacts"),
      RELEASE_BUILD_MAX_CONCURRENCY: 1,
    });
    const gitCommand = new RepositoryGitCommandService(config);
    const gitExecutor = new RepositoryGitExecutorService(config, gitCommand);
    const credentials = new RepositoryCredentialService(
      this.db,
      createTestCryptoService(),
    );
    const reads = new RepositoryIdentityReadRepository(this.db);
    this.branches = new RepositoryIdentityBranchService(
      reads,
      new RepositoryIdentityRevisionRepository(
        new RepositoryIdentityCoordinatorService(this.db),
      ),
      credentials,
      gitExecutor,
    );
    const runtime = new ReleaseBuildRuntimeProfileService(config);
    const sourceEvidence = new ReleaseBuildSourceEvidenceService(
      new RepositoryGitInspectionService(gitExecutor, gitCommand),
      runtime,
      new LocalReleaseEvidenceArtifactService(config),
      new SourcePolicyRevisionRepository(this.db),
    );
    const results = new ReleaseBuildResultRepository(this.db);
    const executor = {
      execute: async (input: ReleaseBuildExecutionInput) => {
        this.executedCommits.push(await revParse(input.checkoutRoot, "HEAD"));
        return {
          artifact: {
            digest: `sha256:${"f".repeat(64)}`,
            sizeBytes: 8,
            uri: `release-artifact://${input.buildRunId}/bundle.zip`,
            items: [],
            contentIndex: [],
          },
          logs: ["real git checkout verified"],
          gateSummary: { build: { status: "passed" } },
        };
      },
      discardArtifact: async () => undefined,
    };
    this.service = new ReleaseBuildService(
      new ReleaseBuildRepository(this.db),
      new ReleaseBuildSourceResolverService(
        reads,
        credentials,
        gitExecutor,
        sourceEvidence,
      ),
      gatePolicyTestDouble(this.prisma) as never,
      new ReleaseBuildRunnerService(
        results,
        gitExecutor,
        executor,
        runtime,
        gatePolicyTestDouble(this.prisma) as never,
      ),
      runtime,
      new ReleaseBuildRuntimeSupervisorService(runtime),
    );
  }
}

async function revParse(root: string, ref: string) {
  return (await git("git", ["-C", root, "rev-parse", ref])).stdout.trim();
}
