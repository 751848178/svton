import { Injectable, NotFoundException } from "@nestjs/common";
import { assertStoredConnection } from "../repository-identity/repository-identity-policy.utils";
import { RepositoryIdentityReadRepository } from "../repository-identity/repository-identity-read.repository";
import { RepositoryCredentialService } from "../repository-analysis/repository-credential.service";
import { RepositoryGitExecutorService } from "../repository-analysis/repository-git-executor.service";
import type { ReleaseBuildResolvedSource } from "./release-build.types";
import { ReleaseBuildSourceEvidenceService } from "./release-build-source-evidence.service";

@Injectable()
export class ReleaseBuildSourceResolverService {
  constructor(
    private readonly identities: RepositoryIdentityReadRepository,
    private readonly credentials: RepositoryCredentialService,
    private readonly git: RepositoryGitExecutorService,
    private readonly sourceEvidence: ReleaseBuildSourceEvidenceService,
  ) {}

  async resolve(
    teamId: string,
    projectId: string,
    releaseOrderId: string,
    signal?: AbortSignal,
  ): Promise<ReleaseBuildResolvedSource> {
    const context = await this.identities.buildContext(
      teamId,
      projectId,
      releaseOrderId,
    );
    if (!context) throw new NotFoundException("发布单不存在或不属于当前项目");
    const identity = context.project.repositoryIdentity;
    const connection = context.project.repositoryConnection;
    if (!identity) {
      throw new NotFoundException("项目规范仓库身份尚未建立，构建已拒绝");
    }
    assertStoredConnection(identity, connection);
    const revision = identity.currentRevision;
    if (!connection || !revision) {
      throw new Error("Stored repository connection assertion did not narrow");
    }
    const credential = await this.credentials.resolveStored(connection);
    const ref = await this.git.resolveRef(
      connection.repositoryUrl,
      revision.defaultBranch,
      credential,
      signal,
    );
    const sourceEvidence = await this.sourceEvidence.inspect({
      teamId,
      projectId,
      releaseOrderId,
      repositoryUrl: connection.repositoryUrl,
      branch: revision.defaultBranch,
      exactCommit: ref.commitSha,
      baselineCommit: connection.commitSha,
      credential,
      signal,
    });
    return {
      context,
      connection,
      credential,
      identity: {
        id: identity.id,
        revisionId: revision.id,
        revision: revision.revision,
        provider: identity.provider,
        canonicalKey: identity.canonicalKey,
        canonicalUrl: identity.canonicalUrl,
        branch: revision.defaultBranch,
      },
      commitSha: ref.commitSha,
      sourceEvidence,
    };
  }
}
