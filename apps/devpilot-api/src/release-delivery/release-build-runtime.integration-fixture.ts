import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { persistAllowedTestDecision } from "./release-gate-test-decision.spec-utils";
import { ReleaseBuildRepository } from "./release-build.repository";
import { ReleaseBuildRecoveryRepository } from "./release-build-recovery.repository";
import { ReleaseBuildResultRepository } from "./release-build-result.repository";
import type { ReleaseBuildInputSnapshot } from "./release-build.types";

export class ReleaseBuildRuntimeFixture {
  readonly prisma = new PrismaClient();
  readonly repository = new ReleaseBuildRepository(
    this.prisma as unknown as PrismaService,
  );
  readonly results = new ReleaseBuildResultRepository(
    this.prisma as unknown as PrismaService,
  );
  readonly recovery = new ReleaseBuildRecoveryRepository(
    this.prisma as unknown as PrismaService,
  );
  readonly suffix = randomUUID();
  readonly userId = `f426-user-${this.suffix}`;
  readonly teamId = `f426-team-${this.suffix}`;
  readonly projectId = `f426-project-${this.suffix}`;
  readonly identityId = `f426-identity-${this.suffix}`;
  readonly identityRevisionId = `f426-identity-revision-${this.suffix}`;
  orderId = "";

  async start() {
    await this.prisma.user.create({
      data: {
        id: this.userId,
        email: `${this.suffix}@f426.example`,
        role: "user",
      },
    });
    await this.prisma.team.create({
      data: { id: this.teamId, name: "F426 Team" },
    });
    await this.prisma.project.create({
      data: {
        id: this.projectId,
        teamId: this.teamId,
        createdById: this.userId,
        name: "F426 Project",
        config: {},
      },
    });
    const connection = await this.prisma.repositoryConnection.create({
      data: {
        teamId: this.teamId,
        projectId: this.projectId,
        connectedById: this.userId,
        provider: "generic",
        repositoryUrl: "https://example.com/repo.git",
        defaultBranch: "main",
        selectedBranch: "main",
        commitSha: "a".repeat(40),
        status: "connected",
      },
    });
    await this.prisma.projectRepositoryIdentity.create({
      data: {
        id: this.identityId,
        teamId: this.teamId,
        projectId: this.projectId,
        repositoryConnectionId: connection.id,
        provider: "generic",
        canonicalKey: "example.com/repo",
        canonicalUrl: "https://example.com/repo",
        defaultBranch: "main",
        lockedAt: new Date(),
      },
    });
    await this.prisma.projectRepositoryIdentityRevision.create({
      data: {
        id: this.identityRevisionId,
        teamId: this.teamId,
        projectId: this.projectId,
        identityId: this.identityId,
        createdById: this.userId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: "main",
        verifiedCommitSha: "a".repeat(40),
        reason: "F426 fixture",
        idempotencyKey: `f426-${this.suffix}`,
      },
    });
    await this.prisma.projectRepositoryIdentity.update({
      where: { id: this.identityId },
      data: { currentRevisionId: this.identityRevisionId },
    });
    this.orderId = (
      await this.prisma.releaseOrder.create({
        data: {
          teamId: this.teamId,
          projectId: this.projectId,
          createdById: this.userId,
          releaseVersion: "1.0.0",
        },
      })
    ).id;
  }

  async stop() {
    await this.prisma.team.delete({ where: { id: this.teamId } });
    await this.prisma.user.delete({ where: { id: this.userId } });
    await this.prisma.$disconnect();
  }

  async reservation(inputHash: string = randomUUID()) {
    const decision = await persistAllowedTestDecision(this.prisma, {
      teamId: this.teamId,
      actorId: this.userId,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      stage: "build",
    });
    const snapshot: ReleaseBuildInputSnapshot = {
      version: 2,
      repositoryUrl: "https://example.com/repo.git",
      repositoryIdentity: {
        id: this.identityId,
        revisionId: this.identityRevisionId,
        revision: 1,
        provider: "generic",
        canonicalUrl: "https://example.com/repo",
      },
      sourceBranch: "main",
      sourceCommitSha: "a".repeat(40),
      components: [],
      gateDecision: {
        id: decision.id,
        stage: decision.stage,
        inputHash: decision.inputHash,
      },
    };
    return {
      teamId: this.teamId,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      actorId: this.userId,
      snapshot,
      inputHash,
      expectedCanonicalKey: "example.com/repo",
    };
  }

  async postBuildDecision() {
    const decision = await persistAllowedTestDecision(this.prisma, {
      teamId: this.teamId,
      actorId: this.userId,
      projectId: this.projectId,
      releaseOrderId: this.orderId,
      stage: "build",
      checkpoint: "build_post_execution",
    });
    return { id: decision.id, stage: decision.stage, inputHash: decision.inputHash };
  }
}
