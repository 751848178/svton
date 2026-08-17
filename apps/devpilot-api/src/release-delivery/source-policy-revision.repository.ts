import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RegisteredReleaseBuildProfile } from "./release-build-acceptance-profile";
import {
  buildSourcePolicySnapshot,
  SOURCE_POLICY_SNAPSHOT_VERSION,
  sourcePolicySnapshotHash,
  sourcePolicySnapshotsEqual,
} from "./source-policy-snapshot.policy";

@Injectable()
export class SourcePolicyRevisionRepository {
  constructor(private readonly prisma: PrismaService) {}

  resolveRegistered(
    teamId: string,
    projectId: string,
    profile: RegisteredReleaseBuildProfile,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id FROM Project
        WHERE id = ${projectId} AND teamId = ${teamId} AND archivedAt IS NULL
        FOR UPDATE
      `);
      if (locked.length === 0) throw new NotFoundException("项目不存在");
      const snapshot = buildSourcePolicySnapshot(profile);
      const snapshotHash = sourcePolicySnapshotHash(snapshot);
      const existing = await tx.sourcePolicyRevision.findUnique({
        where: {
          projectId_profileId_profileVersion_snapshotHash: {
            projectId,
            profileId: profile.id,
            profileVersion: profile.profileVersion,
            snapshotHash,
          },
        },
      });
      if (existing && !sourcePolicySnapshotsEqual(existing.snapshot, snapshot)) {
        throw new ConflictException(
          "SourcePolicyRevision 快照与哈希不一致，必须先修复策略数据",
        );
      }
      const revision = existing ?? await this.create(tx, {
        teamId,
        projectId,
        profile,
        snapshot,
        snapshotHash,
      });
      await tx.project.update({
        where: { id: projectId },
        data: { currentSourcePolicyRevisionId: revision.id },
      });
      return revision;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async resolveCommitAuthorUserId(teamId: string, email: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email.trim().toLowerCase(),
        teamMembers: { some: { teamId } },
      },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private async create(
    tx: Prisma.TransactionClient,
    input: {
      teamId: string;
      projectId: string;
      profile: RegisteredReleaseBuildProfile;
      snapshot: ReturnType<typeof buildSourcePolicySnapshot>;
      snapshotHash: string;
    },
  ) {
    const latest = await tx.sourcePolicyRevision.findFirst({
      where: { projectId: input.projectId },
      orderBy: { revision: "desc" },
      select: { revision: true },
    });
    return tx.sourcePolicyRevision.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        revision: (latest?.revision ?? 0) + 1,
        profileId: input.profile.id,
        profileVersion: input.profile.profileVersion,
        externalRequiredChecks: input.profile.externalRequiredChecks,
        requiredIndependentApprovals: input.profile.requiredIndependentApprovals,
        snapshotVersion: SOURCE_POLICY_SNAPSHOT_VERSION,
        snapshot: input.snapshot as Prisma.InputJsonValue,
        snapshotHash: input.snapshotHash,
      },
    });
  }
}
