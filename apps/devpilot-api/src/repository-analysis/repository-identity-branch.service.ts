import { Injectable } from "@nestjs/common";
import { RepositoryIdentityReadRepository } from "../repository-identity/repository-identity-read.repository";
import { RepositoryIdentityRevisionRepository } from "../repository-identity/repository-identity-revision.repository";
import { normalizeRepositoryIdentity } from "../repository-identity/repository-identity.utils";
import { identityUnavailable } from "../repository-identity/repository-identity.errors";
import { assertStoredConnection } from "../repository-identity/repository-identity-policy.utils";
import type { ReviseRepositoryBranchDto } from "./dto/repository-identity-revision.dto";
import { RepositoryCredentialService } from "./repository-credential.service";
import { RepositoryGitExecutorService } from "./repository-git-executor.service";

@Injectable()
export class RepositoryIdentityBranchService {
  constructor(
    private readonly reads: RepositoryIdentityReadRepository,
    private readonly revisions: RepositoryIdentityRevisionRepository,
    private readonly credentials: RepositoryCredentialService,
    private readonly git: RepositoryGitExecutorService,
  ) {}

  async revise(
    teamId: string,
    userId: string,
    projectId: string,
    dto: ReviseRepositoryBranchDto,
  ) {
    const replay = await this.revisions.findReplay({
      teamId,
      projectId,
      branch: dto.branch.trim(),
      reason: dto.reason.trim(),
      expectedRevision: dto.expectedRevision,
      idempotencyKey: dto.idempotencyKey,
    });
    if (replay) return this.response(replay);
    const state = await this.reads.state(teamId, projectId);
    const connection = state?.repositoryConnection;
    if (!state?.repositoryIdentity || !connection) {
      throw identityUnavailable(
        "PROJECT_REPOSITORY_IDENTITY_NOT_READY",
        "项目规范仓库身份尚未准备完成",
        "请完成仓库接入或身份迁移后重试。",
      );
    }
    const normalized = normalizeRepositoryIdentity(connection.repositoryUrl);
    if (!normalized) throw identityUnavailable(
      "PROJECT_REPOSITORY_CONNECTION_INVALID",
      "已保存的仓库连接无法生成规范身份",
      "请修复仓库连接后重试分支修订。",
    );
    assertStoredConnection(state.repositoryIdentity, connection);
    const credential = await this.credentials.resolveStored(connection);
    const ref = await this.git.resolveRef(connection.repositoryUrl, dto.branch, credential);
    const result = await this.revisions.append({
      teamId,
      projectId,
      actorId: userId,
      branch: ref.selectedBranch,
      commitSha: ref.commitSha,
      reason: dto.reason.trim(),
      expectedRevision: dto.expectedRevision,
      idempotencyKey: dto.idempotencyKey,
      repositoryUrl: connection.repositoryUrl,
      provider: normalized.provider,
    });
    return this.response(result);
  }

  private response(result: {
    identity: { id: string };
    revision: {
      id: string;
      revision: number;
      defaultBranch: string;
      verifiedCommitSha: string;
    };
    replayed: boolean;
  }) {
    return {
      identityId: result.identity.id,
      revisionId: result.revision.id,
      revision: result.revision.revision,
      defaultBranch: result.revision.defaultBranch,
      commitSha: result.revision.verifiedCommitSha,
      replayed: result.replayed,
    };
  }
}
