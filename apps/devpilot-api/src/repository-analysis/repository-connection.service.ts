import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConnectRepositoryDto } from './dto/repository-connection.dto';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
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
    private readonly credentials: RepositoryCredentialService,
    private readonly git: RepositoryGitExecutorService,
    private readonly audit: RepositoryAnalysisAuditService,
  ) {}

  async getState(teamId: string, userId: string, projectId: string) {
    await this.connections.assertProject(teamId, projectId);
    const [connection, credentialOptions] = await Promise.all([
      this.connections.findByProject(teamId, projectId),
      this.credentials.listOptions(teamId, userId),
    ]);
    return {
      connection,
      credentialOptions,
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
  ) {
    await this.connections.assertProject(teamId, projectId);
    if (await this.connections.hasActiveRun(teamId, projectId)) {
      throw new ConflictException(repositoryError(
        'REPOSITORY_ANALYSIS_ACTIVE',
        '当前项目已有解析正在进行',
        '请等待当前运行结束或先取消，再修改仓库连接。',
      ));
    }
    const repositoryUrl = validateRepositoryUrl(
      dto.repositoryUrl,
      this.git.allowsLocal(dto.repositoryUrl),
    );
    const material = await this.credentials.resolve({
      teamId,
      userId,
      visibility: dto.visibility,
      gitProvider: dto.gitProvider,
      teamCredentialId: dto.teamCredentialId,
      inlineCredential: dto.credential,
    });
    try {
      const ref = await this.git.resolveRef(repositoryUrl, dto.branch, material);
      const storedMaterial = await this.credentials.persistInline(teamId, material);
      const connection = await this.connections.save({
        teamId,
        projectId,
        userId,
        repositoryUrl,
        provider: detectProvider(repositoryUrl, dto.gitProvider),
        visibility: dto.visibility,
        credentialSource: storedMaterial.source,
        gitConnectionId: storedMaterial.kind === 'https_token'
          ? storedMaterial.gitConnectionId
          : undefined,
        teamCredentialId: storedMaterial.kind === 'none'
          ? undefined
          : storedMaterial.teamCredentialId,
        ...ref,
        status: 'connected',
      });
      await this.audit.record({
        teamId,
        userId,
        projectId,
        action: 'repository.connect',
        targetType: 'repository_connection',
        targetId: connection.id,
        summary: `已验证只读仓库 ${ref.selectedBranch}@${ref.commitSha.slice(0, 12)}`,
        metadata: {
          provider: connection.provider,
          branch: ref.selectedBranch,
          commitSha: ref.commitSha,
          credentialSource: connection.credentialSource,
        },
      });
      return connection;
    } catch (error) {
      const detail = error instanceof RepositoryGitError
        ? error.detail
        : repositoryError(
          'REPOSITORY_CONNECTION_FAILED',
          '仓库连接失败',
          '请检查仓库地址、分支和只读凭据后重试。',
        );
      const connection = await this.connections.save({
        teamId,
        projectId,
        userId,
        repositoryUrl,
        provider: detectProvider(repositoryUrl, dto.gitProvider),
        visibility: dto.visibility,
        credentialSource: material.source,
        gitConnectionId: material.kind === 'https_token' ? material.gitConnectionId : undefined,
        teamCredentialId: material.kind === 'none' ? undefined : material.teamCredentialId,
        selectedBranch: dto.branch,
        status: 'failed',
        errorCode: detail.code,
        errorMessage: detail.message,
      });
      await this.audit.record({
        teamId,
        userId,
        projectId,
        action: 'repository.connect',
        targetType: 'repository_connection',
        targetId: connection.id,
        status: 'failed',
        summary: detail.message,
        metadata: { errorCode: detail.code, provider: connection.provider },
      });
      throw new BadRequestException(detail);
    }
  }
}

function detectProvider(repositoryUrl: string, selected?: string): string {
  if (selected) return selected;
  if (/github\.com/i.test(repositoryUrl)) return 'github';
  if (/gitlab\./i.test(repositoryUrl)) return 'gitlab';
  if (/gitee\.com/i.test(repositoryUrl)) return 'gitee';
  if (repositoryUrl.startsWith('/') || repositoryUrl.startsWith('file://')) return 'local';
  return 'generic';
}
