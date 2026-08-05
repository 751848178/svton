import "reflect-metadata";
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
import { normalizeRepositoryIdentity } from "../repository-identity/repository-identity.utils";
import { RepositoryCredentialService } from "../repository-analysis/repository-credential.service";
import { RepositoryGitCommandService } from "../repository-analysis/repository-git-command.service";
import { RepositoryGitExecutorService } from "../repository-analysis/repository-git-executor.service";
import { RepositoryIdentityBranchService } from "../repository-analysis/repository-identity-branch.service";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import { ReleaseBuildService } from "./release-build.service";
import { ReleaseBuildSourceResolverService } from "./release-build-source-resolver.service";
import { gatePolicyTestDouble } from "./release-gate-test-decision.spec-utils";

const git = promisify(execFile);
const describeIntegration =
  process.env.RUN_F416_IDENTITY_INTEGRATION === "1" ? describe : describe.skip;

describeIntegration("F416 real Git identity and build source", () => {
  const prisma = new PrismaClient();
  const db = prisma as unknown as PrismaService;
  const suffix = Math.random().toString(36).slice(2);
  const teamId = `f416-git-team-${suffix}`;
  const userId = `f416-git-user-${suffix}`;
  const projectId = `f416-git-project-${suffix}`;
  let repositoryRoot: string;
  let parentRoot: string;
  let mainCommit: string;
  let releaseCommit: string;
  let orderId: string;
  let service: ReleaseBuildService;
  let branches: RepositoryIdentityBranchService;
  let fingerprintBefore: { commit: string; tree: string; status: string };
  const executedCommits: string[] = [];

  beforeAll(async () => {
    parentRoot = await mkdtemp(join(tmpdir(), "f416-real-git-"));
    repositoryRoot = join(parentRoot, "source");
    await git("git", ["init", "-b", "main", repositoryRoot]);
    await git("git", [
      "-C",
      repositoryRoot,
      "config",
      "user.email",
      "f416@example.com",
    ]);
    await git("git", ["-C", repositoryRoot, "config", "user.name", "F416"]);
    await writeFile(join(repositoryRoot, "app.txt"), "main\n");
    await git("git", ["-C", repositoryRoot, "add", "."]);
    await git("git", ["-C", repositoryRoot, "commit", "-m", "main"]);
    mainCommit = await revParse(repositoryRoot, "HEAD");
    await git("git", ["-C", repositoryRoot, "switch", "-c", "release"]);
    await writeFile(join(repositoryRoot, "app.txt"), "release-1\n");
    await git("git", ["-C", repositoryRoot, "commit", "-am", "release-1"]);
    releaseCommit = await revParse(repositoryRoot, "HEAD");
    await git("git", ["-C", repositoryRoot, "switch", "main"]);
    fingerprintBefore = await fingerprint(repositoryRoot);

    await prisma.user.create({
      data: { id: userId, email: `${suffix}@f416-git.example`, role: "user" },
    });
    await prisma.team.create({ data: { id: teamId, name: "F416 Git Team" } });
    await seedDatabase();
    const config = new ConfigService({
      REPOSITORY_ANALYSIS_LOCAL_ROOTS: parentRoot,
    });
    const gitExecutor = new RepositoryGitExecutorService(
      config,
      new RepositoryGitCommandService(config),
    );
    const credentials = new RepositoryCredentialService(
      db,
      createTestCryptoService(),
    );
    const reads = new RepositoryIdentityReadRepository(db);
    const coordinator = new RepositoryIdentityCoordinatorService(db);
    branches = new RepositoryIdentityBranchService(
      reads,
      new RepositoryIdentityRevisionRepository(coordinator),
      credentials,
      gitExecutor,
    );
    const sourceResolver = new ReleaseBuildSourceResolverService(
      reads,
      credentials,
      gitExecutor,
    );
    service = new ReleaseBuildService(
      new ReleaseBuildRepository(db),
      new ReleaseBuildResultRepository(db),
      gitExecutor,
      sourceResolver,
      {
        execute: async (input) => {
          executedCommits.push(await revParse(input.checkoutRoot, "HEAD"));
          return {
            artifact: {
              digest: `sha256:${"f".repeat(64)}`,
              sizeBytes: 8,
              uri: `release-artifact://${input.buildRunId}/bundle.zip`,
            },
            logs: ["real git checkout verified"],
            gateSummary: { build: { status: "passed" } },
          };
        },
      },
      gatePolicyTestDouble(prisma) as never,
    );
  });

  afterAll(async () => {
    await prisma.team.delete({ where: { id: teamId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.$disconnect();
    await rm(parentRoot, { recursive: true, force: true });
  });

  it("revises a real branch, replays offline, and builds its latest exact commit", async () => {
    const request = {
      branch: "release",
      reason: "Promote verified release branch",
      expectedRevision: 1,
      idempotencyKey: `real-git-revision-${suffix}`,
    };
    const revised = await branches.revise(teamId, userId, projectId, request);
    expect(revised).toMatchObject({
      revision: 2,
      defaultBranch: "release",
      commitSha: releaseCommit,
      replayed: false,
    });

    const offlineRoot = `${repositoryRoot}-offline`;
    await rename(repositoryRoot, offlineRoot);
    const replayed = await branches.revise(teamId, userId, projectId, request);
    expect(replayed).toMatchObject({
      revisionId: revised.revisionId,
      commitSha: releaseCommit,
      replayed: true,
    });
    await rename(offlineRoot, repositoryRoot);

    await git("git", ["-C", repositoryRoot, "switch", "release"]);
    await writeFile(join(repositoryRoot, "app.txt"), "release-2\n");
    await git("git", ["-C", repositoryRoot, "commit", "-am", "release-2"]);
    const latestReleaseCommit = await revParse(repositoryRoot, "HEAD");
    await git("git", ["-C", repositoryRoot, "switch", "main"]);
    fingerprintBefore = await fingerprint(repositoryRoot);

    const build = await service.build(teamId, userId, projectId, orderId);
    expect(build).toMatchObject({
      status: "succeeded",
      sourceBranch: "release",
      sourceCommitSha: latestReleaseCommit,
      sourceRepository: {
        provider: "local",
        identityRevisionId: revised.revisionId,
        identityRevision: 2,
        branch: "release",
      },
    });
    expect(executedCommits).toEqual([latestReleaseCommit]);
    const stored = await prisma.buildRun.findUniqueOrThrow({
      where: { id: build.id },
    });
    expect(stored.repositoryIdentityRevisionId).toBe(revised.revisionId);
    expect(stored.inputSnapshot).toMatchObject({
      repositoryIdentity: {
        revisionId: revised.revisionId,
        revision: 2,
        provider: "local",
      },
      sourceBranch: "release",
      sourceCommitSha: latestReleaseCommit,
    });
    await expect(
      prisma.auditEvent.count({
        where: {
          projectId,
          action: "project.repository_identity.branch.revise",
        },
      }),
    ).resolves.toBe(1);
    await expect(fingerprint(repositoryRoot)).resolves.toEqual(
      fingerprintBefore,
    );
  });

  async function seedDatabase() {
    await prisma.project.create({
      data: {
        id: projectId,
        teamId,
        createdById: userId,
        name: "F416 Real Git",
        config: {},
        onboardingStatus: "ready",
      },
    });
    const connection = await prisma.repositoryConnection.create({
      data: {
        teamId,
        projectId,
        connectedById: userId,
        provider: "local",
        repositoryUrl: repositoryRoot,
        visibility: "public",
        credentialSource: "none",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: mainCommit,
        branches: ["main", "release"],
        status: "connected",
      },
    });
    const normalized = normalizeRepositoryIdentity(repositoryRoot)!;
    const identity = await prisma.projectRepositoryIdentity.create({
      data: {
        teamId,
        projectId,
        repositoryConnectionId: connection.id,
        provider: normalized.provider,
        canonicalKey: normalized.canonicalKey,
        canonicalUrl: normalized.canonicalUrl,
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    const revision = await prisma.projectRepositoryIdentityRevision.create({
      data: {
        teamId,
        projectId,
        identityId: identity.id,
        createdById: userId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: mainCommit,
        reason: "Initial main branch",
        idempotencyKey: `real-git-initial-${suffix}`,
      },
    });
    await prisma.projectRepositoryIdentity.update({
      where: { id: identity.id },
      data: { currentRevisionId: revision.id },
    });
    orderId = (
      await prisma.releaseOrder.create({
        data: {
          teamId,
          projectId,
          createdById: userId,
          releaseVersion: "1.0.0",
        },
      })
    ).id;
  }
});

async function revParse(root: string, ref: string) {
  return (await git("git", ["-C", root, "rev-parse", ref])).stdout.trim();
}

async function fingerprint(root: string) {
  return {
    commit: await revParse(root, "refs/heads/main"),
    tree: await revParse(root, "refs/heads/main^{tree}"),
    status: (
      await git("git", ["-C", root, "status", "--porcelain"])
    ).stdout.trim(),
  };
}
