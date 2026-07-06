import { Prisma } from "@prisma/client";
import { SshLiveServerExecutorAdapter } from "./adapters/ssh-live.adapter";
import { rehydrateServerExecutionInput } from "./server-executor-input-snapshot.utils";
import { readRemoteExecutionSessionSnapshot } from "./server-executor-job-metadata.utils";
import { isRecord } from "./server-executor-json.utils";
import { ServerExecutorRemoteExecutionMetadataService } from "./server-executor-remote-execution-metadata.service";
import { ServerRemoteExecutionCleanup } from "./server-executor.types";

type StaleRemoteCleanupJob = {
  id: string;
  teamId: string;
  actorId: string | null;
  inputSnapshot: Prisma.JsonValue;
  metadata?: Prisma.JsonValue | null;
};

export class ServerExecutorStaleRemoteCleanupService {
  constructor(
    private readonly enabled: () => boolean,
    private readonly sshLiveAdapter: SshLiveServerExecutorAdapter,
    private readonly remoteExecutionMetadataService: ServerExecutorRemoteExecutionMetadataService,
  ) {}

  async cleanup(
    job: StaleRemoteCleanupJob,
  ): Promise<ServerRemoteExecutionCleanup | undefined> {
    if (!this.enabled()) {
      return undefined;
    }

    const metadata = isRecord(job.metadata) ? job.metadata : {};
    const remoteExecution = isRecord(metadata.remoteExecution)
      ? metadata.remoteExecution
      : {};
    const session = readRemoteExecutionSessionSnapshot(remoteExecution.session);
    if (!session) {
      return undefined;
    }

    let cleanup: ServerRemoteExecutionCleanup;
    try {
      const input = rehydrateServerExecutionInput(job.inputSnapshot, {
        teamId: job.teamId,
        userId: job.actorId || undefined,
      });
      cleanup = await this.sshLiveAdapter.cleanupRemoteExecutionSession(
        input,
        session,
        "stale_recovery",
      );
    } catch (error) {
      cleanup = {
        transport: "ssh",
        pid: session.pid,
        observedAt: new Date().toISOString(),
        reason: "stale_recovery",
        attempted: false,
        succeeded: false,
        error:
          error instanceof Error
            ? error.message
            : "stale remote cleanup failed",
      };
    }

    await this.remoteExecutionMetadataService.recordStaleRemoteCleanupMetadata(
      job.id,
      cleanup,
    );
    return cleanup;
  }
}
