import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { isArchivedProjectWriteError } from '../project/project-archived-write.error';
import { REPOSITORY_ANALYSIS_DEFAULTS } from './repository-analysis.constants';
import { RepositoryAnalysisCompletionRepository } from './repository-analysis-completion.repository';
import { RepositoryAnalysisExecutionError } from './repository-analysis-execution.error';
import { RepositoryAnalysisRunRepository } from './repository-analysis-run.repository';
import { RepositoryAnalysisStageRepository } from './repository-analysis-stage.repository';
import { RepositoryCredentialService } from './repository-credential.service';
import { RepositoryGitExecutorService } from './repository-git-executor.service';
import { RepositoryInventoryService } from './repository-inventory.service';
import { RepositoryParserService } from './repository-parser.service';
import { RepositorySuggestionBuilderService } from './repository-suggestion-builder.service';
import {
  isRepositoryWorkerLeaseFailure,
  runRepositoryWorkerDetached,
  scheduleRepositoryWorkerLeaseRetry,
  startRepositoryWorkerLeaseHeartbeat,
} from './repository-analysis-worker-lease.utils';
import { repositorySuccessAudit } from './repository-analysis-worker-audit.utils';
import { RepositoryAnalysisWorkerFinalizationService } from './repository-analysis-worker-finalization.service';

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
    private readonly completion: RepositoryAnalysisCompletionRepository,
    private readonly finalization: RepositoryAnalysisWorkerFinalizationService,
  ) {
    this.timeoutMs = Number(config.get('REPOSITORY_ANALYSIS_TIMEOUT_MS')) ||
      REPOSITORY_ANALYSIS_DEFAULTS.analysisTimeoutMs;
  }

  async onModuleInit(): Promise<void> {
    for (const run of await this.runs.recoverActiveIds()) this.enqueue(run.id);
  }

  enqueue(runId: string): void {
    if (!this.controllers.has(runId)) runRepositoryWorkerDetached(
      runId, (id) => this.execute(id), (id) => this.enqueue(id),
    );
  }

  cancel(runId: string): void { this.controllers.get(runId)?.abort(); }
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
    let run: Awaited<ReturnType<RepositoryAnalysisRunRepository['findWorkerRun']>> | undefined;
    let checkout: Awaited<ReturnType<RepositoryGitExecutorService['checkout']>> | undefined;
    let currentStage = 'resolve';
    const workerLeaseToken = randomUUID();
    let claimed = false;
    let stopHeartbeat: (() => void) | undefined;
    try {
      run = await this.runs.findWorkerRun(runId) ?? undefined;
      if (!run) return;
      const claim = await this.runs.start(runId, workerLeaseToken);
      if (claim.state === 'leased') {
        return scheduleRepositoryWorkerLeaseRetry(runId, claim.retryAt, (id) => this.enqueue(id));
      }
      if (claim.state === 'terminal') return;
      claimed = true;
      stopHeartbeat = startRepositoryWorkerLeaseHeartbeat(
        runId, workerLeaseToken, (id, token) => this.runs.extendWorkerLease(id, token),
        controller,
      );
      await this.assertNotCancelled(runId, controller.signal);
      await this.stages.start(runId, 'resolve', workerLeaseToken);
      await this.stages.succeed(runId, 'resolve', [
        `已固定 ${run.branch}@${run.commitSha.slice(0, 12)}`,
      ], [{
        file: '.git',
        kind: 'git_snapshot',
        detail: `${run.branch}@${run.commitSha}`,
        confidence: 'high',
      }], workerLeaseToken);
      const credential = await this.credentials.resolveStored(run.connection);
      await this.assertNotCancelled(runId, controller.signal);

      currentStage = 'checkout';
      await this.stages.start(runId, currentStage, workerLeaseToken);
      checkout = await this.git.checkout(
        run.repositoryUrl,
        run.branch,
        run.commitSha,
        credential,
        controller.signal,
      );
      await this.stages.succeed(
        runId, currentStage, ['精确 commit 已检出到隔离临时目录。'], [], workerLeaseToken,
      );

      currentStage = 'inventory';
      await this.stages.start(runId, currentStage, workerLeaseToken);
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
      })), workerLeaseToken);
      await this.assertNotCancelled(runId, controller.signal);

      currentStage = 'detect';
      await this.stages.start(runId, currentStage, workerLeaseToken);
      const result = this.parser.parse(inventory);
      await this.stages.succeed(runId, currentStage, [
        `检测到 ${result.services.length} 个单元，${result.composeCandidates.length} 份 Compose。`,
      ], result.evidence, workerLeaseToken);

      currentStage = 'suggest';
      await this.stages.start(runId, currentStage, workerLeaseToken);
      const drafts = await this.suggestionBuilder.build(
        run.teamId,
        run.projectId,
        run,
        result,
      );
      await this.stages.succeed(runId, currentStage, [
        `生成 ${drafts.length} 条待确认建议。`,
      ], drafts.flatMap((item) => item.evidence).slice(0, 100), workerLeaseToken);
      await this.assertNotCancelled(runId, controller.signal);

      currentStage = 'cleanup';
      await this.stages.start(runId, 'cleanup', workerLeaseToken);
      await checkout.cleanup();
      checkout = undefined;
      await this.completion.succeed({
        runId,
        workerLeaseToken,
        result,
        drafts,
        audit: repositorySuccessAudit(run, result.services.length, drafts.length),
      });
    } catch (error) {
      if (isArchivedProjectWriteError(error)) return;
      if (!run || !claimed) throw error;
      if (isRepositoryWorkerLeaseFailure(error, controller.signal)) {
        if (checkout) await this.retryCleanup(checkout);
        scheduleRepositoryWorkerLeaseRetry(runId, new Date(), (id) => this.enqueue(id));
        return;
      }
      if (checkout) await this.retryCleanup(checkout);
      const cancelRequested = await this.runs.isCancelRequested(runId);
      await this.finalization.fail({
        run, runId, workerLeaseToken, currentStage, error, timedOut,
        aborted: controller.signal.aborted,
        cancelRequested,
      });
    } finally {
      stopHeartbeat?.();
      clearTimeout(timeout);
      this.controllers.delete(runId);
    }
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
