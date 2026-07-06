import { ServerExecutionInput } from "../server-executor.types";
import { SshCommandResult } from "./ssh-live.types";

export async function notifySshRemoteProcessStarted(
  input: ServerExecutionInput,
  pid: number,
) {
  try {
    await input.runtimeObserver?.onRemoteProcessStarted?.({
      transport: "ssh",
      pid,
      observedAt: new Date().toISOString(),
      ...(input.target.serverId !== undefined
        ? { serverId: input.target.serverId }
        : {}),
      ...(input.target.serverHost
        ? { serverHost: input.target.serverHost }
        : {}),
      operationKey: input.operationKey,
      adapterKey: input.adapterKey,
      cleanupStrategy: "best_effort_ssh",
    });
  } catch {
    // Runtime observers are best-effort metadata sinks; execution must not fail because persistence failed.
  }
}

export async function notifySshRemoteProcessCleanup(
  input: ServerExecutionInput,
  cleanup: NonNullable<SshCommandResult["remoteKill"]>,
  pid?: number,
) {
  try {
    await input.runtimeObserver?.onRemoteProcessCleanup?.({
      transport: "ssh",
      ...(pid ? { pid } : {}),
      observedAt: new Date().toISOString(),
      ...(cleanup.reason ? { reason: cleanup.reason } : {}),
      attempted: cleanup.attempted,
      ...(cleanup.succeeded !== undefined
        ? { succeeded: cleanup.succeeded }
        : {}),
      ...(cleanup.error ? { error: cleanup.error } : {}),
    });
  } catch {
    // Runtime observers are best-effort metadata sinks; execution must not fail because persistence failed.
  }
}
