import type { MutableServerExecutionCancellationToken } from "./server-executor-cancellation-token.service";

export class ServerExecutorRunningCancellationService {
  private readonly tokens = new Map<
    string,
    MutableServerExecutionCancellationToken
  >();

  getRunningCount(): number {
    return this.tokens.size;
  }

  register(
    jobId: string,
    token: MutableServerExecutionCancellationToken,
  ): void {
    this.tokens.set(jobId, token);
  }

  cancel(jobId: string): void {
    this.tokens.get(jobId)?.cancel();
  }

  unregister(jobId: string): void {
    this.tokens.delete(jobId);
  }

  cancelAndStopAll(): void {
    for (const token of this.tokens.values()) {
      token.cancel();
      token.stop();
    }
    this.tokens.clear();
  }
}
