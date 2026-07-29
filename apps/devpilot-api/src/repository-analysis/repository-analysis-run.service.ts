import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StartRepositoryAnalysisDto } from './dto/repository-analysis.dto';
import { REPOSITORY_ANALYSIS_PARSER_VERSION } from './repository-analysis.constants';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
import { RepositoryAnalysisRunRepository } from './repository-analysis-run.repository';
import { RepositoryAnalysisWorkerService } from './repository-analysis-worker.service';
import { RepositoryConnectionRepository } from './repository-connection.repository';
import { repositoryError } from './repository-analysis-validation.utils';

@Injectable()
export class RepositoryAnalysisRunService {
  constructor(
    private readonly connections: RepositoryConnectionRepository,
    private readonly runs: RepositoryAnalysisRunRepository,
    private readonly worker: RepositoryAnalysisWorkerService,
    private readonly audit: RepositoryAnalysisAuditService,
  ) {}

  list(teamId: string, projectId: string) {
    return this.runs.list(teamId, projectId);
  }

  detail(teamId: string, projectId: string, runId: string) {
    return this.runs.findScoped(teamId, projectId, runId);
  }

  async start(
    teamId: string,
    userId: string,
    projectId: string,
    dto: StartRepositoryAnalysisDto,
  ) {
    await this.connections.assertProject(teamId, projectId);
    const connection = await this.connections.findByProject(teamId, projectId);
    if (!connection || connection.status !== 'connected'
      || !connection.selectedBranch || !connection.commitSha) {
      throw new BadRequestException(repositoryError(
        'REPOSITORY_NOT_CONNECTED',
        '项目尚未连接并验证仓库',
        '请先完成“连接并解析仓库”中的仓库连接步骤。',
      ));
    }
    if (dto.branch && dto.branch !== connection.selectedBranch) {
      throw new BadRequestException(repositoryError(
        'REPOSITORY_BRANCH_NOT_CONNECTED',
        '所选分支尚未验证',
        '请重新连接仓库并选择该真实分支。',
      ));
    }
    const idempotent = await this.runs.findIdempotent(projectId, dto.idempotencyKey);
    if (idempotent) return idempotent;
    const active = await this.runs.findActive(teamId, projectId);
    if (active) throw new ConflictException(repositoryError(
      'REPOSITORY_ANALYSIS_ACTIVE',
      '当前项目已有解析正在进行',
      '请查看当前运行，避免重复点击；需要时可先取消。',
    ));
    try {
      const run = await this.runs.create({
        teamId,
        projectId,
        connectionId: connection.id,
        triggeredById: userId,
        repositoryUrl: connection.repositoryUrl,
        branch: connection.selectedBranch,
        commitSha: connection.commitSha,
        idempotencyKey: dto.idempotencyKey,
        parserVersion: REPOSITORY_ANALYSIS_PARSER_VERSION,
      });
      await this.audit.record({
        teamId,
        userId,
        projectId,
        action: 'repository.analysis.start',
        targetType: 'repository_analysis_run',
        targetId: run.id,
        status: 'running',
        summary: `仓库解析已排队：${run.branch}@${run.commitSha.slice(0, 12)}`,
        metadata: { branch: run.branch, commitSha: run.commitSha, parserVersion: run.parserVersion },
      });
      this.worker.enqueue(run.id);
      return run;
    } catch (error) {
      const concurrent = await this.runs.findActive(teamId, projectId);
      if (concurrent) throw new ConflictException(repositoryError(
        'REPOSITORY_ANALYSIS_ACTIVE',
        '并发请求已创建解析运行',
        '请打开当前运行查看进度。',
      ));
      throw error;
    }
  }

  async retry(teamId: string, userId: string, projectId: string, runId: string) {
    const source = await this.runs.findScoped(teamId, projectId, runId);
    const active = await this.runs.findActive(teamId, projectId);
    if (active) throw new ConflictException(repositoryError(
      'REPOSITORY_ANALYSIS_ACTIVE',
      '当前项目已有解析正在进行',
      '请等待当前运行结束或先取消。',
    ));
    const run = await this.runs.create({
      teamId,
      projectId,
      connectionId: source.connectionId,
      triggeredById: userId,
      retryOfId: source.id,
      repositoryUrl: source.repositoryUrl,
      branch: source.branch,
      commitSha: source.commitSha,
      idempotencyKey: `retry:${source.id}:${randomUUID()}`,
      parserVersion: REPOSITORY_ANALYSIS_PARSER_VERSION,
    });
    await this.audit.record({
      teamId,
      userId,
      projectId,
      action: 'repository.analysis.retry',
      targetType: 'repository_analysis_run',
      targetId: run.id,
      status: 'running',
      summary: `重试解析 ${source.id}`,
      metadata: { retryOfId: source.id, branch: run.branch, commitSha: run.commitSha },
    });
    this.worker.enqueue(run.id);
    return run;
  }

  async cancel(teamId: string, userId: string, projectId: string, runId: string) {
    const run = await this.runs.findScoped(teamId, projectId, runId);
    if (!['queued', 'running'].includes(run.status)) {
      throw new BadRequestException(repositoryError(
        'REPOSITORY_ANALYSIS_TERMINAL',
        '该解析运行已结束，不能取消',
        '可查看结果或重新发起解析。',
      ));
    }
    await this.runs.requestCancel(teamId, projectId, runId);
    this.worker.cancel(runId);
    await this.audit.record({
      teamId,
      userId,
      projectId,
      action: 'repository.analysis.cancel.request',
      targetType: 'repository_analysis_run',
      targetId: runId,
      summary: '已请求取消仓库解析',
    });
    return this.runs.findScoped(teamId, projectId, runId);
  }
}
