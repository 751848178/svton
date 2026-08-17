import { Injectable } from "@nestjs/common";
import { RepositoryAnalysisCompletionRepository } from "./repository-analysis-completion.repository";
import { repositoryAnalysisErrorDetail } from "./repository-analysis-execution.error";
import {
  repositoryFailureAudit,
  type RepositoryWorkerRunIdentity,
} from "./repository-analysis-worker-audit.utils";

@Injectable()
export class RepositoryAnalysisWorkerFinalizationService {
  constructor(private readonly completion: RepositoryAnalysisCompletionRepository) {}

  async fail(input: {
    run: RepositoryWorkerRunIdentity;
    runId: string;
    workerLeaseToken: string;
    currentStage: string;
    error: unknown;
    timedOut: boolean;
    aborted: boolean;
    cancelRequested: boolean;
  }): Promise<void> {
    const cancelled = !input.timedOut && (input.aborted || input.cancelRequested);
    const detail = repositoryAnalysisErrorDetail(
      input.error,
      cancelled,
      input.timedOut,
    );
    await this.completion.fail({
      runId: input.runId,
      workerLeaseToken: input.workerLeaseToken,
      currentStage: input.currentStage,
      status: cancelled ? "cancelled" : "failed",
      detail,
      audit: repositoryFailureAudit(input.run, cancelled, detail, input.currentStage),
    });
  }
}
