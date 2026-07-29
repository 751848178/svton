import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REPOSITORY_ANALYSIS_DEFAULTS } from './repository-analysis.constants';
import { RepositoryAnalysisAuditService } from './repository-analysis-audit.service';
import {
  RepositoryAnalysisExecutionError,
  repositoryAnalysisErrorDetail,
} from './repository-analysis-execution.error';
import { RepositoryAnalysisRunRepository } from './repository-analysis-run.repository';
import { RepositoryAnalysisStageRepository } from './repository-analysis-stage.repository';
import { RepositoryCredentialService } from './repository-credential.service';
import { RepositoryGitExecutorService } from './repository-git-executor.service';
import { RepositoryInventoryService } from './repository-inventory.service';
import { RepositoryParserService } from './repository-parser.service';
import { RepositorySuggestionBuilderService } from './repository-suggestion-builder.service';

@Injectable()
export class RepositoryAnalysisWorkerService implements OnModuleInit {
  private readonly controllers = new Map<string, AbortController>();
  private readonly timeoutMs: number;

  constructor(
    config: ConfigService,
    private readonly runs: RepositoryAnalysisRunRepository,
    private readonly stages: RepositoryAnalysisStageRepository,
    private readonly credentials: RepositoryCredentialService,
    private readonly git: RepositoryGitExecutorService,
    private readonly inventoryService: RepositoryInventoryService,
    private readonly parser: RepositoryParserService,
    private readonly suggestionBuilder: RepositorySuggestionBuilderService,
    private readonly audit: RepositoryAnalysisAuditService,
  ) {
    this.timeoutMs = Number(config.get('REPOSITORY_ANALYSIS_TIMEOUT_MS'))
      || REPOSITORY_ANALYSIS_DEFAULTS.analysisTimeoutMs;
  }

  async onModuleInit(): Promise<void> {
    for (const run of await this.runs.recoverActiveIds()) this.enqueue(run.id);
  }

  enqueue(runId: string): void {
    if (this.controllers.has(runId)) return;
    setImmediate(() => void this.execute(runId));
  }

  cancel(runId: string): void {
    this.controllers.get(runId)?.abort();
  }

  private async execute(runId: string): Promise<void> {
    if (this.controllers.has(runId)) return;
    const controller = new AbortController();
    this.controllers.set(runId, controller);
    let timedOut = false;
    const deadline = Date.now() + this.timeoutMs;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);
    const run = await this.runs.findWorkerRun(runId);
    if (!run) {
      clearTimeout(timeout);
      this.controllers.delete(runId);
      return;
    }
    let checkout: Awaited<ReturnType<RepositoryGitExecutorService['checkout']>> | undefined;
    let currentStage = 'resolve';
    try {
      await this.assertNotCancelled(runId, controller.signal);
      await this.runs.start(runId);
      await this.stages.start(runId, 'resolve');
      await this.stages.succeed(runId, 'resolve', [
        `已固定 ${run.branch}@${run.commitSha.slice(0, 12)}`,
      ], [{
        file: '.git',
        kind: 'git_snapshot',
        detail: `${run.branch}@${run.commitSha}`,
        confidence: 'high',
      }]);
      const credential = await this.credentials.resolveStored(run.connection);
      await this.assertNotCancelled(runId, controller.signal);

      currentStage = 'checkout';
      await this.stages.start(runId, currentStage);
      checkout = await this.git.checkout(
        run.repositoryUrl,
        run.branch,
        run.commitSha,
        credential,
        controller.signal,
      );
      await this.stages.succeed(runId, currentStage, ['精确 commit 已检出到隔离临时目录。']);

      currentStage = 'inventory';
      await this.stages.start(runId, currentStage);
      const inventory = await this.inventoryService.inventory(
        checkout.root,
        deadline,
        controller.signal,
      );
      await this.stages.succeed(runId, currentStage, [
        `已盘点 ${inventory.totalFiles} 个文件，${inventory.totalBytes} 字节。`,
      ], inventory.files.slice(0, 100).map((file) => ({
        file,
        kind: 'inventory',
        detail: '仓库文件',
      })));
      await this.assertNotCancelled(runId, controller.signal);

      currentStage = 'detect';
      await this.stages.start(runId, currentStage);
      const result = this.parser.parse(inventory);
      await this.stages.succeed(runId, currentStage, [
        `检测到 ${result.services.length} 个单元，${result.composeCandidates.length} 份 Compose。`,
      ], result.evidence);

      currentStage = 'suggest';
      await this.stages.start(runId, currentStage);
      const drafts = await this.suggestionBuilder.build(
        run.teamId,
        run.projectId,
        run,
        result,
      );
      await this.stages.succeed(runId, currentStage, [
        `生成 ${drafts.length} 条待确认建议。`,
      ], drafts.flatMap((item) => item.evidence).slice(0, 100));

      currentStage = 'cleanup';
      await this.cleanup(runId, checkout);
      checkout = undefined;
      await this.runs.succeed(runId, result, drafts);
      await this.audit.record({
        teamId: run.teamId,
        userId: run.triggeredById,
        projectId: run.projectId,
        action: 'repository.analysis.succeed',
        targetType: 'repository_analysis_run',
        targetId: run.id,
        summary: `仓库解析完成：${result.services.length} 个单元，${drafts.length} 条建议`,
        metadata: { branch: run.branch, commitSha: run.commitSha, parserVersion: run.parserVersion },
      });
    } catch (error) {
      const cancelRequested = await this.runs.isCancelRequested(runId);
      const cancelled = !timedOut && (controller.signal.aborted || cancelRequested);
      const detail = repositoryAnalysisErrorDetail(error, cancelled, timedOut);
      await this.stages.fail(runId, currentStage, detail.code, detail.message);
      if (checkout) await this.retryCleanup(checkout);
      await this.stages.cancelRemaining(runId);
      await this.runs.terminal(runId, cancelled ? 'cancelled' : 'failed', detail);
      await this.audit.record({
        teamId: run.teamId,
        userId: run.triggeredById,
        projectId: run.projectId,
        action: cancelled ? 'repository.analysis.cancel' : 'repository.analysis.fail',
        targetType: 'repository_analysis_run',
        targetId: run.id,
        status: cancelled ? 'completed' : 'failed',
        summary: detail.message,
        metadata: { errorCode: detail.code, stage: currentStage },
      });
    } finally {
      clearTimeout(timeout);
      this.controllers.delete(runId);
    }
  }

  private async cleanup(
    runId: string,
    checkout: { cleanup: () => Promise<void> },
  ): Promise<void> {
    await this.stages.start(runId, 'cleanup');
    await checkout.cleanup();
    await this.stages.succeed(runId, 'cleanup', ['隔离临时目录已清理。']);
  }

  private async retryCleanup(
    checkout: { cleanup: () => Promise<void> },
  ): Promise<void> {
    try {
      await checkout.cleanup();
    } catch {
      // The original cleanup failure is already recorded on the run and stage.
    }
  }

  private async assertNotCancelled(runId: string, signal: AbortSignal): Promise<void> {
    if (signal.aborted || await this.runs.isCancelRequested(runId)) {
      throw new RepositoryAnalysisExecutionError({
        code: 'REPOSITORY_ANALYSIS_CANCELLED',
        message: '解析已取消',
        action: '可从运行历史重新发起解析。',
      });
    }
  }
}
