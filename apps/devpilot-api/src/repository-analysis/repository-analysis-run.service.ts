import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { StartRepositoryAnalysisDto } from './dto/repository-analysis.dto';
import { REPOSITORY_ANALYSIS_PARSER_VERSION } from './repository-analysis.constants';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
import { RepositoryAnalysisRunRepository } from './repository-analysis-run.repository';
import { RepositoryAnalysisRunClaimRepository } from './repository-analysis-run-claim.repository';
import { RepositoryAnalysisWorkerService } from './repository-analysis-worker.service';
import { repositoryError } from './repository-analysis-validation.utils';
import { redactRepositoryValue } from './repository-analysis-redact.utils';

@Injectable()
export class RepositoryAnalysisRunService {
  constructor(
    private readonly runs: RepositoryAnalysisRunRepository,
    private readonly claims: RepositoryAnalysisRunClaimRepository,
    private readonly worker: RepositoryAnalysisWorkerService,
    private readonly audit: RepositoryAnalysisAuditService,
  ) {}

  async list(teamId: string, projectId: string) {
    return this.safe(await this.runs.list(teamId, projectId));
  }

  async detail(teamId: string, projectId: string, runId: string) {
    return this.safe(await this.runs.findScoped(teamId, projectId, runId));
  }

  async start(
    teamId: string,
    userId: string,
    projectId: string,
    dto: StartRepositoryAnalysisDto,
  ) {
    const claimed = await this.claims.start({
      teamId,
      projectId,
      triggeredById: userId,
      branch: dto.branch,
      idempotencyKey: dto.idempotencyKey,
      parserVersion: REPOSITORY_ANALYSIS_PARSER_VERSION,
    });
    if (claimed.replayed) return this.safe(claimed.run);
    const run = claimed.run;
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
    return this.safe(run);
  }

  async retry(teamId: string, userId: string, projectId: string, runId: string) {
    const source = await this.runs.findScoped(teamId, projectId, runId);
    const run = await this.claims.retry({
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
    return this.safe(run);
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
    return this.safe(await this.runs.findScoped(teamId, projectId, runId));
  }

  private safe<T>(value: T): T {
    return redactRepositoryValue(value) as T;
  }
}
