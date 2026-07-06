import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isRecord, toJsonValue } from "./server-executor-json.utils";
import {
  ServerExecutionRuntimeObserver,
  ServerRemoteExecutionCleanup,
  ServerRemoteExecutionSession,
} from "./server-executor.types";

@Injectable()
export class ServerExecutorRemoteExecutionMetadataService {
  constructor(private readonly prisma: PrismaService) {}

  createRuntimeObserver(jobId: string): ServerExecutionRuntimeObserver {
    return {
      onRemoteProcessStarted: (session) =>
        this.recordRunningMetadata(jobId, { session }),
      onRemoteProcessCleanup: (cleanup) =>
        this.recordRunningMetadata(jobId, { cleanup }),
    };
  }

  async recordStaleRemoteCleanupMetadata(
    jobId: string,
    cleanup: ServerRemoteExecutionCleanup,
  ) {
    const job = await this.prisma.serverExecutionJob.findUnique({
      where: { id: jobId },
      select: { metadata: true },
    });
    const metadata = isRecord(job?.metadata) ? job.metadata : {};
    const remoteExecution = isRecord(metadata.remoteExecution)
      ? metadata.remoteExecution
      : {};

    await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: jobId,
        status: "failed",
      },
      data: {
        metadata: toJsonValue({
          ...metadata,
          remoteExecution: {
            ...remoteExecution,
            staleCleanup: cleanup,
            updatedAt: new Date().toISOString(),
          },
        }),
      },
    });
  }

  private async recordRunningMetadata(
    jobId: string,
    update: {
      session?: ServerRemoteExecutionSession;
      cleanup?: ServerRemoteExecutionCleanup;
    },
  ) {
    const job = await this.prisma.serverExecutionJob.findUnique({
      where: { id: jobId },
      select: { metadata: true },
    });
    const metadata = isRecord(job?.metadata) ? job.metadata : {};
    const remoteExecution = isRecord(metadata.remoteExecution)
      ? metadata.remoteExecution
      : {};

    await this.prisma.serverExecutionJob.updateMany({
      where: {
        id: jobId,
        status: "running",
      },
      data: {
        metadata: toJsonValue({
          ...metadata,
          remoteExecution: {
            ...remoteExecution,
            ...update,
            updatedAt: new Date().toISOString(),
          },
        }),
      },
    });
  }
}
