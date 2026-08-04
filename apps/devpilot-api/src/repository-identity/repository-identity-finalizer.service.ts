import { Injectable } from "@nestjs/common";
import type { ProjectRepositoryIdentity } from "@prisma/client";
import { identityConflict, identityUnavailable } from "./repository-identity.errors";
import type { RepositoryIdentityTransaction } from "./repository-identity.types";
import { normalizeRepositoryIdentity } from "./repository-identity.utils";

interface LockIdentityInput {
  teamId: string;
  projectId: string;
  actorId: string;
  connectionId: string;
  repositoryUrl: string;
  providerRepositoryId?: string | null;
  defaultBranch?: string | null;
  commitSha?: string | null;
  existing?: ProjectRepositoryIdentity | null;
}

@Injectable()
export class RepositoryIdentityFinalizerService {
  async lock(
    tx: RepositoryIdentityTransaction,
    input: LockIdentityInput,
  ): Promise<ProjectRepositoryIdentity> {
    const normalized = normalizeRepositoryIdentity(input.repositoryUrl);
    if (!normalized || !input.defaultBranch || !input.commitSha) {
      throw identityUnavailable(
        "PROJECT_REPOSITORY_IDENTITY_INVALID",
        "无法生成完整的仓库规范身份",
        "请重新连接有效仓库并确认默认分支。",
      );
    }
    if (input.existing && (
      input.existing.canonicalKey !== normalized.canonicalKey
      || input.existing.provider !== normalized.provider
      || input.existing.canonicalUrl !== normalized.canonicalUrl
    )) {
      throw identityConflict(
        "PROJECT_REPOSITORY_IDENTITY_LOCKED",
        "项目仓库身份已锁定为其他仓库",
        "请保留已锁定仓库，或创建新的项目。",
      );
    }
    const identity = input.existing ?? await tx.projectRepositoryIdentity.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        repositoryConnectionId: input.connectionId,
        provider: normalized.provider,
        providerRepositoryId: input.providerRepositoryId,
        canonicalKey: normalized.canonicalKey,
        canonicalUrl: normalized.canonicalUrl,
        defaultBranch: input.defaultBranch,
        lockedAt: new Date(),
      },
    });
    if (identity.currentRevisionId) {
      const current = await tx.projectRepositoryIdentityRevision.findUnique({
        where: { id: identity.currentRevisionId },
        select: { identityId: true, projectId: true },
      });
      if (!current || current.identityId !== identity.id || current.projectId !== input.projectId) {
        throw identityConflict(
          "PROJECT_REPOSITORY_REVISION_INVALID",
          "仓库身份的当前修订不属于该项目",
          "请停止接入并修复身份修订关系后重试。",
        );
      }
      return identity;
    }
    const revision = await tx.projectRepositoryIdentityRevision.create({
      data: {
        teamId: input.teamId,
        projectId: input.projectId,
        identityId: identity.id,
        createdById: input.actorId,
        revision: 1,
        expectedRevision: 0,
        defaultBranch: input.defaultBranch,
        verifiedCommitSha: input.commitSha,
        reason: "Initial canonical branch locked by project intake",
        idempotencyKey: `project-intake:${input.projectId}:1`,
      },
    });
    return tx.projectRepositoryIdentity.update({
      where: { id: identity.id },
      data: { currentRevisionId: revision.id },
    });
  }
}
