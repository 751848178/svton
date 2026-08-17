import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ConnectRepositoryDto } from './dto/repository-connection.dto';
import { RepositoryIdentityConnectionRepository } from '../repository-identity/repository-identity-connection.repository';
import { identityConflict } from '../repository-identity/repository-identity.errors';
import { RepositoryIdentityReadRepository } from '../repository-identity/repository-identity-read.repository';
import { normalizeRepositoryIdentity } from '../repository-identity/repository-identity.utils';
import { assertIdentityCandidate } from '../repository-identity/repository-identity-policy.utils';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
import { recordVerifiedRepositoryConnection } from './repository-connection-audit.utils';
import { RepositoryConnectionRepository } from './repository-connection.repository';
import { RepositoryCredentialService } from './repository-credential.service';
import { RepositoryGitError } from './repository-git-error.utils';
import { RepositoryGitExecutorService } from './repository-git-executor.service';
import {
  repositoryError,
  validateRepositoryUrl,
} from './repository-analysis-validation.utils';

@Injectable()
export class RepositoryConnectionService {
  constructor(
    private readonly connections: RepositoryConnectionRepository,
    private readonly identityConnections: RepositoryIdentityConnectionRepository,
    private readonly identityReads: RepositoryIdentityReadRepository,
    private readonly credentials: RepositoryCredentialService,
    private readonly git: RepositoryGitExecutorService,
    private readonly audit: RepositoryAnalysisAuditService,
  ) {}

  listCredentialOptions(teamId: string, userId: string) {
    return this.credentials.listOptions(teamId, userId);
  }

  async getState(teamId: string, userId: string, projectId: string) {
    await this.connections.assertProject(teamId, projectId);
    const [state, credentialOptions] = await Promise.all([
      this.identityReads.state(teamId, projectId),
      this.credentials.listOptions(teamId, userId),
    ]);
    const connection = state?.repositoryConnection ?? null;
    const identity = state?.repositoryIdentity ?? null;
    const active = Boolean(state?.repositoryAnalysisRuns.length);
    return {
      connection,
      credentialOptions,
      locked: Boolean(identity?.lockedAt),
      canonicalIdentity: identity ? {
        id: identity.id,
        provider: identity.provider,
        canonicalUrl: identity.canonicalUrl,
        lockedAt: identity.lockedAt,
        effectiveRevision: identity.currentRevision,
      } : null,
      identityStatus: state?.onboardingStatus === 'ready' && !identity?.currentRevision
        ? 'identity_migration_required'
        : identity && !identity.currentRevision
          ? 'identity_revision_missing'
          : identity
            ? 'locked'
            : 'draft',
      allowedActions: {
        reconnectCredentials: Boolean(identity?.currentRevision) && !active,
        reviseBranch: Boolean(identity?.currentRevision) && !active,
      },
      readiness: {
        connected: connection?.status === 'connected',
        analyzed: Boolean(connection?.lastAppliedRunId),
        applied: Boolean(connection?.appliedAt),
        complete: connection?.status === 'connected'
          && Boolean(connection.lastAppliedRunId)
          && Boolean(connection.appliedAt),
      },
    };
  }

  async connect(
    teamId: string,
    userId: string,
    projectId: string,
    dto: ConnectRepositoryDto,
    afterVerified?: (tx: Prisma.TransactionClient) => Promise<void>,
  ) {
    await this.connections.assertProject(teamId, projectId);
    const repositoryUrl = validateRepositoryUrl(
      dto.repositoryUrl,
      this.git.allowsLocal(dto.repositoryUrl),
    );
    const normalized = normalizeRepositoryIdentity(repositoryUrl);
    if (!normalized) throw new BadRequestException(repositoryError(
      'PROJECT_REPOSITORY_IDENTITY_INVALID',
      '无法识别仓库规范身份',
      '请使用有效的 HTTPS、SSH 或已允许的本地仓库地址。',
    ));
    if (dto.gitProvider && dto.gitProvider !== normalized.provider) {
      throw identityConflict(
        'PROJECT_REPOSITORY_PROVIDER_DRIFT',
        '所选 Git 凭据提供商与仓库地址不匹配',
        '请选择与规范仓库提供商一致的凭据。',
      );
    }
    const preflight = await this.identityReads.state(teamId, projectId);
    if (preflight?.onboardingStatus === 'ready'
      && !preflight.repositoryIdentity?.currentRevision) {
      throw identityConflict(
        'PROJECT_REPOSITORY_IDENTITY_MIGRATION_REQUIRED',
        'READY 项目缺少可验证的仓库身份修订',
        '请先完成仓库身份迁移，再修改连接。',
      );
    }
    if (preflight?.repositoryIdentity) {
      assertIdentityCandidate(preflight.repositoryIdentity, {
        repositoryUrl,
        provider: normalized.provider,
        branch: dto.branch
          || preflight.repositoryIdentity.currentRevision?.defaultBranch
          || '',
      });
    }
    const material = await this.credentials.resolve({
      teamId,
      userId,
      visibility: dto.visibility,
      gitProvider: dto.gitProvider,
      teamCredentialId: dto.teamCredentialId,
      inlineCredential: dto.credential,
    });
    let ref;
    try {
      ref = await this.git.resolveRef(repositoryUrl, dto.branch, material);
    } catch (error) {
      const detail = error instanceof RepositoryGitError
        ? error.detail
        : repositoryError(
          'REPOSITORY_CONNECTION_FAILED',
          '仓库连接失败',
          '请检查仓库地址、分支和只读凭据后重试。',
        );
      await this.identityConnections.saveFailureIfUnlocked({
        teamId,
        projectId,
        userId,
        repositoryUrl,
        provider: normalized.provider,
        visibility: dto.visibility,
        credentialSource: material.source,
        gitConnectionId: material.kind === 'https_token' ? material.gitConnectionId : undefined,
        teamCredentialId: material.kind === 'none' ? undefined : material.teamCredentialId,
        selectedBranch: dto.branch,
        errorCode: detail.code,
        errorMessage: detail.message,
      }, async (tx, failed) => {
        await this.recordFailure(
          teamId, userId, projectId, failed.id, detail, normalized.provider, tx,
        );
      });
      throw new BadRequestException(detail);
    }
    const connection = await this.identityConnections.saveVerified({
      teamId,
      projectId,
      userId,
      repositoryUrl,
      provider: normalized.provider,
      visibility: dto.visibility,
      credentialSource: material.source,
      gitConnectionId: material.kind === 'https_token' ? material.gitConnectionId : undefined,
      teamCredentialId: material.kind === 'none' ? undefined : material.teamCredentialId,
      ...ref,
    }, (tx) => this.credentials.persistInline(teamId, material, tx), async (tx, stored) => {
      await afterVerified?.(tx);
      await recordVerifiedRepositoryConnection(this.audit, tx, {
        teamId, userId, projectId,
        branch: ref.selectedBranch,
        commitSha: ref.commitSha,
        connection: stored,
      });
    });
      return connection;
  }

  private recordFailure(
    teamId: string,
    userId: string,
    projectId: string,
    targetId: string | undefined,
    detail: { code: string; message: string },
    provider: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.audit.record({
      teamId, userId, projectId, targetId,
      action: 'repository.connect',
      targetType: 'repository_connection',
      status: 'failed',
      summary: detail.message,
      metadata: { errorCode: detail.code, provider },
    }, tx);
  }
}
