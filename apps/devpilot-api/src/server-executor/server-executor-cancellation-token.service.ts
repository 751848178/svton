import { PrismaService } from "../prisma/prisma.service";
import { ServerExecutionCancellationToken } from "./server-executor.types";

type CancellationTokenLogger = {
  warn(message: string): void;
};

type CreateCancellationTokenOptions = {
  jobId: string;
  pollMs: number;
  logger: CancellationTokenLogger;
};

export type MutableServerExecutionCancellationToken =
  ServerExecutionCancellationToken & {
    cancel(): void;
    checkPersistedCancellation(): Promise<void>;
    stop(): void;
  };

export class ServerExecutorCancellationTokenService {
  constructor(private readonly prisma: PrismaService) {}

  createToken({
    jobId,
    pollMs,
    logger,
  }: CreateCancellationTokenOptions): MutableServerExecutionCancellationToken {
    let requested = false;
    let stopped = false;
    let polling = false;
    let pollErrorLogged = false;
    const callbacks = new Set<() => void>();
    const requestCancel = () => {
      if (requested) return;
      requested = true;
      for (const callback of callbacks) {
        callback();
      }
    };
    const checkPersistedCancellation = async () => {
      if (requested || stopped || polling) return;

      polling = true;
      try {
        const job = await this.prisma.serverExecutionJob.findUnique({
          where: { id: jobId },
          select: {
            status: true,
            cancelRequestedAt: true,
          },
        });

        if (!job || job.status === "cancelled" || job.cancelRequestedAt) {
          requestCancel();
        }
      } catch (error) {
        if (!pollErrorLogged) {
          logger.warn(
            error instanceof Error
              ? `Server executor cancellation poll failed: ${error.message}`
              : "Server executor cancellation poll failed",
          );
          pollErrorLogged = true;
        }
      } finally {
        polling = false;
      }
    };
    const timer = setInterval(() => {
      void checkPersistedCancellation();
    }, pollMs);

    return {
      isCancellationRequested: () => requested,
      onCancel: (callback) => {
        callbacks.add(callback);
        if (requested) callback();
        return () => {
          callbacks.delete(callback);
        };
      },
      cancel: requestCancel,
      checkPersistedCancellation,
      stop: () => {
        stopped = true;
        clearInterval(timer);
        callbacks.clear();
      },
    };
  }
}
