import { Logger } from "@nestjs/common";

type QueueWorkerLogger = Pick<Logger, "error" | "log">;

type ProcessNextQueuedJob = () => Promise<{ processed: boolean }>;

type ServerExecutorQueueWorkerOptions = {
  workerId: string;
  enabled: () => boolean;
  intervalMs: () => number;
  batchSize: () => number;
  processNextQueuedJob: ProcessNextQueuedJob;
  logger: QueueWorkerLogger;
};

export class ServerExecutorQueueWorkerService {
  private queueTimer?: ReturnType<typeof setInterval>;
  private processingQueue = false;

  constructor(private readonly options: ServerExecutorQueueWorkerOptions) {}

  isProcessing() {
    return this.processingQueue;
  }

  start() {
    if (!this.options.enabled()) {
      return;
    }

    const intervalMs = this.options.intervalMs();
    this.queueTimer = setInterval(() => {
      void this.processDueQueuedJobs();
    }, intervalMs);
    this.options.logger.log(
      `Server executor queue worker enabled: ${this.options.workerId}`,
    );
  }

  stop() {
    if (this.queueTimer) {
      clearInterval(this.queueTimer);
    }
  }

  private async processDueQueuedJobs() {
    if (this.processingQueue) return;

    this.processingQueue = true;
    try {
      const batchSize = this.options.batchSize();
      for (let index = 0; index < batchSize; index += 1) {
        const result = await this.options.processNextQueuedJob();
        if (!result.processed) break;
      }
    } catch (error) {
      this.options.logger.error(
        error instanceof Error
          ? error.message
          : "Server executor queue worker failed",
      );
    } finally {
      this.processingQueue = false;
    }
  }
}
